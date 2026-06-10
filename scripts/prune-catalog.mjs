#!/usr/bin/env node
// Prune the EXISTING catalog.json in place: HEAD-probe every skill_files URL and
// drop any entry that has a dead/unreachable file. Unlike build-catalog.mjs this
// does NOT re-federate the adapters — it only verifies what is already committed,
// so it's fast to run after a catalog drift and safe offline-of-the-adapters.
//
//   node scripts/prune-catalog.mjs            # rewrite catalog.json minus dead entries
//   node scripts/prune-catalog.mjs --dry-run  # report only, write nothing
//
// Why this exists: adapters (glama, awesome-mcp) derive a SKILL.md URL by
// GUESSING `…/main/SKILL.md`. MCP-server repos almost never ship one, so a large
// fraction of those entries 404 at install time. Probing reveals and removes them.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const catalogPath = join(repoRoot, "catalog.json");
const dryRun = process.argv.slice(2).includes("--dry-run");

const CONCURRENCY = 20;
const TIMEOUT_MS = 8000;

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const entries = Array.isArray(catalog.entries) ? catalog.entries : [];

// One probe per (entry, file). An entry is dead if ANY of its files is dead.
const targets = [];
for (const e of entries) {
  for (const f of e.install?.skill_files ?? []) {
    if (f?.source) targets.push({ id: e.id, url: f.source });
  }
}
console.log(`Probing ${targets.length} skill_files across ${entries.length} entries …`);

const deadEntries = new Set();
let ok = 0;
let dead = 0;

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  const chunk = targets.slice(i, i + CONCURRENCY);
  await Promise.all(
    chunk.map(async ({ id, url }) => {
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { "User-Agent": "claude-omakase-prune" },
        });
        if (res.ok) ok++;
        else {
          dead++;
          deadEntries.add(id);
        }
      } catch {
        dead++;
        deadEntries.add(id);
      }
    })
  );
  process.stderr.write(`  probed ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length}\r`);
}
process.stderr.write("\n");

const survivors = entries.filter((e) => !deadEntries.has(e.id));
console.log(`\n  ✅ reachable files: ${ok}`);
console.log(`  ❌ dead files: ${dead}`);
console.log(
  `  pruned ${deadEntries.size} uninstallable entr${deadEntries.size === 1 ? "y" : "ies"}: ${
    entries.length
  } → ${survivors.length}`
);

if (dryRun) {
  console.log("\n--dry-run: catalog.json not modified.");
} else if (deadEntries.size > 0) {
  const next = {
    version: catalog.version ?? 1,
    generated_at: new Date().toISOString(),
    entries: survivors,
  };
  await writeFile(catalogPath, JSON.stringify(next, null, 2) + "\n");
  console.log(`\nWrote ${survivors.length} entries to ${catalogPath}`);
} else {
  console.log("\nNo dead entries — catalog.json unchanged.");
}
