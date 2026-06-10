import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSelectedAdapters, carryOverEnrichment } from "./catalog-merge.mjs";

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

test("carryOverEnrichment: a full refresh restores previous search_terms", () => {
  const previous = [
    { ...entry("enriched", "skillsmp"), search_terms: ["crawl", "spider"] },
    entry("plain", "skillsmp"),
  ];
  // Fresh adapter output never carries search_terms.
  const refreshed = [entry("enriched", "skillsmp"), entry("plain", "skillsmp")];

  const out = carryOverEnrichment(previous, refreshed);
  assert.deepEqual(out.find((e) => e.id === "enriched").search_terms, ["crawl", "spider"]);
  assert.equal(out.find((e) => e.id === "plain").search_terms, undefined);
});

test("carryOverEnrichment: refreshed entry's own terms win over previous", () => {
  const previous = [{ ...entry("x", "skillsmp"), search_terms: ["old"] }];
  const refreshed = [{ ...entry("x", "skillsmp"), search_terms: ["new"] }];
  assert.deepEqual(carryOverEnrichment(previous, refreshed)[0].search_terms, ["new"]);
});

test("carryOverEnrichment: no previous catalog is a no-op", () => {
  const refreshed = [entry("x", "skillsmp")];
  assert.equal(carryOverEnrichment(null, refreshed), refreshed);
  assert.equal(carryOverEnrichment([], refreshed), refreshed);
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
