import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handle } from "./onboard.js";
import type { Entry } from "../types.js";

// Minimal fake MCP server exposing only what onboard.handle touches.
function fakeServer(opts: {
  elicitation?: boolean;
  elicitResult?: { action: string; content?: Record<string, unknown> };
  onElicit?: () => void;
}) {
  return {
    getClientCapabilities: () => (opts.elicitation ? { elicitation: {} } : {}),
    elicitInput: async () => {
      opts.onElicit?.();
      return opts.elicitResult ?? { action: "decline" };
    },
  } as never;
}

test("onboard_starter_pack: nothing missing → mode complete, no elicitation", async (t) => {
  let elicited = false;
  await withState(t, [starter("grill-me"), starter("quick-review")], ["grill-me", "quick-review"]);
  const res = await handle({}, fakeServer({ elicitation: true, onElicit: () => (elicited = true) }));
  assert.equal(res.mode, "complete");
  assert.equal(res.installed.length, 0);
  assert.equal(elicited, false, "should not elicit when nothing is missing");
});

test("onboard_starter_pack: no elicitation capability → markdown fallback", async (t) => {
  let elicited = false;
  await withState(t, [starter("grill-me"), starter("quick-review")], []);
  const res = await handle({}, fakeServer({ elicitation: false, onElicit: () => (elicited = true) }));
  assert.equal(res.mode, "markdown-fallback");
  assert.equal(res.present_as, "checklist");
  assert.ok(res.rendered && res.rendered.includes("Grill"), "rendered checklist present");
  assert.equal(res.candidates?.length, 2);
  assert.equal(elicited, false, "must not call elicitInput when unsupported");
});

test("onboard_starter_pack: elicitation accept installs exactly the checked skills", async (t) => {
  const env = await withState(t, [starter("grill-me"), starter("quick-review"), starter("write-a-skill")], []);
  const res = await handle(
    {},
    fakeServer({
      elicitation: true,
      elicitResult: { action: "accept", content: { "grill-me": true, "quick-review": false, "write-a-skill": true } },
    })
  );
  assert.equal(res.mode, "installed");
  const ids = res.installed.map((i) => i.id).sort();
  assert.deepEqual(ids, ["grill-me", "write-a-skill"]);
  assert.ok(existsSync(join(env.skillsDir, "grill-me", "SKILL.md")), "checked skill landed");
  assert.ok(existsSync(join(env.skillsDir, "write-a-skill", "SKILL.md")));
  assert.equal(existsSync(join(env.skillsDir, "quick-review")), false, "unchecked skill not installed");
});

test("onboard_starter_pack: declined picker installs nothing", async (t) => {
  const env = await withState(t, [starter("grill-me"), starter("quick-review")], []);
  const res = await handle({}, fakeServer({ elicitation: true, elicitResult: { action: "cancel" } }));
  assert.equal(res.mode, "declined");
  assert.equal(res.installed.length, 0);
  assert.equal(existsSync(join(env.skillsDir, "grill-me")), false);
});

// --- helpers ---

function starter(id: string): Entry {
  return {
    id,
    name: id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
    type: "claude_code_skill",
    description: `The ${id} skill.`,
    tags: ["starter-pack"],
    verified: true,
    author: { name: "Test" },
    install: { skill_files: [] }, // empty → offline stub install, no network
    source: { adapter: "test" },
  };
}

async function withState(
  t: Parameters<typeof test>[1],
  entries: Entry[],
  installedSkillDirs: string[]
): Promise<{ skillsDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "omakase-onboard-"));
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

  for (const id of installedSkillDirs) {
    await mkdir(join(root, "skills", id), { recursive: true });
  }
  const catalogDir = join(root, "cache", "claude-omakase");
  await mkdir(catalogDir, { recursive: true });
  await writeFile(
    join(catalogDir, "catalog.json"),
    JSON.stringify({ version: 1, generated_at: "2026-06-02T00:00:00.000Z", entries }),
    "utf8"
  );

  t.after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(root, { recursive: true, force: true });
  });

  return { skillsDir: join(root, "skills") };
}
