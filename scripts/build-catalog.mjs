#!/usr/bin/env node
// Federate all adapters → catalog.json at the repo root.
// Run by CI daily (catalog-refresh.yml) and by maintainers locally.
//
//   node scripts/build-catalog.mjs           # fast: no URL probing
//   node scripts/build-catalog.mjs --probe   # also HEAD-checks skill_files URLs
//   node scripts/build-catalog.mjs --adapter handpicked

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalogArgs } from "./catalog-options.mjs";
import { mergeSelectedAdapters } from "./catalog-merge.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const { probe, adapterNames } = parseCatalogArgs(process.argv.slice(2));

// Build the TS first so we can import adapter logic from dist/.
const { fetchAll } = await import(join(repoRoot, "dist", "adapters", "index.js"));

if (adapterNames.length > 0) {
  console.log(`Fetching from selected adapter(s): ${adapterNames.join(", ")} …`);
} else {
  console.log("Fetching from all adapters …");
}
let refreshedEntries;
try {
  refreshedEntries = await fetchAll(adapterNames);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
const outPath = join(repoRoot, "catalog.json");
const previous = await readPreviousCatalog(outPath);
const previousEntries = Array.isArray(previous?.entries) ? previous.entries : null;
const entries =
  adapterNames.length > 0 && previousEntries
    ? mergeSelectedAdapters(previousEntries, refreshedEntries, adapterNames)
    : refreshedEntries;

if (probe) {
  console.log(`\nProbing skill_files URLs (${entries.length} entries) …`);
  await probeEntries(entries);
}

const previousGeneratedAtValid = typeof previous?.generated_at === "string";
const entriesChanged =
  !previous ||
  previous?.version !== 1 ||
  !previousEntries ||
  !previousGeneratedAtValid ||
  JSON.stringify(stableEntries(previousEntries)) !==
    JSON.stringify(stableEntries(entries));
const catalogEntries = entriesChanged ? entries : previousEntries;

const catalog = {
  version: 1,
  generated_at: entriesChanged ? new Date().toISOString() : previous.generated_at,
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

// ---------------------------------------------------------------------------

async function probeEntries(entries) {
  // Probe EVERY skill_file, not just the first — a skill whose SKILL.md resolves
  // but whose later assets 404 is still broken at install time. Flatten to one
  // probe per (entry, file).
  const targets = [];
  for (const e of entries) {
    for (const f of e.install?.skill_files ?? []) {
      if (f?.source) targets.push({ id: e.id, url: f.source, target: f.target });
    }
  }
  const withUrls = new Set(targets.map((t) => t.id));
  console.log(
    `  ${withUrls.size} entries / ${targets.length} skill_files to probe`
  );

  const CONCURRENCY = 20;
  let ok = 0;
  let dead = 0;
  const deadList = [];

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async ({ id, url, target }) => {
        try {
          const res = await fetch(url, {
            method: "HEAD",
            signal: AbortSignal.timeout(6000),
            headers: { "User-Agent": "claude-omakase-probe" },
          });
          if (res.ok) {
            ok++;
          } else {
            dead++;
            deadList.push({ id, url, target, status: res.status });
          }
        } catch {
          dead++;
          deadList.push({ id, url, target, status: "unreachable" });
        }
      })
    );
  }

  const deadEntries = new Set(deadList.map((d) => d.id));
  console.log(`\nHealth report:`);
  console.log(`  ✅ reachable files: ${ok}`);
  console.log(`  ❌ dead/unreachable files: ${dead}`);
  if (deadEntries.size > 0) {
    console.log(`  ⚠️  ${deadEntries.size} entr${deadEntries.size === 1 ? "y has" : "ies have"} at least one dead file`);
    console.log(`\nDead files (first 20):`);
    for (const d of deadList.slice(0, 20)) {
      console.log(`  ${d.id} [${d.target}]: ${d.status} — ${d.url}`);
    }
  }
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
      source: { ...entry.source, fetched_at: undefined },
    };
  });
}
