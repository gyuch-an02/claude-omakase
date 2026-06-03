import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSkillTable, renderChecklist, type RenderRow } from "./render.js";

const rows: RenderRow[] = [
  {
    id: "quick-review",
    name: "Quick Review",
    description: "One-line, severity-tagged feedback on any diff.",
    verified: true,
    tags: ["starter-pack", "code-review", "quality"],
  },
  {
    id: "grill-me",
    name: "Grill Me",
    description: "Stress-test a plan by getting interviewed.",
    verified: false,
    tags: ["planning"],
  },
];

test("renderSkillTable: emits a Markdown table with a row per skill", () => {
  const out = renderSkillTable(rows);
  const lines = out.split("\n");
  assert.match(lines[0], /^\| ✓ \| Skill \| What it does \| Tags \|$/);
  assert.match(lines[1], /^\|---\|---\|---\|---\|$/);
  assert.equal(lines.length, 4, "header + separator + 2 rows");
  assert.match(out, /\*\*Quick Review\*\*/);
  assert.match(out, /✅/); // verified marker
  assert.doesNotMatch(out, /starter-pack/, "the starter-pack tag is hidden from the tag column");
});

test("renderSkillTable: escapes pipes and clips long descriptions", () => {
  const out = renderSkillTable([
    {
      id: "x",
      name: "X",
      description: "a | b " + "z".repeat(200),
      verified: true,
      tags: [],
    },
  ]);
  assert.match(out, /a \\\| b/, "pipe escaped so the table layout survives");
  assert.match(out, /…/, "long description is clipped");
});

test("renderSkillTable: a name with a pipe or newline cannot break the row layout", () => {
  const out = renderSkillTable([
    { id: "x", name: "Evil | Name\ninjected", description: "ok", verified: true, tags: [] },
  ]);
  // Header + separator + exactly one data row — the newline in the name must
  // not spill into a second row.
  assert.equal(out.split("\n").length, 3, "name newline collapsed, no extra rows");
  assert.doesNotMatch(out, /\| Evil \| Name/, "raw pipe in name must be escaped");
});

test("renderSkillTable: empty input is handled", () => {
  assert.equal(renderSkillTable([]), "_No matches._");
});

test("renderChecklist: emits checkbox lines, top pick marked", () => {
  const out = renderChecklist(rows);
  const lines = out.split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^- \[ \] \*\*Quick Review\*\* — /);
  assert.match(lines[0], /best fit/, "first row flagged as the suggested start");
  assert.match(lines[1], /^- \[ \] \*\*Grill Me\*\* — /);
  assert.doesNotMatch(lines[1], /best fit/);
});

test("renderChecklist: empty input says the pack is complete", () => {
  assert.match(renderChecklist([]), /complete/);
});
