#!/usr/bin/env node
/**
 * Omakase session-start nudge — SessionStart hook (deterministic onboarding).
 *
 * The omakase-chef SKILL.md defines a "Session start" routine (call
 * list_installed_skills → starter pack / starter-pack-gap / stay quiet). But a
 * skill only acts when Claude decides to read it, so the greeting was
 * unreliable — users had to ask "where's the starter pack?" themselves.
 *
 * This hook makes it deterministic: at the start of a genuinely new session it
 * injects a one-shot instruction telling Claude to run that routine NOW, before
 * other work. It does NOT replicate the branching logic — the single source of
 * truth stays in omakase.list_installed_skills (which knows about install
 * receipts, not just the skills directory).
 *
 * Fires only on a fresh session (source: startup | clear), never on
 * resume/compact, and at most once per cooldown window — active without nagging.
 *
 * State: ~/.claude/omakase-state/session.json   (no network, no telemetry)
 * Tunables: OMAKASE_SESSION_COOLDOWN_HOURS (default 24; set 0 to fire every start)
 */

import { join } from "node:path";
import { readStdin, stateDir, loadJson, writeStateAtomic } from "./_shared.mjs";

const cooldownHoursRaw = Number(process.env.OMAKASE_SESSION_COOLDOWN_HOURS);
const cooldownHours = Number.isFinite(cooldownHoursRaw) ? Math.max(0, cooldownHoursRaw) : 24;
const COOLDOWN_MS = cooldownHours * 60 * 60 * 1000;

// Only a truly new session should be greeted. Resuming or compacting an
// existing conversation is a continuation, not a fresh start.
const FRESH_SOURCES = new Set(["startup", "clear"]);

function loadState(file) {
  const s = loadJson(file, {});
  return { lastNudgeAt: Number(s.lastNudgeAt) || 0 };
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0);
  }

  const source = String(input.source || "startup");
  if (!FRESH_SOURCES.has(source)) process.exit(0);

  const now = Date.now();
  const file = join(stateDir(), "session.json");
  const state = loadState(file);

  // Cooldown: don't greet again within the window (unless cooldown is 0).
  if (COOLDOWN_MS > 0 && now - state.lastNudgeAt < COOLDOWN_MS) process.exit(0);

  const context =
    "[omakase session-start] A new session just started. Before other work, run the " +
    "omakase-chef skill's *Session start* routine ONCE, now: call omakase.list_installed_skills " +
    "and follow its `next_step` field. If the install list is empty, run the First-session flow — " +
    "ask the one work-type question, then present the starter pack via omakase.recommend_skills as a " +
    "checklist. If next_step indicates a starter-pack gap, present the missing staples as a checklist. " +
    "Otherwise stay quiet and wait for a workflow trigger. Serve at most one nudge; never a menu beyond " +
    "the starter-pack checklist; install nothing without explicit approval.";

  state.lastNudgeAt = now;
  writeStateAtomic(file, state);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    })
  );
  process.exit(0);
}

main();
