// Unit tests for the TUI's pure rendering helpers. The interactive loop
// (runTui) drives @clack/prompts against a real TTY and isn't unit-tested here;
// these cover the health-state → glyph/cell mapping and the table layout, which
// is where the display logic actually lives.

import { test } from "node:test";
import assert from "node:assert/strict";
import { statusIcon, catalogCell, renderTable, clipName, tryOp } from "./tui.js";
import type { SkillHealth } from "../tools/doctor.js";

function health(overrides: Partial<SkillHealth> = {}): SkillHealth {
  return {
    id: "demo-skill",
    skill_dir: "/skills/demo-skill",
    skill_md_exists: true,
    skill_md_empty: false,
    receipt_exists: true,
    in_catalog: true,
    ...overrides,
  };
}

test("statusIcon: healthy install (SKILL.md + receipt, no update) → ✅", () => {
  assert.equal(statusIcon(health()), "✅");
});

test("statusIcon: missing SKILL.md → warning, regardless of other fields", () => {
  assert.equal(statusIcon(health({ skill_md_exists: false })), "⚠️ ");
  // Even with a receipt and a catalog match, a missing SKILL.md still warns.
  assert.equal(
    statusIcon(health({ skill_md_exists: false, receipt_exists: true, in_catalog: true })),
    "⚠️ "
  );
});

test("statusIcon: an available update (version drift) → 🔄, taking priority over ✅", () => {
  assert.equal(
    statusIcon(health({ catalog_version: "2.0.0", installed_version: "1.0.0" })),
    "🔄"
  );
});

test("statusIcon: present SKILL.md but no receipt → warning (incomplete install)", () => {
  assert.equal(statusIcon(health({ receipt_exists: false })), "⚠️ ");
});

test("statusIcon: empty SKILL.md → warning even with receipt and catalog match", () => {
  assert.equal(statusIcon(health({ skill_md_empty: true })), "⚠️ ");
});

test("renderTable: an empty SKILL.md is marked '✗ empty', not '✓'", () => {
  const out = renderTable([health({ id: "hollow", skill_md_empty: true })]);
  assert.match(out, /✗ empty/);
});

test("statusIcon: equal versions do not trigger the update glyph", () => {
  assert.equal(
    statusIcon(health({ catalog_version: "1.0.0", installed_version: "1.0.0" })),
    "✅"
  );
});

test("catalogCell: not in catalog → missing marker", () => {
  assert.equal(catalogCell(health({ in_catalog: false })), "✗ missing");
});

test("catalogCell: version drift → update marker", () => {
  assert.equal(
    catalogCell(health({ catalog_version: "2.0.0", installed_version: "1.0.0" })),
    "update!"
  );
});

test("catalogCell: in catalog, versions match → ok marker", () => {
  assert.match(catalogCell(health({ catalog_version: "1.0.0", installed_version: "1.0.0" })), /^✓/);
});

test("catalogCell: in catalog with no version info → ok marker (not 'update!')", () => {
  assert.match(catalogCell(health()), /^✓/);
});

test("renderTable: header + divider + one row per skill", () => {
  const out = renderTable([health({ id: "alpha" }), health({ id: "beta" })]);
  const lines = out.split("\n");
  assert.equal(lines.length, 4, "header + divider + 2 rows");
  assert.match(lines[0], /Skill/);
  assert.match(lines[0], /SKILL\.md/);
  assert.ok(lines[2].includes("alpha"));
  assert.ok(lines[3].includes("beta"));
});

test("renderTable: a very long id is truncated so it can't break column alignment", () => {
  const longId = "summarize-github-pull-request-diff-and-promote";
  const out = renderTable([health({ id: longId })]);
  const row = out.split("\n")[2];
  assert.doesNotMatch(row, /promote/, "the tail of the long id must be clipped off");
  assert.match(row, /…/, "truncation is marked with an ellipsis");
  // The clipped name must still leave the downstream columns intact.
  assert.match(row, /✓/, "SKILL.md column survives next to a long id");
});

test("clipName: short ids pass through, long ids are ellipsized to the column width", () => {
  assert.equal(clipName("alpha"), "alpha");
  const clipped = clipName("x".repeat(40));
  assert.equal(clipped.length, 22);
  assert.ok(clipped.endsWith("…"));
});

test("renderTable: empty skill list still renders header + divider, no rows", () => {
  const out = renderTable([]);
  assert.equal(out.split("\n").length, 2, "just header + divider");
});

test("renderTable: a broken install surfaces the warning glyph and missing markers", () => {
  const out = renderTable([health({ id: "broken", skill_md_exists: false, receipt_exists: false, in_catalog: false })]);
  assert.match(out, /⚠️/);
  assert.match(out, /✗ missing/);
});

// tryOp isolates per-skill failures so one bad update/remove can't crash the
// interactive batch — the loop reports it and continues to the next skill.
test("tryOp: success reports ok with no error", async () => {
  const seen: string[] = [];
  const r = await tryOp("alpha", async (id) => { seen.push(id); });
  assert.deepEqual(r, { id: "alpha", ok: true });
  assert.deepEqual(seen, ["alpha"]);
});

test("tryOp: a thrown Error is captured, not propagated", async () => {
  const r = await tryOp("beta", async () => { throw new Error("network 503"); });
  assert.equal(r.ok, false);
  assert.equal(r.id, "beta");
  assert.equal(r.error, "network 503");
});

test("tryOp: a non-Error throw is stringified rather than crashing", async () => {
  const r = await tryOp("gamma", async () => { throw "boom"; });
  assert.equal(r.ok, false);
  assert.equal(r.error, "boom");
});
