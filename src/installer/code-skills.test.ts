import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { install } from "./code-skills.js";
import type { Entry } from "../types.js";

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: "demo-skill",
  name: "Demo Skill",
  type: "claude_code_skill",
  description: "A skill used in installer tests.",
  tags: ["test"],
  verified: true,
  author: { name: "tester" },
  install: {
    skill_files: [
      {
        source: "https://example.com/SKILL.md",
        target: "SKILL.md",
      },
    ],
  },
  source: { adapter: "test" },
  ...overrides,
});

async function withSkillsDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "omakase-skills-"));
  const original = process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
  process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = dir;
  try {
    return await fn(dir);
  } finally {
    if (original === undefined) {
      delete process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
    } else {
      process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = original;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

function mockFetch(body = "skill body"): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  return () => {
    globalThis.fetch = original;
  };
}

test("install: rejects path traversal targets with a concrete error", async () => {
  await withSkillsDir(async () => {
    await assert.rejects(
      install(
        entry({
          install: {
            skill_files: [
              {
                source: "https://example.com/SKILL.md",
                target: "../etc/passwd",
              },
            ],
          },
        })
      ),
      /unsafe skill target path: \.\.\/etc\/passwd/
    );
  });
});

test("install: rejects a path-traversal entry id before touching the filesystem", async () => {
  await withSkillsDir(async (dir) => {
    const escapeTarget = join(dir, "..", "pwned");
    await assert.rejects(
      install(entry({ id: "../pwned" })),
      /unsafe skill id/
    );
    // The traversal target must NOT have been created or deleted.
    assert.equal(existsSync(escapeTarget), false, "must not create dirs outside the skills root");
  });
});

test("install: rejects non-https skill sources with a concrete error", async () => {
  await withSkillsDir(async () => {
    await assert.rejects(
      install(
        entry({
          install: {
            skill_files: [
              {
                source: "http://example.com/SKILL.md",
                target: "SKILL.md",
              },
            ],
          },
        })
      ),
      /skill source must be https:\/\/: http:\/\/example\.com\/SKILL\.md/
    );
  });
});

test("install: fails clearly when the skill directory already exists", async () => {
  await withSkillsDir(async (dir) => {
    const restoreFetch = mockFetch("first");
    try {
      await install(entry());
      await assert.rejects(
        install(entry()),
        new RegExp(
          `skill "demo-skill" already exists at ${escapeRegExp(
            join(dir, "demo-skill")
          )}; pass force: true to replace it`
        )
      );
    } finally {
      restoreFetch();
    }
  });
});

test("install: force replaces existing files and writes declared skill files", async () => {
  await withSkillsDir(async (dir) => {
    const restoreFetch = mockFetch("replacement body");
    try {
      const skillDir = join(dir, "demo-skill");
      await import("node:fs").then(({ mkdirSync, writeFileSync }) => {
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, "old.txt"), "old", "utf8");
      });

      const result = await install(entry(), { force: true });

      assert.equal(result.skillDir, skillDir);
      assert.equal(existsSync(join(skillDir, "old.txt")), false);
      assert.equal(readFileSync(join(skillDir, "SKILL.md"), "utf8"), "replacement body");
    } finally {
      restoreFetch();
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
