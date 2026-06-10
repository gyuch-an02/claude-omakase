/**
 * Shared helpers for the omakase hooks (suggest, repetition, session-start).
 *
 * The hooks were originally standalone single files that copy-pasted readStdin,
 * the catalog-path lookup, and a best-effort state write. That duplication drifted
 * (only some had atomic writes / pruning). This module is the single source for
 * those three concerns. See docs/adr/ for why the hooks now share a lib.
 *
 * No network, no telemetry, no non-builtin deps — hooks must run as bare .mjs.
 */

import { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Read the hook's JSON payload from stdin. Returns "" if stdin is unreadable. */
export function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/** Directory all hook state lives in: ~/.claude/omakase-state. */
export function stateDir() {
  return join(homedir(), ".claude", "omakase-state");
}

/**
 * Resolve the catalog file the hooks read: the XDG cache copy first (kept fresh
 * by the MCP server), else the bundled copy shipped next to the package (../ from
 * hooks/). Returns null when neither exists.
 */
export function catalogPath() {
  const base = process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache");
  const cached = join(base, "claude-omakase", "catalog.json");
  if (existsSync(cached)) return cached;
  const bundled = join(dirname(fileURLToPath(import.meta.url)), "..", "catalog.json");
  return existsSync(bundled) ? bundled : null;
}

/** Parse the catalog and return its entries array, or [] on any failure. */
export function loadCatalogEntries() {
  const p = catalogPath();
  if (!p) return [];
  try {
    const data = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

/** Read + JSON.parse a state file, returning `fallback` on any failure. */
export function loadJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Atomically persist state: write to a unique temp file, then rename over the
 * target (rename is atomic on the same filesystem). Prevents a crash or a
 * concurrent hook run from leaving a half-written, unparseable state file.
 * Best-effort: cleans up the temp file and swallows errors so a hook never fails
 * the user's action over a state write.
 */
export function writeStateAtomic(file, state) {
  try {
    const dir = dirname(file);
    mkdirSync(dir, { recursive: true });
    const tmp = join(
      dir,
      `.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
    );
    try {
      writeFileSync(tmp, JSON.stringify(state), "utf8");
      renameSync(tmp, file);
    } catch (e) {
      rmSync(tmp, { force: true });
      throw e;
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Strip control characters and collapse whitespace in catalog-derived text
 * before it goes into an injected nudge. Defensive against scraped name/
 * description fields that carry markup or newlines.
 */
export function cleanText(s) {
  let out = "";
  for (const ch of String(s ?? "")) {
    const code = ch.codePointAt(0);
    // Drop C0 controls (0x00-0x1f) and DEL (0x7f); keep everything else.
    out += code <= 0x1f || code === 0x7f ? " " : ch;
  }
  return out.replace(/\s+/g, " ").trim();
}
