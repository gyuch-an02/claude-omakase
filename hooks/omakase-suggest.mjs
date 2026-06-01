#!/usr/bin/env node
/**
 * Omakase proactive suggester — UserPromptSubmit hook.
 *
 * Distinct from two other paths:
 *   - omakase-repetition.mjs (PostToolUse): nudges after a task REPEATS 3x.
 *   - propose_new_skill (MCP tool): DRAFTS a brand-new skill when nothing exists.
 *
 * This hook reads each user prompt, matches it against the EXISTING catalog, and
 * if a not-yet-installed skill clearly fits the request, injects a one-shot
 * suggestion telling Claude to offer it. No explicit "find me a skill" needed.
 *
 * Anti-annoyance guards:
 *   - score threshold (a real tag/id/name hit, not a stray word)
 *   - suggest each skill at most once per session
 *   - cooldown: at most one suggestion every COOLDOWN prompts
 *   - skip trivial/short prompts
 *
 * State: ~/.claude/omakase-state/suggest.json. No network, no telemetry.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THRESHOLD = Number(process.env.OMAKASE_SUGGEST_THRESHOLD || 5);
const COOLDOWN = Number(process.env.OMAKASE_SUGGEST_COOLDOWN || 3); // prompts between suggestions
const MIN_PROMPT_CHARS = 12;

// Words too generic to imply any particular skill.
const STOP = new Set([
  "the", "a", "an", "to", "of", "and", "or", "for", "in", "on", "is", "it", "this",
  "that", "with", "my", "me", "i", "you", "do", "can", "how", "what", "please",
  "help", "want", "need", "make", "get", "use", "have", "be", "will", "should",
  "claude", "code", "skill", "skills", "omakase", "file", "files",
]);

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function catalogPath() {
  const base = process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache");
  const cached = join(base, "claude-omakase", "catalog.json");
  if (existsSync(cached)) return cached;
  // Fallback: catalog.json bundled next to the repo/package root (../ from hooks/).
  const bundled = join(dirname(fileURLToPath(import.meta.url)), "..", "catalog.json");
  return existsSync(bundled) ? bundled : null;
}

function loadCatalog() {
  const p = catalogPath();
  if (!p) return [];
  try {
    const data = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

function installedIds() {
  const dir = process.env["CLAUDE_OMAKASE_SKILLS_DIR"] || join(homedir(), ".claude", "skills");
  if (!existsSync(dir)) return new Set();
  try {
    return new Set(
      readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    );
  } catch {
    return new Set();
  }
}

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
  );
}

// Score how well an entry fits the prompt tokens. Tags and id are the strongest
// signals; name words are moderate. Generic/starter-pack tags don't count.
function scoreEntry(entry, tokens) {
  let score = 0;
  const reasons = [];
  const idWords = String(entry.id || "").toLowerCase().split(/[-_]/);
  for (const w of idWords) {
    if (tokens.has(w)) {
      score += 4;
      reasons.push(w);
    }
  }
  for (const tag of entry.tags || []) {
    const t = String(tag).toLowerCase();
    if (t === "starter-pack") continue;
    if (tokens.has(t)) {
      score += 3;
      reasons.push(t);
    }
  }
  for (const w of String(entry.name || "").toLowerCase().split(/\s+/)) {
    if (w.length >= 3 && tokens.has(w)) {
      score += 2;
      reasons.push(w);
    }
  }
  return { score, reasons: [...new Set(reasons)] };
}

function loadState(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { sessions: {} };
  }
}

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0);
  }

  const prompt = String(input.prompt || "").trim();
  if (prompt.length < MIN_PROMPT_CHARS) process.exit(0);

  const tokens = tokenize(prompt);
  if (tokens.size === 0) process.exit(0);

  const catalog = loadCatalog();
  if (catalog.length === 0) process.exit(0);

  const installed = installedIds();
  const sessionId = input.session_id || "default";
  const dir = join(homedir(), ".claude", "omakase-state");
  const file = join(dir, "suggest.json");

  const state = loadState(file);
  const sess = (state.sessions[sessionId] ??= { suggested: [], sincelast: COOLDOWN });
  sess.sincelast = (sess.sincelast ?? 0) + 1;

  // Cooldown: only consider suggesting once every COOLDOWN prompts.
  let context = null;
  if (sess.sincelast >= COOLDOWN) {
    let best = null;
    for (const entry of catalog) {
      if (installed.has(entry.id)) continue;
      if (sess.suggested.includes(entry.id)) continue;
      const { score, reasons } = scoreEntry(entry, tokens);
      if (score >= THRESHOLD && (!best || score > best.score)) {
        best = { entry, score, reasons };
      }
    }
    if (best) {
      sess.suggested.push(best.entry.id);
      sess.sincelast = 0;
      const e = best.entry;
      const why = best.reasons.slice(0, 3).join(", ");
      context =
        `[omakase suggest] The user's request looks related to: ${why}. ` +
        `An installable skill matches and is NOT yet installed: "${e.name}" (id: ${e.id}) — ${e.description} ` +
        `If it genuinely fits what they're doing right now, mention it in ONE sentence with WHY and ask if they ` +
        `want it installed (omakase.install_skill, ask first). If it does not actually fit, say nothing and carry on. ` +
        `Do not show a list; this is a single optional suggestion.`;
    }
  }

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(state), "utf8");
  } catch {
    /* best-effort */
  }

  if (context) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: context,
        },
      })
    );
  }
  process.exit(0);
}

main();
