import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handle as doctor } from "./doctor.js";

test("doctor: healthy skill = non-empty SKILL.md + receipt", async (t) => {
  const env = await withState(t);
  await installSkill(env, "good-skill", "# real content\n");

  const res = await doctor();
  const skill = res.skills.find((s) => s.id === "good-skill");
  assert.ok(skill);
  assert.equal(skill.skill_md_exists, true);
  assert.equal(skill.skill_md_empty, false);
  assert.equal(skill.receipt_exists, true);
  assert.equal(res.healthy, 1);
  assert.equal(res.issues, 0);
});

test("doctor: a zero-byte SKILL.md is flagged, not counted healthy", async (t) => {
  const env = await withState(t);
  await installSkill(env, "hollow-skill", "");

  const res = await doctor();
  const skill = res.skills.find((s) => s.id === "hollow-skill");
  assert.ok(skill);
  assert.equal(skill.skill_md_exists, true);
  assert.equal(skill.skill_md_empty, true, "zero bytes → Claude Code ignores it");
  assert.equal(res.healthy, 0);
  assert.equal(res.issues, 1);
});

test("doctor: a receipt without a skill dir is an issue (skill_md missing)", async (t) => {
  const env = await withState(t);
  await writeReceipt(env, "ghost-skill");

  const res = await doctor();
  const skill = res.skills.find((s) => s.id === "ghost-skill");
  assert.ok(skill);
  assert.equal(skill.skill_md_exists, false);
  assert.equal(skill.skill_md_empty, false);
  assert.equal(res.issues, 1);
});

// --- helpers ---

interface Env {
  skillsDir: string;
  receiptsDir: string;
}

async function installSkill(env: Env, id: string, skillMd: string): Promise<void> {
  await mkdir(join(env.skillsDir, id), { recursive: true });
  await writeFile(join(env.skillsDir, id, "SKILL.md"), skillMd, "utf8");
  await writeReceipt(env, id);
}

async function writeReceipt(env: Env, id: string): Promise<void> {
  await mkdir(env.receiptsDir, { recursive: true });
  await writeFile(
    join(env.receiptsDir, `${id}.json`),
    JSON.stringify({ id, kind: "claude_code_skill", installed_at: "2026-06-11T00:00:00.000Z" }),
    "utf8"
  );
}

async function withState(t: Parameters<typeof test>[1]): Promise<Env> {
  const root = await mkdtemp(join(tmpdir(), "omakase-doctor-"));
  const saved: Record<string, string | undefined> = {};
  const set = (k: string, v: string) => {
    saved[k] = process.env[k];
    process.env[k] = v;
  };
  set("XDG_CACHE_HOME", join(root, "cache"));
  set("XDG_DATA_HOME", join(root, "data"));
  set("XDG_CONFIG_HOME", join(root, "config"));
  set("CLAUDE_OMAKASE_SKILLS_DIR", join(root, "skills"));
  saved["CLAUDE_OMAKASE_CATALOG_URL"] = process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];

  const catalogDir = join(root, "cache", "claude-omakase");
  await mkdir(catalogDir, { recursive: true });
  await writeFile(
    join(catalogDir, "catalog.json"),
    JSON.stringify({ version: 1, generated_at: "2026-06-11T00:00:00.000Z", entries: [] }),
    "utf8"
  );

  t.after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(root, { recursive: true, force: true });
  });

  return {
    skillsDir: join(root, "skills"),
    receiptsDir: join(root, "data", "claude-omakase", "installed"),
  };
}
