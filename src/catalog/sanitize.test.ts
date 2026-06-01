import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTags, sanitizeCatalog } from "./sanitize.js";
import type { Catalog } from "../types.js";

test("sanitizeTags drops HTML/markup-polluted tokens, keeps clean ones", () => {
  const dirty = [
    "mcp",
    "<a",
    'name="developer',
    'tools"><',
    "a>developer",
    "tools",
    "jira",
    "github",
  ];
  assert.deepEqual(sanitizeTags(dirty), ["mcp", "tools", "jira", "github"]);
});

test("sanitizeTags lowercases, dedupes, and drops single chars", () => {
  assert.deepEqual(sanitizeTags(["GitHub", "github", "x", "Node.js"]), ["github", "node.js"]);
});

test("sanitizeTags keeps tech tokens with allowed punctuation", () => {
  assert.deepEqual(sanitizeTags(["c++", "c#", "code-review"]), ["c++", "c#", "code-review"]);
});

test("sanitizeTags tolerates undefined", () => {
  assert.deepEqual(sanitizeTags(undefined), []);
});

test("sanitizeCatalog cleans every entry's tags", () => {
  const cat: Catalog = {
    version: 1,
    generated_at: "2026-06-01T00:00:00.000Z",
    entries: [
      {
        id: "jira-github-mcp",
        name: "TamarEngel/jira-github-mcp",
        type: "claude_code_skill",
        description: "Jira + GitHub.",
        tags: ["mcp", "<a", 'name="developer', "jira"],
        verified: false,
        author: { name: "x" },
        install: { skill_files: [] },
        source: { adapter: "awesome-mcp" },
      },
    ],
  };
  const clean = sanitizeCatalog(cat);
  assert.deepEqual(clean.entries[0]?.tags, ["mcp", "jira"]);
  // original is not mutated
  assert.ok(cat.entries[0]?.tags.includes("<a"));
});
