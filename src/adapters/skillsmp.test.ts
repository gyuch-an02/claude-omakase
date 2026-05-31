import { test } from "node:test";
import assert from "node:assert/strict";
import { fetch as fetchSkillsmp, normalize } from "./skillsmp.js";

test("normalize: real skillsmp hit with githubUrl tree path", () => {
  const entry = normalize({
    id: "tomevault-io-skills-registry-git-push",
    name: "git-push",
    author: "tomevault-io",
    description: "Push changes to a remote git repository.",
    githubUrl: "https://github.com/tomevault-io/skills-registry/tree/main/0x1abin--nanortc--git-push",
    skillUrl: "https://skillsmp.com/skills/tomevault-io-git-push",
    stars: 2,
  });

  assert.ok(entry);
  assert.equal(entry!.id, "tomevault-io-skills-registry-git-push");
  assert.equal(entry!.name, "git-push");
  assert.equal(entry!.author.name, "tomevault-io");
  assert.equal(entry!.type, "claude_code_skill");
  assert.equal(entry!.verified, false);
  assert.equal(entry!.source.adapter, "skillsmp");
  assert.equal(
    entry!.install.skill_files?.[0]?.source,
    "https://raw.githubusercontent.com/tomevault-io/skills-registry/main/0x1abin--nanortc--git-push/SKILL.md"
  );
  assert.equal(entry!.install.skill_files?.[0]?.target, "SKILL.md");
  assert.ok(entry!.tags.includes("skillsmp"));
});

test("normalize: plain repo githubUrl (no subpath) → root SKILL.md", () => {
  const entry = normalize({
    id: "simple-skill",
    name: "Simple Skill",
    description: "A simple skill.",
    githubUrl: "https://github.com/alice/simple-skill",
  });

  assert.ok(entry);
  assert.equal(
    entry!.install.skill_files?.[0]?.source,
    "https://raw.githubusercontent.com/alice/simple-skill/main/SKILL.md"
  );
});

test("normalize: returns null when githubUrl is absent", () => {
  const entry = normalize({
    id: "no-source",
    name: "No Source",
    description: "An entry with no githubUrl.",
  });
  assert.equal(entry, null);
});

test("normalize: returns null when description is missing", () => {
  const entry = normalize({
    id: "x",
    name: "X",
    githubUrl: "https://github.com/a/b",
  });
  assert.equal(entry, null);
});

test("normalize: slugifies name when id is absent", () => {
  const entry = normalize({
    name: "Mixed CASE name!",
    description: "x",
    githubUrl: "https://github.com/a/b",
  });
  assert.ok(entry);
  assert.equal(entry!.id, "mixed-case-name");
});

test("fetch: handles nested data.skills response shape", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: {
          skills: [
            {
              id: "test-skill",
              name: "Test Skill",
              author: "tester",
              description: "A test skill.",
              githubUrl: "https://github.com/tester/test-skill/tree/main/skill",
            },
          ],
        },
        meta: { total: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  try {
    const entries = await fetchSkillsmp();
    assert.ok(entries.length > 0, "should parse nested data.skills");
    assert.equal(entries[0]!.id, "test-skill");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetch: gracefully handles empty or malformed response", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logged: string[] = [];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  console.error = (msg?: unknown) => logged.push(String(msg));

  try {
    const entries = await fetchSkillsmp();
    assert.deepEqual(entries, []);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});
