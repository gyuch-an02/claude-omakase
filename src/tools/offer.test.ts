import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handle as offer } from "./offer.js";
import { handle as findSkill } from "./find-skill.js";
import * as blocklist from "../blocklist.js";
import type { Entry } from "../types.js";

function fakeServer(opts: {
  elicitation?: boolean;
  result?: { action: string; content?: Record<string, unknown> };
  onElicit?: () => void;
}) {
  return {
    getClientCapabilities: () => (opts.elicitation ? { elicitation: {} } : {}),
    elicitInput: async () => {
      opts.onElicit?.();
      return opts.result ?? { action: "decline" };
    },
  } as never;
}

test("offer_skill: elicit 'install' installs the skill", async (t) => {
  const env = await withState(t, [entry("pr-helper")]);
  const res = await offer(
    { id: "pr-helper" },
    fakeServer({ elicitation: true, result: { action: "accept", content: { choice: "install" } } })
  );
  assert.equal(res.mode, "installed");
  assert.ok(existsSync(join(env.skillsDir, "pr-helper", "SKILL.md")));
});

test("offer_skill: elicit 'never' blocklists and excludes from find_skill", async (t) => {
  await withState(t, [entry("pr-helper", ["pullrequest", "review"])]);

  // Sanity: findable before blocking.
  const before = await findSkill({ task_description: "pullrequest review", limit: 5 });
  assert.ok(before.matches.some((m) => m.id === "pr-helper"), "found before blocking");

  const res = await offer(
    { id: "pr-helper" },
    fakeServer({ elicitation: true, result: { action: "accept", content: { choice: "never" } } })
  );
  assert.equal(res.mode, "never");
  assert.equal(blocklist.has("pr-helper"), true);

  const after = await findSkill({ task_description: "pullrequest review", limit: 5 });
  assert.equal(after.matches.some((m) => m.id === "pr-helper"), false, "excluded after 'never'");
});

test("offer_skill: no elicitation capability → mode ask", async (t) => {
  let elicited = false;
  await withState(t, [entry("pr-helper")]);
  const res = await offer({ id: "pr-helper" }, fakeServer({ elicitation: false, onElicit: () => (elicited = true) }));
  assert.equal(res.mode, "ask");
  assert.ok(res.skill?.id === "pr-helper");
  assert.equal(elicited, false);
});

test("offer_skill: explicit decision 'never' blocklists without eliciting", async (t) => {
  let elicited = false;
  await withState(t, [entry("pr-helper")]);
  const res = await offer(
    { id: "pr-helper", decision: "never" },
    fakeServer({ elicitation: true, onElicit: () => (elicited = true) })
  );
  assert.equal(res.mode, "never");
  assert.equal(blocklist.has("pr-helper"), true);
  assert.equal(elicited, false, "explicit decision skips the picker");
});

test("offer_skill: picker error surfaces loudly, installs nothing", async (t) => {
  const env = await withState(t, [entry("pr-helper")]);
  const server = {
    getClientCapabilities: () => ({ elicitation: {} }),
    elicitInput: async () => {
      throw new Error("elicitation timed out");
    },
  } as never;
  const res = await offer({ id: "pr-helper" }, server);
  assert.equal(res.mode, "picker-error");
  assert.match(res.next_step ?? "", /picker/i);
  assert.equal(existsSync(join(env.skillsDir, "pr-helper")), false, "nothing installed");
});

test("offer_skill: already-declined short-circuits", async (t) => {
  await withState(t, [entry("pr-helper")]);
  blocklist.add("pr-helper");
  const res = await offer({ id: "pr-helper" }, fakeServer({ elicitation: true }));
  assert.equal(res.mode, "already-declined");
});

// --- helpers ---

function entry(id: string, tags: string[] = ["misc"]): Entry {
  return {
    id,
    name: id,
    type: "claude_code_skill",
    description: `The ${id} skill for ${tags.join(" ")}.`,
    tags,
    verified: true,
    author: { name: "Test" },
    install: { skill_files: [] }, // empty → offline stub install
    source: { adapter: "test" },
  };
}

async function withState(t: Parameters<typeof test>[1], entries: Entry[]): Promise<{ skillsDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "omakase-offer-"));
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
