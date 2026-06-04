import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSelectedAdapters } from "./catalog-merge.mjs";

test("mergeSelectedAdapters: default mode returns refreshed entries", () => {
  const refreshed = [entry("new", "handpicked")];
  assert.deepEqual(mergeSelectedAdapters([entry("old", "handpicked")], refreshed, []), refreshed);
});

test("mergeSelectedAdapters: selected mode replaces only selected adapter entries", () => {
  const previous = [
    entry("old-handpicked", "handpicked"),
    entry("remote", "skillsmp"),
    entry("awesome", "awesome-mcp"),
  ];
  const refreshed = [entry("new-handpicked", "handpicked")];

  assert.deepEqual(
    mergeSelectedAdapters(previous, refreshed, ["handpicked"]).map((e) => e.id),
    ["awesome", "new-handpicked", "remote"]
  );
});

function entry(id, adapter) {
  return {
    id,
    name: id,
    type: "claude_code_skill",
    description: id,
    tags: [],
    verified: false,
    author: { name: "test" },
    install: {},
    source: { adapter },
  };
}
