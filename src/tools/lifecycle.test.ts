import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handle as uninstall, uninstallSkillInput } from "./uninstall-skill.js";
import { handle as doctor } from "./doctor.js";
import type { Entry } from "../types.js";

test("uninstall_skill: removes the skill dir and receipt, then is idempotent", async (t) => {
  const env = await isolate(t, []);
  await mkdir(join(env.skillsDir, "grill-me"), { recursive: true });
  await writeFile(join(env.skillsDir, "grill-me", "SKILL.md"), "x", "utf8");
  await mkdir(env.receiptsDir, { recursive: true });
  await writeFile(join(env.receiptsDir, "grill-me.json"), JSON.stringify({ id: "grill-me" }), "utf8");

  const first = await uninstall({ id: "grill-me" });
  assert.equal(first.ok, true);
  assert.ok(first.removed_dir, "reports the removed dir");
  assert.ok(first.removed_receipt, "reports the removed receipt");
  assert.equal(existsSync(join(env.skillsDir, "grill-me")), false, "dir gone");
  assert.equal(existsSync(join(env.receiptsDir, "grill-me.json")), false, "receipt gone");

  // Second call: nothing left, but still succeeds.
  const second = await uninstall({ id: "grill-me" });
  assert.equal(second.ok, true);
  assert.equal(second.removed_dir, null);
  assert.equal(second.removed_receipt, null);
});

test("uninstall_skill: input schema rejects path-traversal ids", () => {
  // Validation lives on the zod schema (applied by server.ts via .parse), so a
  // traversal id never reaches the rmSync in handle().
  assert.throws(() => uninstallSkillInput.parse({ id: "../etc" }));
  assert.throws(() => uninstallSkillInput.parse({ id: "/abs/path" }));
  assert.doesNotThrow(() => uninstallSkillInput.parse({ id: "grill-me" }));
});

test("doctor_skills: reports healthy vs broken installs", async (t) => {
  const env = await isolate(t, [
    {
      id: "grill-me",
      name: "Grill Me",
      type: "claude_code_skill",
      description: "Stress-test plans.",
      tags: ["starter-pack"],
      verified: true,
      version: "2",
      author: { name: "Test" },
      install: { skill_files: [{ source: "https://example.com/g/SKILL.md", target: "SKILL.md" }] },
      source: { adapter: "test" },
    },
  ]);

  // Healthy: dir + SKILL.md + receipt, and in catalog.
  await mkdir(join(env.skillsDir, "grill-me"), { recursive: true });
  await writeFile(join(env.skillsDir, "grill-me", "SKILL.md"), "x", "utf8");
  await mkdir(env.receiptsDir, { recursive: true });
  await writeFile(
    join(env.receiptsDir, "grill-me.json"),
    JSON.stringify({ id: "grill-me", source_version: "2" }),
    "utf8"
  );
  // Broken: dir with no SKILL.md, no receipt, not in catalog.
  await mkdir(join(env.skillsDir, "orphan"), { recursive: true });

  const result = await doctor();

  assert.equal(result.total, 2);
  assert.equal(result.healthy, 1);
  assert.equal(result.issues, 1);

  const byId = new Map(result.skills.map((s) => [s.id, s]));
  const healthy = byId.get("grill-me")!;
  assert.equal(healthy.skill_md_exists, true);
  assert.equal(healthy.receipt_exists, true);
  assert.equal(healthy.in_catalog, true);
  assert.equal(healthy.catalog_version, "2");
  assert.equal(healthy.installed_version, "2");

  const orphan = byId.get("orphan")!;
  assert.equal(orphan.skill_md_exists, false);
  assert.equal(orphan.receipt_exists, false);
  assert.equal(orphan.in_catalog, false);
});

test("doctor_skills: ignores bundled omakase-chef control skill", async (t) => {
  const env = await isolate(t, []);

  await mkdir(join(env.skillsDir, "omakase-chef"), { recursive: true });
  await writeFile(join(env.skillsDir, "omakase-chef", "SKILL.md"), "x", "utf8");

  const result = await doctor();

  assert.equal(result.total, 0);
  assert.equal(result.healthy, 0);
  assert.equal(result.issues, 0);
});

test("doctor_skills: ignores orphan hidden staging directories", async (t) => {
  const env = await isolate(t, []);

  await mkdir(join(env.skillsDir, ".tmp-demo-skill-abc"), { recursive: true });

  const result = await doctor();

  assert.equal(result.total, 0);
  assert.equal(result.healthy, 0);
  assert.equal(result.issues, 0);
});

interface Env {
  skillsDir: string;
  receiptsDir: string;
}

async function isolate(t: Parameters<typeof test>[1], entries: Entry[]): Promise<Env> {
  const root = await mkdtemp(join(tmpdir(), "omakase-lifecycle-"));
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
    JSON.stringify({ version: 1, generated_at: "2026-06-01T00:00:00.000Z", entries }),
    "utf8"
  );

  t.after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(root, { recursive: true, force: true });
  });

  return { skillsDir: join(root, "skills"), receiptsDir: join(root, "data", "claude-omakase", "installed") };
}
