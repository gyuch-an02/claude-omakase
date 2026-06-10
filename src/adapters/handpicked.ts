// Handpicked adapter: reads JSON files from <repo>/handpicked/*.json.
// These are the only entries we manually curate. They serve two purposes:
//   1. Verified overlay — set `verified: true` for entries we've audited.
//   2. Coverage for sources adapters can't parse (e.g. private docs).
//
// At runtime the bundled `handpicked/` directory ships inside the npm package.
// During build (scripts/build-catalog.mjs) it's read from the repo root.

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Entry } from "../types.js";

export async function fetch(): Promise<Entry[]> {
  const dir = handpickedDir();
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: Entry[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(join(dir, file), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const problem = entryShapeProblem(parsed);
      if (problem) {
        console.error(`handpicked: skipping ${file}: ${problem}`);
        continue;
      }
      const entry = parsed as Entry;
      entry.source ??= { adapter: "handpicked" };
      if (entry.source.adapter === undefined) entry.source.adapter = "handpicked";
      out.push(entry);
    } catch (e) {
      console.error(`handpicked: skipping ${file}: ${(e as Error).message}`);
    }
  }
  return out;
}

// Minimal Entry-shape gate for hand-edited JSON. These files are written by
// humans (and LLMs); a missing id/tags/install used to pass `as Entry` silently
// and crash downstream (`entry.tags.includes` in recommend, `entry.install` in
// install_skill). Returns a description of the first problem, or null if OK.
function entryShapeProblem(x: unknown): string | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return "not a JSON object";
  const e = x as Record<string, unknown>;
  for (const key of ["id", "name", "type", "description"] as const) {
    if (typeof e[key] !== "string" || (e[key] as string).trim() === "") {
      return `missing or empty required string field: ${key}`;
    }
  }
  if (!Array.isArray(e["tags"])) return "missing required array field: tags";
  if (typeof e["install"] !== "object" || e["install"] === null) {
    return "missing required object field: install";
  }
  if (typeof e["verified"] !== "boolean") return "missing required boolean field: verified";
  return null;
}

function handpickedDir(): string {
  if (process.env["CLAUDE_OMAKASE_HANDPICKED_DIR"]) {
    return process.env["CLAUDE_OMAKASE_HANDPICKED_DIR"];
  }
  // dist/adapters/handpicked.js → ../../handpicked at runtime,
  // src/adapters/handpicked.ts → ../../handpicked during build.
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "handpicked");
}
