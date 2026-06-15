#!/usr/bin/env node
/**
 * Omakase repetition detector — hard hook (deterministic).
 *
 * Registered as a PostToolUse hook for Bash AND the edit tools (Edit / Write /
 * MultiEdit / NotebookEdit). Two kinds of recurring work are detected:
 *
 *   Bash commands — after every command it:
 *     1. Cleans the command into coarse "task signatures" (first token of each
 *        real command segment), discarding heredoc bodies, shell keywords, and
 *        non-command fragments.
 *     2. Records each signature with a timestamp in ONE persistent file that
 *        spans sessions (not reset per session).
 *     3. When a signature recurs THRESHOLD times within a rolling time window —
 *        or a multi-step workflow repeats THRESHOLD times — it tells Claude to
 *        find a matching skill (asking before install).
 *
 *   File edits — the Bash signal misses tasks that never touch the shell:
 *   repeatedly UPDATING A SPECIFIC DOC (changelog, status page, README) is a
 *   recurring chore a skill can replace, but it shows up as Edit/Write, not a
 *   command. So edit tools produce a signature `edit:<basename>`. Crucially we
 *   count each file AT MOST ONCE PER SESSION — iterating on a file within one
 *   session is normal coding, not a habit; editing the SAME doc across several
 *   separate sessions is the real recurring-task signal. (If the host omits
 *   session_id, the signature can't accumulate past 1, so edits simply never
 *   fire — safe, no false positives.)
 *
 *   NOTE: some recurring work (e.g. "summarize this PR") leaves no tool trace
 *   at all — neither a tracked command nor a file edit. That can only be caught
 *   at the LLM layer by the omakase-chef SKILL.md, not by this hook.
 *
 * Cross-session by design: a task you do once per session across several days
 * still accumulates and eventually triggers. The command/edit is never blocked.
 *
 * Noise discipline (so it fires when it MATTERS, not every run):
 *   - SKIP: primitive shell/text/file tools that are how you DO work, not a
 *     task a skill replaces (grep, cut, sort, find, jq, tar, ...).
 *   - DENY_SIG: VCS/build/pkg/infra plumbing subcommands (git status, npm run,
 *     gh pr, cargo build, ...). Analysis-flavored ones (git diff/blame/show)
 *     are kept — repeating those is a real "review this" signal.
 *   - THRESHOLD default 3 (a task isn't a habit at 2).
 *   - Catalog gate: stay silent if no catalog is available — find_skill would
 *     return nothing, so a nudge would just burn a turn.
 *
 * State: ~/.claude/omakase-state/repetition.json   (no network, no telemetry)
 * Tunables: OMAKASE_REPETITION_THRESHOLD (default 3)
 *           OMAKASE_REPETITION_WINDOW_DAYS (default 14)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readStdin,
  stateDir,
  catalogPath,
  writeStateAtomic,
} from "./_shared.mjs";

const THRESHOLD = Number(process.env.OMAKASE_REPETITION_THRESHOLD || 3);
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
  // Primitive text/file/system tools: the plumbing of doing work, never a task
  // a skill stands in for. Repeating these is noise, not a habit worth a nudge.
  "grep", "egrep", "fgrep", "rg", "ag", "cut", "sort", "uniq", "find", "fd",
  "xargs", "awk", "sed", "tee", "tr", "diff", "comm", "paste", "column",
  "basename", "dirname", "realpath", "readlink", "seq", "yes", "watch",
  "tar", "zip", "unzip", "gzip", "gunzip", "jq", "yq", "stat", "file", "tree",
  "ln", "ps", "kill", "pkill", "df", "du", "free", "uname", "hostname",
]);

// Tool subcommands that are pure plumbing — running them repeatedly is how you
// operate a repo/build/cluster, not a task a skill replaces. Matched against the
// full "head sub" signature. Analysis-flavored subcommands (git diff/blame/show)
// are deliberately NOT here: repeating those is a genuine "review this" signal.
const DENY_SIG = new Set([
  "git status", "git add", "git commit", "git push", "git pull", "git fetch",
  "git log", "git checkout", "git switch", "git branch", "git stash",
  "git config", "git remote", "git rebase", "git merge", "git reset",
  "git clone", "git restore", "git tag", "git init",
  "npm install", "npm i", "npm ci", "npm run", "npm test", "npm start",
  "npm build", "npm publish", "npm version", "npm audit", "npm update", "npm ls",
  "pnpm install", "pnpm run", "pnpm build", "pnpm test",
  "yarn install", "yarn run", "yarn build", "yarn test",
  "npx tsc", "npx eslint", "npx prettier", "npx vitest", "npx jest",
  "gh pr", "gh issue", "gh run", "gh repo", "gh auth", "gh api",
  "gh release", "gh workflow", "gh browse",
  "cargo build", "cargo test", "cargo run", "cargo check", "cargo fmt", "cargo clippy",
  "docker build", "docker run", "docker ps", "docker exec", "docker compose", "docker logs",
  "kubectl get", "kubectl apply", "kubectl describe", "kubectl logs", "kubectl delete",
  "pip install", "pip3 install", "poetry install", "uv pip", "uv run",
  "go build", "go test", "go run", "go mod", "go get",
]);

// Tools where the second token is the meaningful verb.
const MULTI = new Set([
  "git", "npm", "npx", "pnpm", "yarn", "cargo", "docker", "kubectl",
  "gh", "go", "pip", "pip3", "poetry", "uv", "brew", "terraform",
]);

// Interpreters running INLINE code (`node -e`, `python -c`, `bash -c`, `psql -c`,
// `ssh host "..."`). The body is ad-hoc one-off code, never a repeatable "task a
// skill replaces" — and worse, the old quote-blind splitter leaked words out of
// that body ("system", "const", "truncate") as fake signatures. We drop the
// whole segment: an interpreter whose argument is an inline script is not a
// workflow worth detecting.
const INLINE_EVAL_CMDS = new Set([
  "node", "deno", "bun", "python", "python3", "ruby", "perl", "php",
  "bash", "sh", "zsh", "fish", "ssh", "psql", "mysql", "sqlite3", "Rscript",
]);
const INLINE_EVAL_FLAGS = new Set(["-e", "-c", "--eval", "--exec", "--command"]);

// A plausible command name: starts with a letter, then letters/digits/._-.
// Rejects fragments like `5.`, `##`, `)"`, `-d)`, `$NODE`, `mk()`, `auth"`.
const COMMAND_RE = /^[a-zA-Z][a-zA-Z0-9._-]*$/;

// Edit-family tools whose target is a file path, not a command.
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

// Files whose repeated editing is plumbing/noise, not a recurring task a skill
// stands in for: lockfiles, and the omakase state/config this very hook writes.
const EDIT_SKIP = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "Cargo.lock",
  "poetry.lock", "uv.lock", "go.sum", ".gitignore",
  "session.json", "repetition.json", "suggest.json",
]);

// Build an edit signature from the tool input's file path. `edit:<basename>` so
// updating the SAME named doc (CHANGELOG.md, status.md) recurs to a signature,
// regardless of which dir it lives in. Returns null for noise / missing path.
function editSignature(toolInput) {
  const fp = toolInput?.file_path ?? toolInput?.notebook_path;
  if (!fp || typeof fp !== "string") return null;
  const base = fp.split("/").pop();
  if (!base || EDIT_SKIP.has(base)) return null;
  return `edit:${base}`;
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

  // Interpreter running an inline script (`python -c …`, `ssh host "…"`): the
  // argument is one-off code, not a task. Drop the whole segment so its words
  // never become signatures.
  if (INLINE_EVAL_CMDS.has(head)) {
    if (tokens.slice(i + 1).some((t) => INLINE_EVAL_FLAGS.has(t))) return null;
    // `ssh host "remote; cmds"` carries no eval flag but the quoted body is
    // still remote code we shouldn't mine — recording bare "ssh" is enough.
    if (head === "ssh") return "ssh";
  }

  const next = tokens[i + 1];
  if (MULTI.has(head) && next && COMMAND_RE.test(next)) {
    const sig = `${head} ${next}`;
    return DENY_SIG.has(sig) ? null : sig;
  }
  return DENY_SIG.has(head) ? null : head;
}

// Blank out the CONTENTS of single/double-quoted spans, keeping the quotes as
// empty "" / ''. Without this, a `;` `|` or `&&` INSIDE a quoted argument
// (`python -c "a; b"`, `grep "x|y"`) was treated as a command separator and the
// quoted words leaked out as fake signatures. The quote characters stay so a
// later token like `"const` still fails COMMAND_RE. Unbalanced trailing quote:
// blank to end of line.
function stripQuotedBodies(s) {
  let out = "";
  let quote = null;
  for (const ch of s) {
    if (quote) {
      if (ch === quote) {
        out += ch;
        quote = null;
      }
      // else: drop the body char
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Decompose a command line into ordered task signatures. Heredoc bodies are
 * dropped entirely (everything from the first `<<` on), so prose lines never
 * become signatures. Quoted argument bodies are blanked so separators inside
 * them don't fragment the line. Chained commands yield one signature per segment.
 */
function signatures(rawCommand) {
  if (!rawCommand) return [];
  // Cut the heredoc body: keep only the command up to the first `<<`.
  const heredoc = rawCommand.indexOf("<<");
  const head = heredoc >= 0 ? rawCommand.slice(0, heredoc) : rawCommand;
  return stripQuotedBodies(head)
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(classifyOne)
    .filter(Boolean);
}

const SEP = "";

// Build the injected note. Framing is DELIBERATELY non-imperative: a hard
// PostToolUse hook fires mid-task, so an order like "call find_skill, propose,
// ask" hijacks the agent loop on noise. Instead this is a quiet, ignorable
// observation — the default is to keep working; act ONLY if a skill obviously
// fits. The signature is shown so Claude can sanity-check it isn't a shell
// fragment before doing anything.
function buildNote(payload) {
  let what;
  if (payload.kind === "composite") {
    const flow = payload.pattern.map((s) => `\`${s}\``).join(" → ");
    what = `the multi-step sequence ${flow} (${payload.reps}×)`;
  } else if (payload.pattern[0].startsWith("edit:")) {
    what = `edits to \`${payload.pattern[0].slice("edit:".length)}\` across ${payload.reps} sessions`;
  } else {
    what = `\`${payload.pattern[0]}\`-type commands (${payload.reps}×)`;
  }
  return (
    `[omakase hint — optional, do not interrupt the current task] A possible recurring pattern: ${what}. ` +
    `FIRST judge whether this is a real, repeatable task worth a skill — if the signature looks like a shell/output ` +
    `fragment, a one-off, or unrelated to the user's actual goal, IGNORE this silently and keep working. ` +
    `Only if it is clearly a genuine recurring task AND you are already about to reply: you MAY, in one sentence, ` +
    `mention that omakase.find_skill could look for a skill, and ask if they want that. Never run a tool or stop ` +
    `the user's work just to act on this hint.`
  );
}

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

// Catalog gate: if there is no catalog to search, a nudge to call find_skill
// would return nothing — so stay silent rather than burn a turn. Uses the shared
// catalogPath (XDG cache first, bundled package copy second).
function catalogHasEntries() {
  const p = catalogPath();
  if (!p) return false;
  try {
    const data = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(data.entries) && data.entries.length > 0;
  } catch {
    return false;
  }
}

function loadState(file) {
  try {
    const s = JSON.parse(readFileSync(file, "utf8"));
    return {
      events: s.events && typeof s.events === "object" ? s.events : {},
      seq: Array.isArray(s.seq) ? s.seq : [],
      nudged: Array.isArray(s.nudged) ? s.nudged : [],
      // edit signature -> last session id that counted it (per-session dedupe).
      editSessions:
        s.editSessions && typeof s.editSessions === "object" ? s.editSessions : {},
    };
  } catch {
    return { events: {}, seq: [], nudged: [], editSessions: {} };
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0);
  }
  const toolName = input.tool_name;
  const isEdit = EDIT_TOOLS.has(toolName);
  if (toolName !== "Bash" && !isEdit) process.exit(0);

  const sigs = isEdit
    ? [editSignature(input.tool_input)].filter(Boolean)
    : signatures(input.tool_input?.command || "");
  if (sigs.length === 0) process.exit(0);

  const sessionId = String(input.session_id || "default");

  const now = Date.now();
  const file = join(stateDir(), "repetition.json");

  const state = loadState(file);

  // Record events (with timestamps) and the ordered stream.
  for (const sig of sigs) {
    if (isEdit) {
      // Count a file at most once per session: iterating on it within a single
      // session is normal coding, not a recurring chore. Editing the same doc
      // across separate sessions is the real signal. Edits never join `seq` —
      // they aren't ordered workflow steps.
      if (state.editSessions[sig] === sessionId) continue;
      state.editSessions[sig] = sessionId;
      (state.events[sig] ??= []).push(now);
    } else {
      (state.events[sig] ??= []).push(now);
      state.seq.push(sig);
    }
  }
  // Prune each signature's timestamps to the rolling window; drop empties.
  for (const sig of Object.keys(state.events)) {
    const kept = state.events[sig].filter((t) => now - t <= WINDOW_MS);
    if (kept.length === 0) delete state.events[sig];
    else state.events[sig] = kept;
  }
  // Drop per-session edit markers whose signature aged out of the window.
  for (const sig of Object.keys(state.editSessions)) {
    if (!state.events[sig]) delete state.editSessions[sig];
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

  // Catalog gate: only commit to a nudge if there's a catalog to search. When
  // absent we leave `key` UNmarked so the same workflow can still trigger later
  // once a catalog exists — we just don't fire a fruitless find_skill now.
  if (payload && !state.nudged.includes(key) && catalogHasEntries()) {
    state.nudged.push(key);
    context = buildNote(payload);
  }

  try {
    writeStateAtomic(file, state);
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

// Exposed for tests; the hook itself still self-runs when invoked directly.
export { signatures, classifyOne, stripQuotedBodies, buildNote };

// Only consume stdin / exit when run as the hook entrypoint — importing this
// module in a test must not block on fd 0 or kill the test process.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
