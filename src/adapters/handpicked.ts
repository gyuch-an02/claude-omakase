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
      const entry = JSON.parse(raw) as Entry;
      entry.source ??= { adapter: "handpicked" };
      if (entry.source.adapter === undefined) entry.source.adapter = "handpicked";
      out.push(entry);
    } catch (e) {
      console.error(`handpicked: skipping ${file}: ${(e as Error).message}`);
    }
  }
  return out;
}

function handpickedDir(): string {
  if (process.env["CLAUDE_OMAKASE_HANDPICKED_DIR"]) {
    return process.env["CLAUDE_OMAKASE_HANDPICKED_DIR"];
  }
  // dist/adapters/handpicked.js → ../../handpicked at runtime,
  // src/adapters/handpicked.ts → ../../handpicked during build.
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "handpicked");
}
