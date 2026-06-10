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

test("mergeSelectedAdapters: duplicate id across adapters keeps the preserved entry", () => {
  // Previous catalog owns "shared" via handpicked (non-selected). A skillsmp
  // partial refresh now also produces "shared" — the preserved entry must win
  // and the id must appear exactly once.
  const previous = [entry("shared", "handpicked"), entry("skillsmp-only", "skillsmp")];
  const refreshed = [entry("shared", "skillsmp"), entry("fresh", "skillsmp")];

  const merged = mergeSelectedAdapters(previous, refreshed, ["skillsmp"]);
  assert.deepEqual(
    merged.map((e) => e.id),
    ["fresh", "shared"]
  );
  assert.equal(merged.find((e) => e.id === "shared").source.adapter, "handpicked");
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
