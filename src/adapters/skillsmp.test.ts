import { test } from "node:test";
import assert from "node:assert/strict";
import { fetch as fetchSkillsmp, normalize } from "./skillsmp.js";

test("normalize: full hit with explicit skill_md_url", () => {
  const entry = normalize({
    id: "git-commit-helper",
    name: "Git Commit Helper",
    description: "Draft Conventional Commits messages from a staged diff.",
    tags: ["git", "commit"],
    categories: ["developer-tools"],
    author: { name: "alice", url: "https://github.com/alice" },
    skill_md_url: "https://raw.githubusercontent.com/alice/git-helper/main/SKILL.md",
    homepage: "https://skillsmp.com/skills/alice-git-helper-skill-md",
    license: "MIT",
    version: "0.3.1",
  });

  assert.ok(entry);
  assert.equal(entry!.id, "git-commit-helper");
  assert.equal(entry!.name, "Git Commit Helper");
  assert.equal(entry!.type, "claude_code_skill");
  assert.equal(entry!.verified, false);
  assert.equal(entry!.author.name, "alice");
  assert.equal(entry!.install.skill_files?.length, 1);
  assert.equal(
    entry!.install.skill_files?.[0]?.source,
    "https://raw.githubusercontent.com/alice/git-helper/main/SKILL.md"
  );
  assert.equal(entry!.install.skill_files?.[0]?.target, "SKILL.md");
  assert.ok(entry!.tags.includes("git"));
  assert.ok(entry!.tags.includes("skillsmp"));
  assert.equal(entry!.source.adapter, "skillsmp");
});

test("normalize: derives raw URL from owner/repo when skill_md_url is absent", () => {
  const entry = normalize({
    id: "pr-summarizer",
    name: "PR Summarizer",
    description: "Summarize a GitHub pull request into a concise changelog entry.",
    tags: ["github"],
    repository: "https://github.com/example/pr-summarizer",
  });

  assert.ok(entry);
  assert.equal(
    entry!.install.skill_files?.[0]?.source,
    "https://raw.githubusercontent.com/example/pr-summarizer/main/SKILL.md"
  );
});

test("normalize: returns null when there is no way to source SKILL.md", () => {
  const entry = normalize({
    id: "no-source",
    name: "No Source",
    description: "An entry with no link back to file contents.",
  });
  assert.equal(entry, null);
});

test("normalize: returns null when description is missing", () => {
  const entry = normalize({
    id: "x",
    name: "X",
    repository: "https://github.com/a/b",
  });
  assert.equal(entry, null);
});

test("normalize: slugifies name when id is absent", () => {
  const entry = normalize({
    name: "Mixed CASE name!",
    description: "x",
    skill_md_url: "https://example.com/SKILL.md",
  });
  assert.ok(entry);
  assert.equal(entry!.id, "mixed-case-name");
});

test("normalize: string author falls through", () => {
  const entry = normalize({
    id: "string-author",
    name: "x",
    description: "y",
    author: "bob",
    skill_md_url: "https://example.com/SKILL.md",
  });
  assert.equal(entry?.author.name, "bob");
});

test("fetch: unexpected response shape is logged and skipped", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logged: string[] = [];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ results: { not: "an array" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  console.error = (message?: unknown) => {
    logged.push(String(message));
  };

  try {
    const entries = await fetchSkillsmp();

    assert.deepEqual(entries, []);
    assert.ok(
      logged.some((line) =>
        /unexpected response shape: results\/data\/skills must be arrays/.test(line)
      )
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});
