import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./omakase-suggest.mjs", import.meta.url));

const ENTRY = {
  id: "python-cli",
  name: "Python CLI Helper",
  type: "claude_code_skill",
  description: "Build CLI tools in Python.",
  tags: ["python", "cli"],
  verified: true,
  author: { name: "test" },
  install: {},
  source: { adapter: "test" },
};

function freshHome() {
  return mkdtempSync(join(tmpdir(), "omk-sug-"));
}

// A temp XDG cache holding a catalog with the given entries. The hook reads this
// before the bundled package copy, so it fully controls what the test sees.
function makeCache(entries) {
  const cache = mkdtempSync(join(tmpdir(), "omk-cache-"));
  mkdirSync(join(cache, "claude-omakase"), { recursive: true });
  writeFileSync(
    join(cache, "claude-omakase", "catalog.json"),
    JSON.stringify({ version: 1, generated_at: "x", entries })
  );
  return cache;
}

function run(prompt, { home, cache, sessionId = "s1", env = {} } = {}) {
  const res = spawnSync("node", [HOOK], {
    input: JSON.stringify({ prompt, session_id: sessionId }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, XDG_CACHE_HOME: cache, ...env },
  });
  return res;
}

function ctxOf(stdout) {
  return JSON.parse(stdout.trim()).hookSpecificOutput.additionalContext;
}

test("a prompt matching a catalog skill nudges with id and WHY", () => {
  const home = freshHome();
  const cache = makeCache([ENTRY]);
  const out = run("help me build a python cli tool", { home, cache }).stdout.trim();
  const ctx = ctxOf(out);
  assert.match(ctx, /omakase suggest/);
  assert.match(ctx, /python-cli/);
  assert.match(ctx, /Python CLI Helper/);
});

test("a too-short prompt stays silent", () => {
  const home = freshHome();
  const cache = makeCache([ENTRY]);
  assert.equal(run("py cli", { home, cache }).stdout.trim(), "");
});

test("an unrelated prompt stays silent", () => {
  const home = freshHome();
  const cache = makeCache([ENTRY]);
  assert.equal(
    run("what is the weather forecast tomorrow", { home, cache }).stdout.trim(),
    ""
  );
});

test("the same skill is suggested at most once per session", () => {
  const home = freshHome();
  const cache = makeCache([ENTRY]);
  const env = { OMAKASE_SUGGEST_COOLDOWN: "1" };
  assert.notEqual(
    run("build a python cli tool", { home, cache, env }).stdout.trim(),
    "",
    "first prompt suggests"
  );
  assert.equal(
    run("another python cli tool please", { home, cache, env }).stdout.trim(),
    "",
    "already suggested this session → silent"
  );
});

test("an already-installed skill is never suggested", () => {
  const home = freshHome();
  mkdirSync(join(home, ".claude", "skills", "python-cli"), { recursive: true });
  const cache = makeCache([ENTRY]);
  assert.equal(run("build a python cli tool", { home, cache }).stdout.trim(), "");
});

test("control characters in catalog text are stripped from the nudge", () => {
  const home = freshHome();
  const cache = makeCache([{ ...ENTRY, name: "Python\nCLI\tHelper" }]);
  const ctx = ctxOf(run("build a python cli tool", { home, cache }).stdout.trim());
  assert.doesNotMatch(ctx, /\n|\t/, "raw newlines/tabs must not reach the nudge");
  assert.match(ctx, /Python CLI Helper/, "collapsed to single spaces");
});

test("tracked sessions are pruned to the cap (suggest.json can't grow unbounded)", () => {
  const home = freshHome();
  const cache = makeCache([ENTRY]);
  // Seed 5 old sessions, then run a 6th with a cap of 2.
  const stateDir = join(home, ".claude", "omakase-state");
  mkdirSync(stateDir, { recursive: true });
  const sessions = {};
  for (let i = 0; i < 5; i++) sessions[`old${i}`] = { suggested: [], sincelast: 0, ts: i + 1 };
  writeFileSync(join(stateDir, "suggest.json"), JSON.stringify({ sessions }));
  run("build a python cli tool", {
    home,
    cache,
    sessionId: "new",
    env: { OMAKASE_SUGGEST_MAX_SESSIONS: "2" },
  });
  const state = JSON.parse(readFileSync(join(stateDir, "suggest.json"), "utf8"));
  const ids = Object.keys(state.sessions);
  assert.equal(ids.length, 2, "pruned to MAX_SESSIONS");
  assert.ok(ids.includes("new"), "the current session is kept");
});

test("state is written as valid parseable JSON (atomic write)", () => {
  const home = freshHome();
  const cache = makeCache([ENTRY]);
  run("build a python cli tool", { home, cache });
  const raw = readFileSync(join(home, ".claude", "omakase-state", "suggest.json"), "utf8");
  assert.doesNotThrow(() => JSON.parse(raw));
});

test("malformed stdin exits cleanly without output", () => {
  const res = spawnSync("node", [HOOK], {
    input: "not json",
    encoding: "utf8",
    env: { ...process.env, HOME: freshHome() },
  });
  assert.equal(res.status, 0);
  assert.equal(res.stdout.trim(), "");
});
