import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { handle } from "./propose-new-skill.js";

const validDraft = `---
name: safe-skill
description: Helps with a safe repeated workflow.
triggers:
  - "safe workflow"
---

## What this skill does

Keeps the workflow focused and repeatable.

## When to activate

Use when the user asks for safe workflow help.

## Steps

1. Confirm the goal.
2. Inspect the local files.
3. Make the smallest useful change.

## Examples

User: Help me run this workflow.
Claude: I will inspect the relevant files first, then make a focused change.
`;

test("propose_new_skill: sampling draft is validated before write", async (t) => {
  const skillsDir = await withTempSkillsDir(t);
  const server = fakeServer({
    content: { type: "text", text: validDraft },
  });

  const result = await handle(
    {
      task_description: "safe workflow helper for repeated local repository work",
      slug: "safe-skill",
      triggers: ["safe workflow"],
    },
    server
  );

  assert.equal(result.ok, true);
  assert.equal(result.slug, "safe-skill");
  assert.equal(existsSync(join(skillsDir, "safe-skill", "SKILL.md")), true);
});

test("propose_new_skill: host without sampling gets clear error and no file", async (t) => {
  const skillsDir = await withTempSkillsDir(t);
  const server = {} as Server;

  await assert.rejects(
    () =>
      handle(
        {
          task_description: "safe workflow helper for repeated local repository work",
          slug: "safe-skill",
          triggers: ["safe workflow"],
        },
        server
      ),
    /host does not support sampling\/createMessage/
  );

  assert.equal(existsSync(join(skillsDir, "safe-skill", "SKILL.md")), false);
});

test("propose_new_skill: malformed sampled draft is rejected before write", async (t) => {
  const skillsDir = await withTempSkillsDir(t);
  const server = fakeServer({
    content: { type: "text", text: "# Not a skill draft\n\nMissing frontmatter." },
  });

  await assert.rejects(
    () =>
      handle(
        {
          task_description: "safe workflow helper for repeated local repository work",
          slug: "safe-skill",
          triggers: ["safe workflow"],
        },
        server
      ),
    /draft must start with YAML frontmatter/
  );

  assert.equal(existsSync(join(skillsDir, "safe-skill", "SKILL.md")), false);
});

test("propose_new_skill: malformed draft_body is rejected before write", async (t) => {
  const skillsDir = await withTempSkillsDir(t);

  await assert.rejects(
    () =>
      handle(
        {
          task_description: "safe workflow helper for repeated local repository work",
          slug: "safe-skill",
          triggers: ["safe workflow"],
          draft_body: "# Not a skill draft\n\nMissing frontmatter.",
        },
        {} as Server
      ),
    /draft must start with YAML frontmatter/
  );

  assert.equal(existsSync(join(skillsDir, "safe-skill", "SKILL.md")), false);
});

test("propose_new_skill: unresolved install command is rejected before write", async (t) => {
  const skillsDir = await withTempSkillsDir(t);
  const server = fakeServer({
    content: {
      type: "text",
      text: validDraft.replace(
        "3. Make the smallest useful change.",
        "3. Run npm install definitely-not-a-real-omakase-package-xyz."
      ),
    },
  });

  await assert.rejects(
    () =>
      handle(
        {
          task_description: "safe workflow helper for repeated local repository work",
          slug: "safe-skill",
          triggers: ["safe workflow"],
        },
        server
      ),
    /unresolved npm package/
  );

  assert.equal(existsSync(join(skillsDir, "safe-skill", "SKILL.md")), false);
});

test("propose_new_skill: a failing concept-edit form does not fail the draft", async (t) => {
  const skillsDir = await withTempSkillsDir(t);
  const server = {
    getClientCapabilities: () => ({ elicitation: {} }),
    elicitInput: async () => {
      throw new Error("elicitation timed out");
    },
    createMessage: async () => ({ content: { type: "text", text: validDraft } }),
  } as never as Server;

  const result = await handle(
    {
      task_description: "safe workflow helper for repeated local repository work",
      slug: "safe-skill",
      triggers: ["safe workflow"],
    },
    server
  );

  assert.equal(result.ok, true);
  assert.equal(result.concept_edited, false);
  assert.match(result.concept_form_error ?? "", /form failed/i);
  assert.equal(existsSync(join(skillsDir, "safe-skill", "SKILL.md")), true);
});

test("propose_new_skill: an underivable slug is rejected before writing anywhere", async (t) => {
  const skillsDir = await withTempSkillsDir(t);

  // No explicit slug + a task_description with no ASCII alphanumerics →
  // slugify() yields "", which would otherwise write SKILL.md into the skills
  // ROOT (~/.claude/skills/SKILL.md).
  await assert.rejects(
    () =>
      handle(
        {
          task_description: "한국어로만 작성된 설명입니다",
          draft_body: validDraft,
        },
        {} as Server
      ),
    /could not derive a valid skill slug/
  );

  assert.equal(existsSync(join(skillsDir, "SKILL.md")), false, "must not write into the skills root");
});

async function withTempSkillsDir(t: Parameters<typeof test>[1]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "omakase-skills-"));
  const original = process.env["CLAUDE_OMAKASE_SKILLS_DIR"];

  process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = dir;
  t.after(async () => {
    if (original === undefined) {
      delete process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
    } else {
      process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = original;
    }
    await rm(dir, { recursive: true, force: true });
  });

  return dir;
}

function fakeServer(result: unknown): Server {
  return {
    createMessage: async () => result,
  } as Server;
}
