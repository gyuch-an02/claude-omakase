import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReadme, normalizeMatch } from "./mcp-servers-repo.js";

const SAMPLE_README = `
# MCP Servers

## 🌐 Reference Servers

These servers are built by Anthropic.

| Name | Description |
|------|-------------|
| [Filesystem](src/filesystem) | Read/write local files with configurable access controls |
| [GitHub](https://github.com/example/mcp-github) | Interact with GitHub repositories, issues and PRs |

### Additional

- **[Brave Search](src/brave-search)** - Web and local search via the Brave API
- [Postgres](src/postgres) - Read-only SQL query access to PostgreSQL databases

## Community

- [Weather](https://github.com/alice/mcp-weather) - Current conditions and forecasts
`;

test("parseReadme: extracts table rows", () => {
  const entries = parseReadme(SAMPLE_README);
  const fs = entries.find((e) => e.name === "Filesystem");
  assert.ok(fs, "expected Filesystem entry");
  assert.equal(fs!.type, "claude_code_skill");
  // Automated scrape of an official source: official provenance, NOT human-audited.
  assert.equal(fs!.verified, false);
  assert.equal(fs!.source_trust, "official");
  assert.ok(fs!.install.skill_files && fs!.install.skill_files.length > 0);
  assert.ok(
    fs!.install.skill_files![0]!.source.includes("filesystem/SKILL.md"),
    "skill_files source should derive from relative src/ path"
  );
  assert.ok(fs!.tags.includes("mcp"));
  assert.ok(fs!.tags.includes("mcp-servers-repo"));
});

test("parseReadme: extracts external GitHub links from table", () => {
  const entries = parseReadme(SAMPLE_README);
  const gh = entries.find((e) => e.name === "GitHub");
  assert.ok(gh, "expected GitHub entry");
  assert.ok(
    gh!.install.skill_files![0]!.source.includes("raw.githubusercontent.com/example/mcp-github"),
    "should derive raw URL from github.com link"
  );
});

test("parseReadme: extracts bold list items", () => {
  const entries = parseReadme(SAMPLE_README);
  const brave = entries.find((e) => e.name === "Brave Search");
  assert.ok(brave, "expected Brave Search entry");
  assert.ok(brave!.description.length > 0);
});

test("parseReadme: extracts plain list items", () => {
  const entries = parseReadme(SAMPLE_README);
  const pg = entries.find((e) => e.name === "Postgres");
  assert.ok(pg, "expected Postgres entry");
});

test("parseReadme: community section entries not duplicated", () => {
  const entries = parseReadme(SAMPLE_README);
  const weather = entries.find((e) => e.name === "Weather");
  assert.ok(weather);
  assert.equal(weather!.verified, false);
  assert.equal(weather!.source_trust, "official");
  const weatherCount = entries.filter((e) => e.name === "Weather").length;
  assert.equal(weatherCount, 1, "no duplicates");
});

test("normalizeMatch: returns null for empty description", () => {
  const result = normalizeMatch("Foo", "src/foo", "", "tools");
  assert.equal(result, null);
});

test("normalizeMatch: non-GitHub non-relative URL → no skill_files", () => {
  const result = normalizeMatch("Docs", "https://docs.example.com/page", "Some docs site", "docs");
  assert.ok(result);
  assert.deepEqual(result!.install.skill_files, []);
});

test("normalizeMatch: relative src/ path → correct raw URL", () => {
  const result = normalizeMatch("Slack", "src/slack", "Slack integration", "communication");
  assert.ok(result);
  assert.ok(
    result!.install.skill_files![0]!.source.endsWith("/src/slack/SKILL.md")
  );
});
