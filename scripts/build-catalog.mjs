#!/usr/bin/env node
// Federate all adapters → catalog.json at the repo root.
// Run by CI daily (catalog-refresh.yml) and by maintainers locally.
//
//   node scripts/build-catalog.mjs

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Build the TS first so we can import adapter logic from dist/.
// (CI runs `npm run build` before this script; locally, run `npm run build`
// or rely on tsx via `node --import tsx scripts/build-catalog.mjs`.)
const { fetchAll } = await import(join(repoRoot, "dist", "adapters", "index.js"));

console.log("Fetching from all adapters …");
const entries = await fetchAll();
const outPath = join(repoRoot, "catalog.json");
const previous = await readPreviousCatalog(outPath);
const entriesChanged =
  !previous ||
  JSON.stringify(stableEntries(previous.entries ?? [])) !==
    JSON.stringify(stableEntries(entries));
const catalogEntries = entriesChanged ? entries : previous.entries;

const catalog = {
  version: 1,
  generated_at:
    entriesChanged || previous?.version !== 1
      ? new Date().toISOString()
      : previous.generated_at,
  entries: catalogEntries,
};

await writeFile(outPath, JSON.stringify(catalog, null, 2) + "\n");

if (entriesChanged) {
  console.log(`Wrote ${entries.length} entries to ${outPath}`);
} else {
  console.log(
    `Catalog entries unchanged; preserved generated_at and wrote ${entries.length} entries to ${outPath}`
  );
}

async function readPreviousCatalog(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function stableEntries(entries) {
  return entries.map((entry) => {
    if (!entry.source?.fetched_at) return entry;
    return {
      ...entry,
      source: {
        ...entry.source,
        fetched_at: undefined,
      },
    };
  });
}
