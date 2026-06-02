#!/usr/bin/env node
/**
 * Omakase repetition detector — hard hook (deterministic).
 *
 * Registered as a PostToolUse(Bash) hook. After every Bash command it:
 *   1. Cleans the command into coarse "task signatures" (first token of each
 *      real command segment), discarding heredoc bodies, shell keywords, and
 *      non-command fragments.
 *   2. Records each signature with a timestamp in ONE persistent file that
 *      spans sessions (not reset per session).
 *   3. When a signature recurs THRESHOLD times within a rolling time window —
 *      or a multi-step workflow repeats THRESHOLD times — it tells Claude to
 *      find a matching skill (asking before install).
 *
 * Cross-session by design: a task you do once per session across several days
 * still accumulates and eventually triggers. The command is never blocked.
 *
 * State: ~/.claude/omakase-state/repetition.json   (no network, no telemetry)
 * Tunables: OMAKASE_REPETITION_THRESHOLD (default 2)
 *           OMAKASE_REPETITION_WINDOW_DAYS (default 14)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const THRESHOLD = Number(process.env.OMAKASE_REPETITION_THRESHOLD || 2);
const WINDOW_MS = Number(process.env.OMAKASE_REPETITION_WINDOW_DAYS || 14) * 24 * 60 * 60 * 1000;
const KMAX = 8; // longest multi-step workflow (in signatures) we detect
const SEQ_CAP = 80; // cap the ordered signature stream
const MAX_SIGS = 800; // cap distinct tracked signatures

// Noise tokens: trivial commands, shell control-flow keywords, heredoc
// delimiters. A command name must also pass the COMMAND_RE shape test below,
// which already drops most fragments — this set covers real words that slip
// through (e.g. `test`, `time`, `for`).
const SKIP = new Set([
  "cd", "ls", "ll", "pwd", "echo", "cat", "head", "tail", "less", "more",
  "which", "whoami", "clear", "export", "source", "true", "false", "env",
  "mkdir", "touch", "cp", "mv", "rm", "chmod", "sleep", "printf", "read",
  "test", "time", "set", "unset", "eval", "exec", "trap", "declare", "wc",
  "do", "done", "then", "else", "elif", "fi", "case", "esac", "for", "while",
  "until", "if", "in", "function", "return", "break", "continue", "local",
  "EOF", "EOL", "HEREDOC", "END",
]);

// Tools where the second token is the meaningful verb.
const MULTI = new Set([
  "git", "npm", "npx", "pnpm", "yarn", "cargo", "docker", "kubectl",
  "gh", "go", "pip", "pip3", "poetry", "uv", "brew", "terraform",
]);

// A plausible command name: starts with a letter, then letters/digits/._-.
// Rejects fragments like `5.`, `##`, `)"`, `-d)`, `$NODE`, `mk()`, `auth"`.
const COMMAND_RE = /^[a-zA-Z][a-zA-Z0-9._-]*$/;

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
  // Drop leading env-var assignments like FOO=bar cmd ...
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  let head = tokens[i];
  if (!head) return null;

  // Strip path prefix: /usr/bin/pytest -> pytest
  head = head.split("/").pop();
  if (!head || !COMMAND_RE.test(head)) return null;
  if (SKIP.has(head)) return null;

  const next = tokens[i + 1];
  if (MULTI.has(head) && next && COMMAND_RE.test(next)) {
    return `${head} ${next}`;
  }
  return head;
}

/**
 * Decompose a command line into ordered task signatures. Heredoc bodies are
 * dropped entirely (everything from the first `<<` on), so prose lines never
 * become signatures. Chained commands yield one signature per segment.
 */
function signatures(rawCommand) {
  if (!rawCommand) return [];
  // Cut the heredoc body: keep only the command up to the first `<<`.
  const heredoc = rawCommand.indexOf("<<");
  const head = heredoc >= 0 ? rawCommand.slice(0, heredoc) : rawCommand;
  return head
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(classifyOne)
    .filter(Boolean);
}

const SEP = "";

/** How many times the last-k block of `seq` repeats contiguously from the end. */
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

function loadState(file) {
  try {
    const s = JSON.parse(readFileSync(file, "utf8"));
    return {
      events: s.events && typeof s.events === "object" ? s.events : {},
      seq: Array.isArray(s.seq) ? s.seq : [],
      nudged: Array.isArray(s.nudged) ? s.nudged : [],
    };
  } catch {
    return { events: {}, seq: [], nudged: [] };
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0);
  }
  if (input.tool_name !== "Bash") process.exit(0);

  const sigs = signatures(input.tool_input?.command || "");
  if (sigs.length === 0) process.exit(0);

  const now = Date.now();
  const dir = join(homedir(), ".claude", "omakase-state");
  const file = join(dir, "repetition.json");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    process.exit(0);
  }

  const state = loadState(file);

  // Record events (with timestamps) and the ordered stream.
  for (const sig of sigs) {
    (state.events[sig] ??= []).push(now);
    state.seq.push(sig);
  }
  // Prune each signature's timestamps to the rolling window; drop empties.
  for (const sig of Object.keys(state.events)) {
    const kept = state.events[sig].filter((t) => now - t <= WINDOW_MS);
    if (kept.length === 0) delete state.events[sig];
    else state.events[sig] = kept;
  }
  // Cap distinct signatures (keep the most recently active).
  const sigKeys = Object.keys(state.events);
  if (sigKeys.length > MAX_SIGS) {
    sigKeys
      .sort((a, b) => Math.max(...state.events[b]) - Math.max(...state.events[a]))
      .slice(MAX_SIGS)
      .forEach((k) => delete state.events[k]);
  }
  if (state.seq.length > SEQ_CAP) state.seq = state.seq.slice(-SEQ_CAP);

  // --- detect ---
  let context = null;
  let key = null;
  let payload = null;

  // 1. Multi-step workflow: largest k>=2 block that just repeated THRESHOLD times.
  for (let k = Math.min(KMAX, Math.floor(state.seq.length / THRESHOLD)); k >= 2; k--) {
    if (trailingRepeats(state.seq, k) >= THRESHOLD) {
      const pattern = state.seq.slice(state.seq.length - k);
      key = `seq:${pattern.join(">")}`;
      payload = { kind: "composite", pattern, reps: THRESHOLD };
      break;
    }
  }
  // 2. Single command recurring THRESHOLD times within the window.
  if (!payload) {
    const lastSig = sigs[sigs.length - 1];
    const count = state.events[lastSig]?.length ?? 0;
    if (count >= THRESHOLD) {
      key = `cmd:${lastSig}`;
      payload = { kind: "single", pattern: [lastSig], reps: count };
    }
  }

  if (payload && !state.nudged.includes(key)) {
    state.nudged.push(key);
    if (payload.kind === "composite") {
      const flow = payload.pattern.map((s) => `\`${s}\``).join(" → ");
      context =
        `[omakase auto-detect] The user has repeated a multi-step workflow ${payload.reps} times: ${flow}. ` +
        `Per the omakase-chef skill, call omakase.find_skill describing this end-to-end workflow (not just one step), ` +
        `pick the single best match (prefer verified), and propose installing it in one sentence with WHY. ` +
        `Ask before installing. Do this once; no menu. If nothing fits, offer omakase.propose_new_skill or stay quiet.`;
    } else {
      context =
        `[omakase auto-detect] The user has run \`${payload.pattern[0]}\`-type commands ${payload.reps} times ` +
        `(across recent sessions) — a recurring manual task. Per the omakase-chef skill, call omakase.find_skill with ` +
        `a task description for this "${payload.pattern[0]}" workflow, pick the single best match (prefer verified), ` +
        `and propose installing it in one sentence with WHY. Ask before installing. Do this once; no menu. ` +
        `If nothing fits, stay quiet.`;
    }
  }

  try {
    writeFileSync(file, JSON.stringify(state), "utf8");
  } catch {
    /* best-effort */
  }

  if (context) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context },
      })
    );
  }
  process.exit(0);
}

main();
