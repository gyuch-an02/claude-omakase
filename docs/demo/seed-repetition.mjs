#!/usr/bin/env node
// Seed the repetition-detector state so the BEFORE half of the promo demo
// doesn't have to be recorded: it plants two prior "edited CHANGELOG.md in a
// separate session" events, so the FIRST on-camera edit is the third strike
// and the omakase nudge fires live.
//
//   node docs/demo/seed-repetition.mjs            # seed edit:CHANGELOG.md ×2
//   node docs/demo/seed-repetition.mjs --reset    # wipe demo state for a retake
//
// After seeding, ask Claude (in a FRESH session) to update CHANGELOG.md once.
// The PostToolUse hook counts it as the 3rd recurrence within the window and
// injects the find_skill nudge into that same turn.
//
// Safe to run on a real machine: it only touches repetition.json and backs up
// any existing file to repetition.json.pre-demo first.

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SIG = "edit:CHANGELOG.md";
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

mkdirSync(dir, { recursive: true });
if (existsSync(file) && !existsSync(backup)) copyFileSync(file, backup);

const now = Date.now();
const state = {
  // Two prior edits, 1 and 2 days ago — inside the default 14-day window.
  events: { [SIG]: [now - 2 * 86_400_000, now - 86_400_000] },
  seq: [],
  // Must NOT contain "cmd:edit:CHANGELOG.md" — a remembered nudge never refires.
  nudged: [],
  // A session id the live demo session can't collide with, so the on-camera
  // edit counts as a NEW session's occurrence.
  editSessions: { [SIG]: "demo-prior-session" },
};

writeFileSync(file, JSON.stringify(state, null, 2) + "\n", "utf8");
console.log(`Seeded ${file}`);
console.log(`  ${SIG}: 2 prior sessions planted — the next session's edit fires the nudge.`);
console.log(`  Retake: node docs/demo/seed-repetition.mjs --reset && re-run this script.`);
