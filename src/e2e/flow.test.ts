// End-to-end scenario test for the omakase flow, driven at the TOOL layer.
//
// This is the reproducible, non-fragile verification the product promises:
//   MCP add → scan installed skills → recommend the one missing starter-pack
//   staple → user works → find_skill on a recurring task → install → when
//   nothing matches, propose_new_skill.
//
// It exercises the real tool handlers (no mocks of our own logic) against an
// isolated filesystem and a local catalog. It deliberately avoids the network:
//   - install uses catalog entries with empty `skill_files`, so the installer
//     writes a local stub instead of fetching over https.
//   - propose_new_skill uses `draft_body` (no sampling) and a body with no
//     npm/pip install commands, so no registry resolution is attempted.
// Both choices keep the test deterministic regardless of network state.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { handle as recommend } from "../tools/recommend.js";
import { handle as listInstalled } from "../tools/list-installed.js";
import { handle as installSkill } from "../tools/install-skill.js";
import { handle as findSkill } from "../tools/find-skill.js";
import { handle as proposeNewSkill } from "../tools/propose-new-skill.js";
import type { Entry } from "../types.js";

// Four starter-pack staples + one non-starter catalog entry. Empty skill_files
// keep install offline (writes a stub). Distinct tags make search deterministic.
const CATALOG: Entry[] = [
  starter("grill-me", "Grill Me", "Stress-test your plans with hard questions.", [
    "planning",
    "review",
  ]),
  starter("quick-review", "Quick Review", "Severity-tagged one-line code review.", [
    "code-review",
    "diff",
  ]),
  starter("understand-anything", "Understand Anything", "Explain unfamiliar code or docs.", [
    "explain",
    "docs",
  ]),
  starter("write-a-skill", "Write a Skill", "Scaffold a new Claude skill.", [
    "authoring",
    "scaffold",
  ]),
  // A non-starter, findable entry for the "recurring task" step.
  entry("pr-summarizer", "PR Summarizer", "Summarize a pull request diff into a review.", [
    "pull-request",
    "summarize",
    "github",
  ]),
];

test("omakase end-to-end flow: scan → gap → install → find → propose", async (t) => {
  const env = await isolate(t);

  // 1. Fresh machine, MCP just added: nothing installed.
  {
    const installed = await listInstalled();
    assert.equal(installed.receipts.length, 0, "no receipts on a fresh machine");
    assert.equal(installed.raw_skills_dir.length, 0, "no skill dirs on a fresh machine");
  }

  // 2. Chef scans with no specific ask → first-time starter-pack, ONE pick.
  {
    const rec = await recommend({ limit: 1 });
    assert.equal(rec.mode, "starter-pack");
    assert.equal(rec.recommendations.length, 1, "omakase serves exactly one");
    assert.match(rec.next_step, /one-sentence reason/i);
  }

  // 3. User installs three of the four starter staples (by hand, over a session).
  for (const id of ["grill-me", "quick-review", "understand-anything"]) {
    const res = await installSkill({ id, force: false, inputs: {} });
    assert.equal(res.ok, true, `install ${id}`);
    assert.ok(existsSync(join(env.skillsDir, id, "SKILL.md")), `${id} landed on disk`);
    assert.match(res.next_step, /trigger phrase/i, "install onboards with a trigger phrase");
  }

  // 4. Chef re-scans (still no explicit ask) → starter-pack-gap names the ONE
  //    missing staple, excluding everything installed.
  {
    const rec = await recommend({ limit: 1 });
    assert.equal(rec.mode, "starter-pack-gap", "incomplete pack → gap mode");
    assert.equal(rec.recommendations.length, 1);
    assert.equal(rec.recommendations[0]?.id, "write-a-skill", "surfaces the one missing staple");
    assert.deepEqual(rec.missing_starter_pack, ["write-a-skill"]);
  }

  // 4b. Regression guard for the profile bug: a saved profile must NOT suppress
  //     the gap nudge. With a profile but no explicit ask, gap still fires.
  {
    await writeProfile(env, { role: "frontend developer", languages: ["typescript"] });
    const rec = await recommend({ limit: 1 });
    assert.equal(
      rec.mode,
      "starter-pack-gap",
      "profile present but no ask → gap must still fire (regression: query.length gate)"
    );
    assert.equal(rec.recommendations[0]?.id, "write-a-skill");
  }

  // 5. Complete the pack → no gap left → falls through to verified-defaults,
  //    and the recommendation never repeats an installed skill.
  {
    await installSkill({ id: "write-a-skill", force: false, inputs: {} });
    const rec = await recommend({ limit: 1 });
    // Pack is complete, so the gap nudge must be gone. With the profile saved in
    // 4b still present, the mode is profile-search (verified-defaults only when
    // no profile/context steers it) — either way, never the gap mode again.
    assert.notEqual(rec.mode, "starter-pack-gap", "complete pack → no more gap nudge");
    const installedIds = new Set(["grill-me", "quick-review", "understand-anything", "write-a-skill"]);
    for (const r of rec.recommendations) {
      assert.ok(!installedIds.has(r.id), "never recommends an already-installed skill");
    }
  }

  // 6. User repeats a manual task; chef searches the catalog and finds a match.
  {
    const found = await findSkill({
      task_description: "summarize a github pull request diff",
      limit: 5,
    });
    assert.ok(found.matches.length > 0, "find_skill returns a match for a known task");
    assert.equal(found.matches[0]?.id, "pr-summarizer", "best match is the relevant skill");
    assert.match(found.next_step, /single best match/i);
  }

  // 7. No catalog match for a novel workflow → propose_new_skill drafts a file.
  {
    const found = await findSkill({
      task_description: "reconcile monthly invoices finance ledger zzqq",
      limit: 5,
    });
    assert.equal(found.matches.length, 0, "novel task has no catalog match");
    assert.match(found.next_step, /propose_new_skill/);

    const draft = await proposeNewSkill(
      {
        task_description: "Reconcile invoices against the internal ledger every month.",
        slug: "ledger-reconcile",
        triggers: ["reconcile invoices", "match the ledger"],
        draft_body: VALID_DRAFT,
      },
      {} as unknown as Server // draft_body path never touches the server.
    );
    assert.equal(draft.ok, true);
    assert.equal(draft.slug, "ledger-reconcile");
    assert.ok(existsSync(draft.path), "draft SKILL.md written to disk");
    const written = await readFile(draft.path, "utf8");
    assert.match(written, /name:\s*ledger-reconcile/);
  }
});

// A SKILL.md draft that passes validateSkillDraft and contains NO install
// commands (so no network registry check fires).
const VALID_DRAFT = `---
name: ledger-reconcile
description: Reconcile invoices against the internal ledger.
triggers:
  - "reconcile invoices"
  - "match the ledger"
---

# Ledger Reconcile

## What this skill does
Matches invoice line items against the internal ledger and flags mismatches.

## When to activate
When the user mentions reconciling invoices or matching the ledger.

## Steps
1. Read the invoice export.
2. Compare each line item to the ledger.
3. Report mismatches with amounts.

## Examples
User: "reconcile invoices for May"
Claude: lists mismatched line items with amounts.
`;

// ── helpers ────────────────────────────────────────────────────────────────

interface Env {
  root: string;
  skillsDir: string;
}

async function isolate(t: Parameters<typeof test>[1]): Promise<Env> {
  const root = await mkdtemp(join(tmpdir(), "omakase-scenario-"));
  const saved = {
    cache: process.env["XDG_CACHE_HOME"],
    config: process.env["XDG_CONFIG_HOME"],
    data: process.env["XDG_DATA_HOME"],
    skills: process.env["CLAUDE_OMAKASE_SKILLS_DIR"],
    remote: process.env["CLAUDE_OMAKASE_CATALOG_URL"],
  };

  const skillsDir = join(root, "skills");
  process.env["XDG_CACHE_HOME"] = join(root, "cache");
  process.env["XDG_CONFIG_HOME"] = join(root, "config");
  process.env["XDG_DATA_HOME"] = join(root, "data");
  process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = skillsDir;
  delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];

  await mkdir(skillsDir, { recursive: true });
  const catalogDir = join(root, "cache", "claude-omakase");
  await mkdir(catalogDir, { recursive: true });
  await writeFile(
    join(catalogDir, "catalog.json"),
    JSON.stringify({ version: 1, generated_at: "2026-05-31T00:00:00.000Z", entries: CATALOG }),
    "utf8"
  );

  t.after(async () => {
    restore("XDG_CACHE_HOME", saved.cache);
    restore("XDG_CONFIG_HOME", saved.config);
    restore("XDG_DATA_HOME", saved.data);
    restore("CLAUDE_OMAKASE_SKILLS_DIR", saved.skills);
    restore("CLAUDE_OMAKASE_CATALOG_URL", saved.remote);
    await rm(root, { recursive: true, force: true });
  });

  return { root, skillsDir };
}

async function writeProfile(env: Env, profile: Record<string, unknown>): Promise<void> {
  const dir = join(env.root, "config", "claude-omakase");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "profile.json"), JSON.stringify(profile), "utf8");
}

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function starter(id: string, name: string, description: string, extraTags: string[]): Entry {
  return entry(id, name, description, ["starter-pack", ...extraTags]);
}

function entry(id: string, name: string, description: string, tags: string[]): Entry {
  return {
    id,
    name,
    type: "claude_code_skill",
    description,
    tags,
    verified: true,
    author: { name: "Test" },
    install: { skill_files: [] },
    source: { adapter: "test" },
  };
}
