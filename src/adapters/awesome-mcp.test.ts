import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReadme, normalizeHit } from "./awesome-mcp.js";

const SAMPLE_README = `
# Awesome MCP Servers

## 📁 File Systems

- [mcp-filesystem](https://github.com/alice/mcp-filesystem) - Access local files safely
- [s3-mcp](https://github.com/bob/s3-mcp) - Read and write S3 buckets

## 🗄️ Databases

- [postgres-mcp](https://github.com/carol/postgres-mcp) - Run SQL against PostgreSQL
- [non-github](https://example.com/some-tool) - Not a github link, should be skipped

## Utilities

- **[git-mcp](https://github.com/dave/git-mcp)** - Interact with git repositories
`;

test("parseReadme: extracts list items with category tags", () => {
  const entries = parseReadme(SAMPLE_README);
  const fs = entries.find((e) => e.name === "mcp-filesystem");
  assert.ok(fs, "expected mcp-filesystem entry");
  assert.equal(fs!.type, "claude_code_skill");
  assert.equal(fs!.verified, false);
  assert.ok(fs!.tags.includes("mcp"));
  assert.ok(fs!.tags.includes("awesome-mcp"));
  assert.ok(fs!.tags.includes("file") || fs!.tags.includes("systems"), "category tags present");
});

test("parseReadme: skips non-github URLs", () => {
  const entries = parseReadme(SAMPLE_README);
  const skipped = entries.find((e) => e.description.includes("Not a github link"));
  assert.equal(skipped, undefined, "non-github entry should be skipped");
});

test("parseReadme: correct skill_files URL derived from github URL", () => {
  const entries = parseReadme(SAMPLE_README);
  const pg = entries.find((e) => e.name === "postgres-mcp");
  assert.ok(pg, "expected postgres-mcp");
  assert.equal(
    pg!.install.skill_files![0]!.source,
    "https://raw.githubusercontent.com/carol/postgres-mcp/main/SKILL.md"
  );
  assert.equal(pg!.install.skill_files![0]!.target, "SKILL.md");
});

test("parseReadme: deduplicates by id", () => {
  const dup = `
## A
- [foo](https://github.com/x/foo) - First
## B
- [foo](https://github.com/x/foo) - Second
`;
  const entries = parseReadme(dup);
  const foos = entries.filter((e) => e.id === "foo");
  assert.equal(foos.length, 1, "first occurrence wins");
  assert.equal(foos[0]!.description, "First");
});

test("parseReadme: bold list items parsed", () => {
  const entries = parseReadme(SAMPLE_README);
  const git = entries.find((e) => e.name === "git-mcp");
  assert.ok(git, "bold item should be parsed");
});

test("normalizeHit: null for non-github url", () => {
  const result = normalizeHit("Tool", "https://example.com/tool", "desc", "utils");
  assert.equal(result, null);
});

test("normalizeHit: null for empty description", () => {
  const result = normalizeHit("Tool", "https://github.com/x/y", "", "utils");
  assert.equal(result, null);
});

test("normalizeHit: author derived from github owner", () => {
  const result = normalizeHit("Tool", "https://github.com/myorg/my-tool", "desc", "utils");
  assert.ok(result);
  assert.equal(result!.author.name, "myorg");
  assert.equal(result!.author.url, "https://github.com/myorg");
});

test("parseReadme: HTML anchors in category headers do not leak into tags", () => {
  const readme = `
### <a name="developer-tools"></a>Developer Tools

- [jira-github-mcp](https://github.com/TamarEngel/jira-github-mcp) - Jira and GitHub integration
`;
  const entries = parseReadme(readme);
  const e = entries.find((x) => x.id === "jira-github-mcp");
  assert.ok(e, "expected jira-github-mcp entry");
  // No markup-polluted tags.
  for (const t of e!.tags) {
    assert.ok(!/[<>"'=/\\]/.test(t), `tag "${t}" must be markup-free`);
  }
  // The clean signal survives.
  assert.ok(e!.tags.includes("developer"));
  assert.ok(e!.tags.includes("tools"));
  assert.ok(e!.tags.includes("jira"));
});
