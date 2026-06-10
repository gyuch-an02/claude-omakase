// Catalog loader. Strategy:
//   1. If env CLAUDE_OMAKASE_CATALOG_URL is set → fetch fresh JSON from there.
//   2. Else if a cached copy under ~/.cache/claude-omakase/catalog.json is
//      newer than TTL → use it.
//   3. Else try the bundled catalog.json shipped inside the npm package.
//   4. Else fail loud with an EMPTY catalog. A live adapter run is only an
//      explicit opt-in via OMAKASE_ALLOW_LIVE_FETCH=1 (never silent).

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bundledCatalogPath, omakaseCacheDir } from "../paths.js";
import { sanitizeCatalog } from "./sanitize.js";
import type { Catalog } from "../types.js";

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const cachePath = () => join(omakaseCacheDir(), "catalog.json");

// Public loader: always returns a sanitized catalog so scraped-tag pollution
// (HTML fragments, markup punctuation) never reaches search/recommend.
export async function load(): Promise<Catalog> {
  return sanitizeCatalog(await loadRaw());
}

async function loadRaw(): Promise<Catalog> {
  const remote = process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  if (remote) {
    try {
      return await loadRemote(remote);
    } catch (e) {
      console.error(
        `catalog: remote fetch failed, falling back to local catalog: ${(e as Error).message}`
      );
    }
  }

  const cached = readFreshCache();
  if (cached) return cached;

  const bundled = readBundled();
  if (bundled) return bundled;

  // No remote, no fresh cache, no bundled catalog. By design the serving path
  // does NOT fetch sources live (see claude-omakase/CLAUDE.md) — federation is a
  // build-time, human-reviewed step. So we fail LOUD with an empty catalog rather
  // than silently turning the stdio server into a slow live web scraper.
  //
  // The live adapter run is kept only as an explicit, opt-in escape hatch behind
  // OMAKASE_ALLOW_LIVE_FETCH (e.g. local dev before the first `build:catalog`).
  if (process.env["OMAKASE_ALLOW_LIVE_FETCH"] !== "1") {
    console.error(
      "catalog: no remote, no fresh cache, and no bundled catalog.json found. " +
        "Serving an EMPTY catalog. Run `npm run build:catalog` (or ship catalog.json) " +
        "to populate it. To allow a one-off live federation instead, set " +
        "OMAKASE_ALLOW_LIVE_FETCH=1 (slow; bypasses the human catalog review gate)."
    );
    return { version: 1, generated_at: new Date().toISOString(), entries: [] };
  }

  console.error(
    "catalog: OMAKASE_ALLOW_LIVE_FETCH=1 — running a live federation as a fallback. " +
      "This is slow and bypasses the human catalog review gate; prefer a built catalog.json."
  );
  const { fetchAll } = await import("../adapters/index.js");
  const entries = await fetchAll();
  const catalog: Catalog = {
    version: 1,
    generated_at: new Date().toISOString(),
    entries,
  };
  await writeCache(catalog);
  return catalog;
}

async function loadRemote(url: string): Promise<Catalog> {
  // Timeout so a hung remote can't stall the serving path — the loader's catch
  // logs and falls through to the cached/bundled catalog instead.
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`catalog fetch ${url}: ${res.status}`);
  const catalog = (await res.json()) as unknown;
  if (!isCatalogShape(catalog)) {
    // Throw (not silently accept) so loadRaw's catch logs it and falls through
    // to the cached/bundled catalog instead of serving an empty one.
    throw new Error(`catalog fetch ${url}: response is not a valid catalog`);
  }
  await writeCache(catalog);
  return catalog;
}

function readFreshCache(): Catalog | null {
  const path = cachePath();
  if (!existsSync(path)) return null;
  const age = Date.now() - statSync(path).mtimeMs;
  if (age > TTL_MS) return null;
  return readCatalogFile(path);
}

function readBundled(): Catalog | null {
  const path = bundledCatalogPath();
  if (!existsSync(path)) return null;
  return readCatalogFile(path);
}

// Parse a catalog file, returning null on bad JSON OR a structurally invalid
// catalog (e.g. missing `entries`). Returning null lets the loader fall through
// to the next source rather than crash downstream on `entries.map`.
function readCatalogFile(path: string): Catalog | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return isCatalogShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isCatalogShape(x: unknown): x is Catalog {
  return typeof x === "object" && x !== null && Array.isArray((x as { entries?: unknown }).entries);
}

async function writeCache(catalog: Catalog): Promise<void> {
  const dir = omakaseCacheDir();
  mkdirSync(dir, { recursive: true });
  const finalPath = cachePath();
  const tmpPath = join(
    dir,
    `.catalog.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );
  try {
    await writeFile(tmpPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
    renameSync(tmpPath, finalPath);
  } catch (e) {
    rmSync(tmpPath, { force: true });
    throw e;
  }
}
