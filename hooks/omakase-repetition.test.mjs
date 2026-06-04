import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./omakase-repetition.mjs", import.meta.url));

// Run the hook once with a Bash command. HOME isolates the repetition state file
// so counts never touch the real ~/.claude/omakase-state.
function run(command, home, env = {}) {
  const res = spawnSync("node", [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, ...env },
  });
  return res.stdout.trim();
}

function freshHome() {
  return mkdtempSync(join(tmpdir(), "omk-rep-"));
}

// Run the hook once with an edit-tool call (Edit/Write/...). session_id drives
// the per-session dedupe: same file in the same session counts once.
function runEdit(filePath, home, sessionId, toolName = "Edit") {
  const res = spawnSync("node", [HOOK], {
    input: JSON.stringify({
      tool_name: toolName,
      tool_input: { file_path: filePath },
      session_id: sessionId,
    }),
    encoding: "utf8",
    env: { ...process.env, HOME: home },
  });
  return res.stdout.trim();
}

// Fire `command` `times` times against the same HOME; return the last output.
function repeat(command, times, home, env = {}) {
  let out = "";
  for (let i = 0; i < times; i++) out = run(command, home, env);
  return out;
}

test("a real domain command repeated to threshold nudges once", () => {
  const home = freshHome();
  assert.equal(run("pytest tests/", home), "", "1st run silent");
  assert.equal(run("pytest tests/", home), "", "2nd run silent (default threshold 3)");
  const third = run("pytest tests/", home);
  const json = JSON.parse(third);
  assert.match(json.hookSpecificOutput.additionalContext, /omakase auto-detect/);
  assert.match(json.hookSpecificOutput.additionalContext, /pytest/);
  // Already nudged for this signature → stays silent on the 4th.
  assert.equal(run("pytest tests/", home), "", "no re-nudge for the same signature");
});

test("primitive text/file tools never nudge (SKIP)", () => {
  for (const cmd of ["grep -r foo .", "cut -d, -f1 x.csv", "sort x | uniq", "find . -name '*.ts'"]) {
    const home = freshHome();
    assert.equal(repeat(cmd, 5, home), "", `${cmd} must stay silent`);
  }
});

test("VCS/build plumbing subcommands never nudge (DENY_SIG)", () => {
  for (const cmd of ["git status", "git commit -m x", "npm run build", "gh pr view 1", "cargo build"]) {
    const home = freshHome();
    assert.equal(repeat(cmd, 5, home), "", `${cmd} must stay silent`);
  }
});

test("analysis-flavored git subcommands are kept (git diff is a review signal)", () => {
  const home = freshHome();
  const out = repeat("git diff HEAD~1", 3, home);
  assert.notEqual(out, "", "git diff repeated should nudge");
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /git diff/);
});

test("a repeated multi-step workflow nudges as a composite", () => {
  const home = freshHome();
  // pytest then ruff: a two-step domain workflow (neither is denied/skipped).
  const out = repeat("pytest && ruff check", 3, home);
  const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(ctx, /multi-step workflow/);
  assert.match(ctx, /pytest/);
  assert.match(ctx, /ruff/);
});

test("below threshold stays silent", () => {
  const home = freshHome();
  assert.equal(repeat("pytest tests/", 2, home), "", "2 reps under default threshold 3");
});

test("catalog gate: no usable catalog → no nudge", () => {
  const home = freshHome();
  // Point the cache at an EMPTY catalog so catalogHasEntries() is false. This
  // takes precedence over the bundled package copy, simulating an unbuilt env.
  const cache = mkdtempSync(join(tmpdir(), "omk-cache-"));
  mkdirSync(join(cache, "claude-omakase"), { recursive: true });
  writeFileSync(join(cache, "claude-omakase", "catalog.json"), JSON.stringify({ entries: [] }));
  const out = repeat("pytest tests/", 4, home, { XDG_CACHE_HOME: cache });
  assert.equal(out, "", "empty catalog suppresses the nudge");
});

test("editing the same doc across separate sessions nudges once", () => {
  const home = freshHome();
  assert.equal(runEdit("/repo/docs/CHANGELOG.md", home, "s1"), "", "session 1 silent");
  assert.equal(runEdit("/repo/docs/CHANGELOG.md", home, "s2"), "", "session 2 silent");
  const third = runEdit("/repo/docs/CHANGELOG.md", home, "s3");
  const ctx = JSON.parse(third).hookSpecificOutput.additionalContext;
  assert.match(ctx, /omakase auto-detect/);
  assert.match(ctx, /CHANGELOG\.md/);
  assert.match(ctx, /separate sessions/);
  // Already nudged → silent on a 4th session.
  assert.equal(runEdit("/repo/docs/CHANGELOG.md", home, "s4"), "", "no re-nudge");
});

test("path differs but basename matches → same signature accumulates", () => {
  const home = freshHome();
  runEdit("/a/STATUS.md", home, "s1");
  runEdit("/b/STATUS.md", home, "s2");
  const out = runEdit("/c/STATUS.md", home, "s3");
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /STATUS\.md/);
});

test("repeated edits WITHIN one session are normal coding, never nudge", () => {
  const home = freshHome();
  // 5 edits to the same file in the same session = 1 count → below threshold.
  let out = "";
  for (let i = 0; i < 5; i++) out = runEdit("/repo/src/server.ts", home, "same-session");
  assert.equal(out, "", "iterating on a file in one session must stay silent");
});

test("missing session_id can't accumulate past 1 (safe: edits never fire)", () => {
  const home = freshHome();
  let out = "";
  for (let i = 0; i < 5; i++) {
    const res = spawnSync("node", [HOOK], {
      input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: "/r/NOTES.md" } }),
      encoding: "utf8",
      env: { ...process.env, HOME: home },
    });
    out = res.stdout.trim();
  }
  assert.equal(out, "", "no session_id → single bucket → never reaches threshold");
});

test("lockfiles and omakase state files are edit-noise (EDIT_SKIP)", () => {
  for (const f of ["/r/package-lock.json", "/r/yarn.lock", "/r/Cargo.lock"]) {
    const home = freshHome();
    let out = "";
    for (let i = 0; i < 4; i++) out = runEdit(f, home, `s${i}`);
    assert.equal(out, "", `${f} must stay silent`);
  }
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
