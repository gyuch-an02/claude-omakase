#!/usr/bin/env node
// Seed the repetition-detector state so the BEFORE half of the promo demo
// doesn't have to be recorded: it plants two prior "edited <file> in a separate
// session" events, so the FIRST on-camera edit is the third strike and the
// omakase nudge fires live.
//
//   node docs/demo/seed-repetition.mjs                       # edit:CHANGELOG.md ×2
//   node docs/demo/seed-repetition.mjs --file make_figures.py # research viz demo
//   node docs/demo/seed-repetition.mjs --reset               # wipe demo state for a retake
//
// After seeding, in a FRESH session ask Claude to edit that same file once. The
// PostToolUse hook counts it as the 3rd recurrence within the window and injects
// the find_skill nudge into that same turn.
//
// For the data-visualization demo use `--file make_figures.py`: a researcher who
// keeps hand-editing their plotting script across sessions is exactly the
// recurring chore the data-visualization skill replaces.
//
// Safe to run on a real machine: it only touches repetition.json and backs up
// any existing file to repetition.json.pre-demo first.

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const dir = join(homedir(), ".claude", "omakase-state");
const file = join(dir, "repetition.json");
const backup = join(dir, "repetition.json.pre-demo");

if (process.argv.includes("--reset")) {
  rmSync(file, { force: true });
  if (existsSync(backup)) {
    copyFileSync(backup, file);
    rmSync(backup, { force: true });
    console.log("Restored pre-demo repetition state.");
  } else {
    console.log("Demo state wiped (no pre-demo backup to restore).");
  }
  process.exit(0);
}

// --file <name> picks which edited file recurs (basename only — the hook keys on
// basename so the path doesn't matter). Default: CHANGELOG.md.
const flagIdx = process.argv.indexOf("--file");
const fileName = flagIdx >= 0 && process.argv[flagIdx + 1] ? process.argv[flagIdx + 1] : "CHANGELOG.md";
const SIG = `edit:${fileName}`;

mkdirSync(dir, { recursive: true });
if (existsSync(file) && !existsSync(backup)) copyFileSync(file, backup);

const now = Date.now();
const state = {
  // Two prior edits, 1 and 2 days ago — inside the default 14-day window.
  events: { [SIG]: [now - 2 * 86_400_000, now - 86_400_000] },
  seq: [],
  // Must NOT contain the nudge key for this signature — a remembered nudge never refires.
  nudged: [],
  // A session id the live demo session can't collide with, so the on-camera
  // edit counts as a NEW session's occurrence.
  editSessions: { [SIG]: "demo-prior-session" },
};

writeFileSync(file, JSON.stringify(state, null, 2) + "\n", "utf8");
console.log(`Seeded ${file}`);
console.log(`  ${SIG}: 2 prior sessions planted — the next session's edit fires the nudge.`);
console.log(`  Retake: node docs/demo/seed-repetition.mjs --reset && re-run this script.`);
