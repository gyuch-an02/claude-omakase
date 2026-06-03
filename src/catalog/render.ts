// Pretty rendering of skill recommendations for the chat surface.
//
// The MCP server has no terminal — its output is consumed by Claude, which
// renders Markdown in the chat. So "pretty" here means a clean Markdown table
// (for find/profile results) or a checkbox checklist (for starter-pack
// onboarding). Tools return these as a `rendered` string; the chef SKILL.md
// tells Claude to show it verbatim.

export interface RenderRow {
  id: string;
  name: string;
  description: string;
  verified?: boolean;
  tags?: string[];
  match_score?: number;
}

const MAX_DESC = 80;

function clip(text: string, max = MAX_DESC): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1).trimEnd() + "…";
}

// Escape the Markdown table cell separator so descriptions with "|" don't
// break the table layout.
function cell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

/** Render rows as a GitHub-flavored Markdown table, most relevant first. */
export function renderSkillTable(rows: RenderRow[]): string {
  if (rows.length === 0) return "_No matches._";
  const header = "| ✓ | Skill | What it does | Tags |";
  const sep = "|---|---|---|---|";
  const lines = rows.map((r) => {
    const check = r.verified ? "✅" : "·";
    const tags = (r.tags ?? []).filter((t) => t !== "starter-pack").slice(0, 3).join(", ");
    // clip() collapses newlines a scraped name might carry; cell() escapes "|".
    return `| ${check} | **${cell(clip(r.name, 60))}** | ${cell(clip(r.description))} | ${cell(tags)} |`;
  });
  return [header, sep, ...lines].join("\n");
}

/**
 * Render rows as a checkbox checklist for starter-pack onboarding, so the user
 * can pick any subset. The first row is marked as the suggested starting point.
 */
export function renderChecklist(rows: RenderRow[]): string {
  if (rows.length === 0) return "_Your starter pack is complete._";
  return rows
    .map((r, i) => {
      const hint = i === 0 ? "  ← _best fit for your work_" : "";
      return `- [ ] **${clip(r.name, 60)}** — ${clip(r.description)}${hint}`;
    })
    .join("\n");
}
