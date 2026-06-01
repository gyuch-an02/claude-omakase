// Catalog loader. Strategy:
//   1. If env CLAUDE_OMAKASE_CATALOG_URL is set → fetch fresh JSON from there.
//   2. Else if a cached copy under ~/.cache/claude-omakase/catalog.json is
//      newer than TTL → use it.
//   3. Else try the bundled catalog.json shipped inside the npm package.
//   4. Else run adapters live (slow; only happens during dev without a build).

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
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

  // Last resort: live adapter run. Pulled in lazily so the MCP server doesn't
  // import fetch logic unless absolutely required.
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`catalog fetch ${url}: ${res.status}`);
  const catalog = (await res.json()) as Catalog;
  await writeCache(catalog);
  return catalog;
}

function readFreshCache(): Catalog | null {
  const path = cachePath();
  if (!existsSync(path)) return null;
  const age = Date.now() - statSync(path).mtimeMs;
  if (age > TTL_MS) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Catalog;
  } catch {
    return null;
  }
}

function readBundled(): Catalog | null {
  const path = bundledCatalogPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Catalog;
  } catch {
    return null;
  }
}

async function writeCache(catalog: Catalog): Promise<void> {
  mkdirSync(omakaseCacheDir(), { recursive: true });
  await writeFile(cachePath(), JSON.stringify(catalog, null, 2) + "\n", "utf8");
}
