#!/usr/bin/env node
// Federate all adapters → catalog.json at the repo root.
// Run by CI daily (catalog-refresh.yml) and by maintainers locally.
//
//   node scripts/build-catalog.mjs

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Build the TS first so we can import adapter logic from dist/.
// (CI runs `npm run build` before this script; locally, run `npm run build`
// or rely on tsx via `node --import tsx scripts/build-catalog.mjs`.)
const { fetchAll } = await import(join(repoRoot, "dist", "adapters", "index.js"));

console.log("Fetching from all adapters …");
const entries = await fetchAll();

const catalog = {
  version: 1,
  generated_at: new Date().toISOString(),
  entries,
};

const outPath = join(repoRoot, "catalog.json");
await writeFile(outPath, JSON.stringify(catalog, null, 2) + "\n");

console.log(`Wrote ${entries.length} entries to ${outPath}`);
