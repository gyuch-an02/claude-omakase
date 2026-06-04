import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handle, setProfileInput } from "./set-profile.js";

test("set_profile: saves IDE preferences", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "omakase-set-profile-"));
  const originalConfig = process.env["XDG_CONFIG_HOME"];
  process.env["XDG_CONFIG_HOME"] = join(root, "config");

  t.after(async () => {
    if (originalConfig === undefined) delete process.env["XDG_CONFIG_HOME"];
    else process.env["XDG_CONFIG_HOME"] = originalConfig;
    await rm(root, { recursive: true, force: true });
  });

  const result = await handle(
    setProfileInput.parse({
      role: "data scientist",
      ides: ["Jupyter", "Claude Code"],
    })
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.profile.ides, ["Jupyter", "Claude Code"]);

  const saved = JSON.parse(
    await readFile(join(root, "config", "claude-omakase", "profile.json"), "utf8")
  ) as { ides?: string[] };
  assert.deepEqual(saved.ides, ["Jupyter", "Claude Code"]);
});
