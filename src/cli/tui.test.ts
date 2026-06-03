// Unit tests for the TUI's pure rendering helpers. The interactive loop
// (runTui) drives @clack/prompts against a real TTY and isn't unit-tested here;
// these cover the health-state → glyph/cell mapping and the table layout, which
// is where the display logic actually lives.

import { test } from "node:test";
import assert from "node:assert/strict";
import { statusIcon, catalogCell, renderTable } from "./tui.js";
import type { SkillHealth } from "../tools/doctor.js";

function health(overrides: Partial<SkillHealth> = {}): SkillHealth {
  return {
    id: "demo-skill",
    skill_dir: "/skills/demo-skill",
    skill_md_exists: true,
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

test("renderTable: empty skill list still renders header + divider, no rows", () => {
  const out = renderTable([]);
  assert.equal(out.split("\n").length, 2, "just header + divider");
});

test("renderTable: a broken install surfaces the warning glyph and missing markers", () => {
  const out = renderTable([health({ id: "broken", skill_md_exists: false, receipt_exists: false, in_catalog: false })]);
  assert.match(out, /⚠️/);
  assert.match(out, /✗ missing/);
});
