import { test } from "node:test";
import assert from "node:assert/strict";

import { fetch as fetchGithubSkills, normalizeGithubSkills } from "./github-skills.js";

test("normalizeGithubSkills: creates an installable entry", () => {
  const entry = normalizeGithubSkills({
    id: "example-skill",
    name: "Example Skill",
    description: "Example fixture from github-skills.",
    author: "Example Publisher",
    skill_md_url: "https://raw.githubusercontent.com/example/skills/main/example-skill/SKILL.md",
    homepage: "https://github.com/example/skills/tree/main/example-skill",
    tags: ["example", "example"],
  });

  assert.ok(entry);
  assert.equal(entry.id, "example-skill");
  assert.equal(entry.verified, false);
  assert.equal(entry.source.adapter, "github-skills");
  assert.deepEqual(entry.tags, ["example"]);
  assert.equal(entry.install.skill_files?.[0]?.target, "SKILL.md");
});

test("normalizeGithubSkills: skips entries without an HTTPS SKILL.md URL", () => {
  assert.equal(
    normalizeGithubSkills({
      id: "bad-skill",
      name: "Bad Skill",
      description: "Missing a safe source URL.",
      skill_md_url: "http://example.com/SKILL.md",
    }),
    null
  );
});

test("fetchGithubSkills: searches GitHub and parses SKILL.md frontmatter", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env["GITHUB_TOKEN"];
  const calls: string[] = [];
  process.env["GITHUB_TOKEN"] = "test-token";

  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);

    if (url.startsWith("https://api.github.com/search/code")) {
      return new Response(
        JSON.stringify({
          items: [
            {
              name: "SKILL.md",
              path: "skills/release-notes/SKILL.md",
              html_url:
                "https://github.com/acme/claude-skills/blob/main/skills/release-notes/SKILL.md",
              repository: {
                full_name: "acme/claude-skills",
                html_url: "https://github.com/acme/claude-skills",
                owner: { login: "acme" },
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (
      url ===
      "https://raw.githubusercontent.com/acme/claude-skills/main/skills/release-notes/SKILL.md"
    ) {
      return new Response(
        `---
name: release-notes
description: Format internal sprint release notes.
triggers:
  - "format release notes"
  - "sprint notes"
---

# Release Notes
`,
        { status: 200, headers: { "content-type": "text/markdown" } }
      );
    }

    return new Response("not found", { status: 404 });
  };

  try {
    const entries = await fetchGithubSkills();

    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.id, "acme-claude-skills-skills-release-notes");
    assert.equal(entries[0]!.name, "release-notes");
    assert.equal(entries[0]!.description, "Format internal sprint release notes.");
    assert.equal(entries[0]!.author.name, "acme");
    assert.equal(entries[0]!.source.adapter, "github-skills");
    assert.equal(
      entries[0]!.install.skill_files?.[0]?.source,
      "https://raw.githubusercontent.com/acme/claude-skills/main/skills/release-notes/SKILL.md"
    );
    assert.ok(entries[0]!.tags.includes("github-skills"));
    assert.ok(entries[0]!.tags.includes("format-release-notes"));
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreToken(originalToken);
  }
});

test("fetchGithubSkills: skips raw files without description frontmatter", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env["GITHUB_TOKEN"];
  process.env["GITHUB_TOKEN"] = "test-token";

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.github.com/search/code")) {
      return new Response(
        JSON.stringify({
          items: [
            {
              path: "SKILL.md",
              html_url: "https://github.com/acme/no-description/blob/main/SKILL.md",
              repository: { full_name: "acme/no-description", owner: { login: "acme" } },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response("---\nname: no-description\n---\n", {
      status: 200,
      headers: { "content-type": "text/markdown" },
    });
  };

  try {
    const entries = await fetchGithubSkills();
    assert.deepEqual(entries, []);
  } finally {
    globalThis.fetch = originalFetch;
    restoreToken(originalToken);
  }
});

test("fetchGithubSkills: returns no entries when GITHUB_TOKEN is absent", async () => {
  const originalToken = process.env["GITHUB_TOKEN"];
  delete process.env["GITHUB_TOKEN"];

  try {
    const entries = await fetchGithubSkills();
    assert.deepEqual(entries, []);
  } finally {
    restoreToken(originalToken);
  }
});

function restoreToken(value: string | undefined): void {
  if (value === undefined) delete process.env["GITHUB_TOKEN"];
  else process.env["GITHUB_TOKEN"] = value;
}
