import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fetch } from "./handpicked.js";

test("handpicked: skips malformed JSON files and keeps valid entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "omakase-handpicked-"));
  const originalDir = process.env["CLAUDE_OMAKASE_HANDPICKED_DIR"];
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (message?: unknown) => {
    logged.push(String(message));
  };
  process.env["CLAUDE_OMAKASE_HANDPICKED_DIR"] = dir;

  try {
    await writeFile(join(dir, "bad.json"), "{not valid json", "utf8");
    await writeFile(
      join(dir, "good.json"),
      JSON.stringify({
        id: "good-skill",
        name: "Good Skill",
        type: "claude_code_skill",
        description: "A valid handpicked entry.",
        tags: ["test"],
        verified: true,
        author: { name: "tester" },
        install: { skill_files: [] },
      }),
      "utf8"
    );

    const entries = await fetch();

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.id, "good-skill");
    assert.equal(entries[0]?.source.adapter, "handpicked");
    assert.equal(logged.length, 1);
    assert.match(logged[0]!, /handpicked: skipping bad\.json:/);
  } finally {
    console.error = originalError;
    if (originalDir === undefined) {
      delete process.env["CLAUDE_OMAKASE_HANDPICKED_DIR"];
    } else {
      process.env["CLAUDE_OMAKASE_HANDPICKED_DIR"] = originalDir;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
