import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handle } from "./list-installed.js";

// Regression: installed_count must count DISTINCT skills. An Omakase-installed
// skill produces both a receipt and a ~/.claude/skills dir; summing the two
// sources double-counts. Two skills (each with a receipt + a dir) → count 2.
test("list_installed_skills: installed_count counts distinct ids, not receipts + dirs", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "omakase-list-"));
  const saved = {
    data: process.env["XDG_DATA_HOME"],
    skills: process.env["CLAUDE_OMAKASE_SKILLS_DIR"],
  };
  process.env["XDG_DATA_HOME"] = join(root, "data");
  process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = join(root, "skills");

  const receiptsDir = join(root, "data", "claude-omakase", "installed");
  await mkdir(receiptsDir, { recursive: true });
  for (const id of ["grill-me", "quick-review"]) {
    await mkdir(join(root, "skills", id), { recursive: true });
    await writeFile(
      join(receiptsDir, `${id}.json`),
      JSON.stringify({ id, kind: "claude_code_skill", installed_at: "2026-06-01T00:00:00.000Z", entry_snapshot: {} }),
      "utf8"
    );
  }

  t.after(async () => {
    if (saved.data === undefined) delete process.env["XDG_DATA_HOME"];
    else process.env["XDG_DATA_HOME"] = saved.data;
    if (saved.skills === undefined) delete process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
    else process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = saved.skills;
    await rm(root, { recursive: true, force: true });
  });

  const result = await handle();

  assert.equal(result.receipts.length, 2, "two receipts");
  assert.equal(result.raw_skills_dir.length, 2, "two skill dirs");
  assert.equal(result.installed_count, 2, "distinct count is 2, not 4");
  assert.match(result.next_step, /2 skill/);
});

test("list_installed_skills: ignores bundled omakase-chef for fresh-user counts", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "omakase-list-"));
  const saved = {
    data: process.env["XDG_DATA_HOME"],
    skills: process.env["CLAUDE_OMAKASE_SKILLS_DIR"],
  };
  process.env["XDG_DATA_HOME"] = join(root, "data");
  process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = join(root, "skills");

  await mkdir(join(root, "skills", "omakase-chef"), { recursive: true });
  await mkdir(join(root, "data", "claude-omakase", "installed"), { recursive: true });
  await writeFile(
    join(root, "data", "claude-omakase", "installed", "omakase-chef.json"),
    JSON.stringify({ id: "omakase-chef" }),
    "utf8"
  );

  t.after(async () => {
    if (saved.data === undefined) delete process.env["XDG_DATA_HOME"];
    else process.env["XDG_DATA_HOME"] = saved.data;
    if (saved.skills === undefined) delete process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
    else process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = saved.skills;
    await rm(root, { recursive: true, force: true });
  });

  const result = await handle();

  assert.equal(result.receipts.length, 0);
  assert.equal(result.raw_skills_dir.length, 0);
  assert.equal(result.installed_count, 0);
  assert.match(result.next_step, /No skills installed/);
});

test("list_installed_skills: ignores orphan hidden staging directories", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "omakase-list-"));
  const saved = {
    data: process.env["XDG_DATA_HOME"],
    skills: process.env["CLAUDE_OMAKASE_SKILLS_DIR"],
  };
  process.env["XDG_DATA_HOME"] = join(root, "data");
  process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = join(root, "skills");

  await mkdir(join(root, "skills", ".tmp-demo-skill-abc"), { recursive: true });
  await mkdir(join(root, "skills", "real-skill"), { recursive: true });

  t.after(async () => {
    if (saved.data === undefined) delete process.env["XDG_DATA_HOME"];
    else process.env["XDG_DATA_HOME"] = saved.data;
    if (saved.skills === undefined) delete process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
    else process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = saved.skills;
    await rm(root, { recursive: true, force: true });
  });

  const result = await handle();

  assert.deepEqual(result.raw_skills_dir, ["real-skill"]);
  assert.equal(result.installed_count, 1);
});
