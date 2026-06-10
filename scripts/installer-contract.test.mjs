// Structural regression guards for bugs that unit tests can't pin down because
// they live in the SEAMS between files:
//
//   1. The installers (install.sh + src/cli/install.ts) once copied the three
//      hook entry points but not _shared.mjs / retrieval.mjs that they import —
//      every installed hook died with ERR_MODULE_NOT_FOUND. These tests derive
//      the hooks' real import closure from source and assert both installers
//      ship all of it, so adding a new hook module without updating the
//      installers fails CI.
//
//   2. catalog-refresh.yml once declared the same env key twice; YAML
//      last-key-wins silently downgraded the skillsmp request budget. The
//      duplicate-key scan below fails on any repeated key in the same mapping
//      block of any workflow file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function shHookFiles() {
  const sh = readFileSync(join(repoRoot, "install.sh"), "utf8");
  const m = sh.match(/^HOOK_FILES="([^"]+)"/m);
  assert.ok(m, "install.sh must declare HOOK_FILES");
  return m[1].split(/\s+/).filter(Boolean);
}

function tsHookFiles() {
  const ts = readFileSync(join(repoRoot, "src", "cli", "install.ts"), "utf8");
  const m = ts.match(/const HOOK_FILES = \[([^\]]+)\]/);
  assert.ok(m, "src/cli/install.ts must declare HOOK_FILES");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

// Transitive closure of local ./x.mjs imports, starting from the given files.
function importClosure(startFiles) {
  const hooksDir = join(repoRoot, "hooks");
  const seen = new Set();
  const queue = [...startFiles];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const body = readFileSync(join(hooksDir, file), "utf8");
    for (const m of body.matchAll(/from\s+"\.\/([^"]+\.mjs)"/g)) {
      if (!seen.has(m[1])) queue.push(m[1]);
    }
  }
  return seen;
}

test("installer contract: install.sh and cli/install.ts ship the same hook files", () => {
  assert.deepEqual(shHookFiles().sort(), tsHookFiles().sort());
});

test("installer contract: HOOK_FILES covers every hook's transitive local imports", () => {
  const shipped = new Set(shHookFiles());
  // Entry points = the shipped files that are actual hooks (omakase-*.mjs);
  // everything they import locally must be shipped too, or the installed copy
  // dies with ERR_MODULE_NOT_FOUND from ~/.claude/hooks/omakase/.
  const entryPoints = [...shipped].filter((f) => f.startsWith("omakase-"));
  assert.ok(entryPoints.length >= 3, "expected the three omakase-* hook entry points");
  for (const file of importClosure(entryPoints)) {
    assert.ok(shipped.has(file), `hooks/${file} is imported by a shipped hook but missing from HOOK_FILES in BOTH installers`);
  }
});

test("installer contract: every shipped hook file exists in hooks/", () => {
  const present = new Set(readdirSync(join(repoRoot, "hooks")));
  for (const file of shHookFiles()) {
    assert.ok(present.has(file), `HOOK_FILES lists hooks/${file}, which does not exist`);
  }
});

test("installer contract: both installers seed the hooks' catalog cache", () => {
  const sh = readFileSync(join(repoRoot, "install.sh"), "utf8");
  const ts = readFileSync(join(repoRoot, "src", "cli", "install.ts"), "utf8");
  // The hooks can only read ~/.cache/claude-omakase/catalog.json (or a path
  // relative to their own install dir, which the installers don't populate) —
  // an installer that stops seeding it silently kills the suggest hook.
  assert.match(sh, /seed_catalog_cache\b[\s\S]*\bseed_catalog_cache\b/, "install.sh must define AND call seed_catalog_cache");
  assert.match(ts, /seedCatalogCache\(\);/, "cli/install.ts must call seedCatalogCache()");
});

test("workflows: no duplicate keys within a YAML mapping block", () => {
  const dir = join(repoRoot, ".github", "workflows");
  for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    const lines = readFileSync(join(dir, file), "utf8").split("\n");
    // keysAtIndent[indent] = Set of keys seen in the CURRENT mapping block at
    // that indent. A line at a shallower indent, or a new list item, starts a
    // new block and clears deeper levels.
    const keysAtIndent = new Map();
    lines.forEach((raw, i) => {
      const line = raw.replace(/\t/g, "  ");
      if (!line.trim() || line.trim().startsWith("#")) return;
      const m = /^(\s*)(- )?([A-Za-z_][A-Za-z0-9_.-]*):(\s|$)/.exec(line);
      if (!m) return;
      const indent = m[1].length + (m[2] ? m[2].length : 0);
      const key = m[3];
      for (const level of [...keysAtIndent.keys()]) {
        if (level > indent || (m[2] && level >= indent)) keysAtIndent.delete(level);
      }
      const set = keysAtIndent.get(indent) ?? new Set();
      assert.ok(
        !set.has(key),
        `${file}:${i + 1}: duplicate YAML key "${key}" in the same mapping block — last one silently wins`
      );
      set.add(key);
      keysAtIndent.set(indent, set);
    });
  }
});
