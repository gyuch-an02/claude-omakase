#!/usr/bin/env node
/**
 * Omakase repetition detector — hard hook (deterministic).
 *
 * Registered as a PostToolUse(Bash) hook. After every Bash command, it:
 *   1. Normalizes the command into a coarse "task signature" (first token,
 *      or first two tokens for multi-command tools like git/npm/cargo).
 *   2. Increments a per-session counter for that signature.
 *   3. When a signature reaches THRESHOLD (default 3) for the first time in
 *      the session, it emits an `additionalContext` message telling Claude to
 *      call the omakase.find_skill MCP tool and propose one matching skill.
 *
 * This replaces the soft "Claude notices repetition on its own" path in
 * omakase-chef/SKILL.md with a deterministic trigger that is reliable in a
 * live demo. The command is never blocked — this only nudges.
 *
 * State: ~/.claude/omakase-state/repetition.json
 * No network, no telemetry. Pure local read-modify-write.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const THRESHOLD = Number(process.env.OMAKASE_REPETITION_THRESHOLD || 3);
const MAX_SESSIONS = 50; // cap state-file growth
const KMAX = 8; // longest multi-step workflow (in signatures) we detect
const SEQ_CAP = 60; // cap the per-session ordered signature stream

// Noise commands that never warrant a skill recommendation.
const SKIP = new Set([
  "cd", "ls", "ll", "pwd", "echo", "cat", "head", "tail", "less", "more",
  "which", "whoami", "clear", "export", "source", "true", "false", "env",
  "mkdir", "touch", "cp", "mv", "rm", "chmod", "sleep", "printf",
]);

// Tools where the second token is the meaningful verb.
const MULTI = new Set([
  "git", "npm", "npx", "pnpm", "yarn", "cargo", "docker", "kubectl",
  "gh", "go", "pip", "pip3", "poetry", "uv", "brew", "terraform",
]);

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/** Classify a single command segment into a coarse signature, or null. */
function classifyOne(segment) {
  // Strip rtk proxy/hook wrappers so `rtk git status` counts as `git status`.
  let cmd = segment.replace(/^rtk\s+(proxy\s+|hook\s+\S+\s+)?/, "").trim();
  if (!cmd) return null;

  const tokens = cmd.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // Drop leading env-var assignments like FOO=bar cmd ...
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  let head = tokens[i];
  if (!head) return null;

  // Strip path prefix: /usr/bin/pytest -> pytest
  head = head.split("/").pop();
  if (SKIP.has(head)) return null;

  if (MULTI.has(head) && tokens[i + 1] && !tokens[i + 1].startsWith("-")) {
    return `${head} ${tokens[i + 1]}`;
  }
  return head;
}

/**
 * Decompose a command line into an ordered list of task signatures.
 * A chained command (`a && b; c | d`) yields one signature per meaningful
 * segment, in order, so multi-step workflows are captured as a sequence.
 */
function signatures(rawCommand) {
  if (!rawCommand) return [];
  return rawCommand
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(classifyOne)
    .filter(Boolean);
}

const SEP = "";

/**
 * Count how many times the last-k block of `seq` repeats contiguously,
 * walking backwards from the end. e.g. [a,b,a,b,a,b] with k=2 -> 3.
 */
function trailingRepeats(seq, k) {
  const n = seq.length;
  if (k <= 0 || k > n) return 0;
  const block = seq.slice(n - k).join(SEP);
  let reps = 0;
  let pos = n;
  while (pos - k >= 0) {
    if (seq.slice(pos - k, pos).join(SEP) === block) {
      reps++;
      pos -= k;
    } else break;
  }
  return reps;
}

/**
 * Inspect the ordered signature stream and decide what (if anything) to nudge.
 * Returns { kind: "composite"|"single", pattern: string[], reps } or null.
 * Prefers the largest multi-step (k>=2) workflow that has repeated THRESHOLD
 * times. While a multi-step pattern is still forming (>=2 reps but <THRESHOLD),
 * suppresses single-command nudges so the composite can win.
 */
function detect(seq, counts, threshold, kmax) {
  // 1. Largest completed multi-step workflow.
  for (let k = Math.min(kmax, Math.floor(seq.length / threshold)); k >= 2; k--) {
    if (trailingRepeats(seq, k) >= threshold) {
      return { kind: "composite", pattern: seq.slice(seq.length - k), reps: threshold };
    }
  }
  // 2. Multi-step workflow still forming -> stay silent this round.
  for (let k = Math.min(kmax, Math.floor(seq.length / 2)); k >= 2; k--) {
    if (trailingRepeats(seq, k) >= 2) return null;
  }
  // 3. Single-command repetition (total occurrences, need not be consecutive).
  const last = seq[seq.length - 1];
  if (last && (counts[last] || 0) >= threshold) {
    return { kind: "single", pattern: [last], reps: counts[last] };
  }
  return null;
}

function loadState(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { sessions: {} };
  }
}

function saveState(file, state) {
  // Cap growth: if too many sessions, keep only the current one.
  const ids = Object.keys(state.sessions);
  if (ids.length > MAX_SESSIONS) {
    const keep = state.__current;
    state.sessions = keep && state.sessions[keep] ? { [keep]: state.sessions[keep] } : {};
  }
  delete state.__current;
  writeFileSync(file, JSON.stringify(state), "utf8");
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0); // malformed input — do nothing
  }

  if (input.tool_name !== "Bash") process.exit(0);
  const command = input.tool_input?.command || "";
  const sigs = signatures(command);
  if (sigs.length === 0) process.exit(0);

  const sessionId = input.session_id || "default";
  const dir = join(homedir(), ".claude", "omakase-state");
  const file = join(dir, "repetition.json");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    process.exit(0);
  }

  const state = loadState(file);
  state.__current = sessionId;
  const sess = (state.sessions[sessionId] ??= { counts: {}, seq: [], nudged: [] });
  if (!sess.seq) sess.seq = []; // migrate old state shape

  // Append this call's signatures (in order) to the stream and bump totals.
  for (const s of sigs) {
    sess.counts[s] = (sess.counts[s] || 0) + 1;
    sess.seq.push(s);
  }
  if (sess.seq.length > SEQ_CAP) sess.seq = sess.seq.slice(-SEQ_CAP);

  let context = null;
  const hit = detect(sess.seq, sess.counts, THRESHOLD, KMAX);
  if (hit) {
    const key =
      hit.kind === "composite" ? `seq:${hit.pattern.join(">")}` : `cmd:${hit.pattern[0]}`;
    if (!sess.nudged.includes(key)) {
      sess.nudged.push(key);
      if (hit.kind === "composite") {
        const flow = hit.pattern.map((s) => `\`${s}\``).join(" → ");
        context =
          `[omakase auto-detect] The user has repeated a multi-step workflow ${hit.reps} times this session: ${flow}. ` +
          `Per the omakase-chef skill, call the omakase.find_skill MCP tool describing this end-to-end workflow ` +
          `(not just one step), pick the single best match (prefer verified), and propose installing it in one ` +
          `sentence with WHY. Ask the user before installing. Do this once; do not show a menu. ` +
          `If find_skill returns nothing useful, offer omakase.propose_new_skill instead, or stay quiet.`;
      } else {
        context =
          `[omakase auto-detect] The user has run \`${hit.pattern[0]}\`-type commands ${hit.reps} times this ` +
          `session — a repeated manual task. Per the omakase-chef skill, call the omakase.find_skill MCP tool ` +
          `with a task description for this "${hit.pattern[0]}" workflow, pick the single best match (prefer ` +
          `verified), and propose installing it in one sentence with WHY. Ask the user before installing. ` +
          `Do this once; do not show a menu. If find_skill returns nothing useful, stay quiet.`;
      }
    }
  }

  try {
    saveState(file, state);
  } catch {
    /* best-effort */
  }

  if (context) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: context,
        },
      })
    );
  }
  process.exit(0);
}

main();
