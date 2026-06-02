import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./omakase-session-start.mjs", import.meta.url));

// Run the hook as a subprocess (it reads stdin, writes stdout) with an isolated
// HOME so state writes never touch the real ~/.claude/omakase-state.
function run(input, env = {}) {
  const res = spawnSync("node", [HOOK], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return res.stdout.trim();
}

function freshHome() {
  return mkdtempSync(join(tmpdir(), "omk-session-"));
}

test("fires on a fresh startup and injects SessionStart onboarding context", () => {
  const out = run(
    { session_id: "s1", source: "startup" },
    { HOME: freshHome(), OMAKASE_SESSION_COOLDOWN_HOURS: "0" }
  );
  const json = JSON.parse(out);
  assert.equal(json.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(json.hookSpecificOutput.additionalContext, /list_installed_skills/);
  assert.match(json.hookSpecificOutput.additionalContext, /starter pack/i);
});

test("stays silent on resume and compact (continuation, not a fresh start)", () => {
  for (const source of ["resume", "compact"]) {
    const out = run(
      { session_id: "s", source },
      { HOME: freshHome(), OMAKASE_SESSION_COOLDOWN_HOURS: "0" }
    );
    assert.equal(out, "", `source=${source} must emit nothing`);
  }
});

test("respects the cooldown window across consecutive startups", () => {
  const home = freshHome(); // default 24h cooldown
  const first = run({ session_id: "a", source: "startup" }, { HOME: home });
  assert.notEqual(first, "", "first startup fires");
  const second = run({ session_id: "b", source: "startup" }, { HOME: home });
  assert.equal(second, "", "second startup within cooldown is silent");
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
