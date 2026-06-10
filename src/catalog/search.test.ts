import { test } from "node:test";
import assert from "node:assert/strict";
import { search } from "./search.js";
import type { Entry } from "../types.js";

const entry = (over: Partial<Entry>): Entry => ({
  id: "x",
  name: "X",
  type: "claude_code_skill",
  description: "",
  tags: [],
  verified: false,
  author: { name: "n/a" },
  install: { command: "npx" },
  source: { adapter: "test" },
  ...over,
});

test("exact id wins", () => {
  const results = search(
    [
      entry({ id: "github", name: "GitHub", tags: ["github"] }),
      entry({ id: "fs", name: "Filesystem", tags: ["files"] }),
    ],
    "github"
  );
  assert.equal(results[0]?.entry.id, "github");
});

test("exact hyphenated id wins before token scoring", () => {
  const results = search(
    [
      entry({ id: "quick-review", name: "Misc", description: "", tags: [] }),
      entry({ id: "review-helper", name: "Review Helper", description: "quick review", tags: [] }),
    ],
    "quick-review"
  );

  assert.equal(results[0]?.entry.id, "quick-review");
  assert.ok(results[0]?.reasons.includes("id match (quick-review)"));
});

test("verified breaks ties", () => {
  const results = search(
    [
      entry({ id: "a", name: "A", description: "fetches urls", tags: [] }),
      entry({
        id: "b",
        name: "B",
        description: "fetches urls",
        tags: [],
        verified: true,
      }),
    ],
    "fetches urls"
  );
  assert.equal(results[0]?.entry.id, "b");
});

test("official source_trust breaks ties above community, below verified", () => {
  const community = entry({ id: "a", name: "A", description: "fetches urls", tags: [] });
  const official = entry({
    id: "b",
    name: "B",
    description: "fetches urls",
    tags: [],
    source_trust: "official",
  });
  const verified = entry({
    id: "c",
    name: "C",
    description: "fetches urls",
    tags: [],
    verified: true,
  });
  const order = search([community, official, verified], "fetches urls").map((r) => r.entry.id);
  assert.deepEqual(order, ["c", "b", "a"], "verified > official > community");
});

test("empty query yields nothing", () => {
  assert.deepEqual(search([entry({ id: "x" })], ""), []);
});
