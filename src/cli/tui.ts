// Interactive skill manager TUI: list installed skills, health-check them,
// update from the catalog, and remove them. Reuses the same handlers the MCP
// server exposes, so the CLI and the agent stay in lockstep.
//
// Launched via `npx claude-omakase tui` (server.ts dispatches on argv).

import * as p from "@clack/prompts";
import { handle as doctor, type DoctorResult, type SkillHealth } from "../tools/doctor.js";
import { handle as uninstall } from "../tools/uninstall-skill.js";
import { handle as update } from "../tools/update-skill.js";

function pad(value: string | undefined, width: number): string {
  const s = String(value ?? "");
  if (s.length > width) return s.slice(0, width - 1) + "…";
  return s.padEnd(width);
}

function statusIcon(s: SkillHealth): string {
  if (!s.skill_md_exists || !s.receipt_exists) return "⚠️";
  if (s.in_catalog && s.catalog_version && s.catalog_version !== s.installed_version) return "🔄";
  return "✅";
}

function updateAvailable(s: SkillHealth): boolean {
  return Boolean(s.in_catalog && s.catalog_version && s.catalog_version !== s.installed_version);
}

function renderHealthTable(health: DoctorResult): string {
  const head =
    pad("", 2) + " " + pad("Skill", 30) + pad("SKILL.md", 10) + pad("Receipt", 9) + pad("Catalog", 9);
  const rows = health.skills.map((s) => {
    const md = s.skill_md_exists ? "✓" : "✗ missing";
    const rc = s.receipt_exists ? "✓" : "✗";
    const cat = s.in_catalog ? (updateAvailable(s) ? "update!" : "✓") : "—";
    return pad(statusIcon(s), 2) + " " + pad(s.id, 30) + pad(md, 10) + pad(rc, 9) + pad(cat, 9);
  });
  return [head, "─".repeat(head.length), ...rows].join("\n");
}

function skillOptions(health: DoctorResult) {
  return health.skills.map((s) => ({
    value: s.id,
    label: s.id,
    hint: !s.skill_md_exists ? "SKILL.md missing" : updateAvailable(s) ? "update available" : undefined,
  }));
}

export async function runTui(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      "omakase tui needs an interactive terminal (TTY). Run it directly, e.g.:\n  npx claude-omakase tui"
    );
    process.exitCode = 1;
    return;
  }

  p.intro("🍱  Claude Omakase — skill manager");

  // Loop the dashboard until the user quits.
  while (true) {
    let health: DoctorResult;
    try {
      health = await doctor();
    } catch (e) {
      p.cancel(`Could not read skills: ${(e as Error).message}`);
      return;
    }

    if (health.total === 0) {
      p.note(
        "No skills installed yet.\nAsk Claude (with the omakase-chef skill) to get started,\nor install one from the catalog.",
        "Empty"
      );
    } else {
      p.note(
        renderHealthTable(health),
        `${health.total} installed · ${health.healthy} healthy · ${health.issues} need attention`
      );
    }

    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "refresh", label: "Re-run health check" },
        { value: "update", label: "Update skill(s) from catalog", hint: "re-download SKILL.md" },
        { value: "remove", label: "Remove skill(s)" },
        { value: "quit", label: "Quit" },
      ],
    });

    if (p.isCancel(action) || action === "quit") break;
    if (action === "refresh") continue;
    if (health.total === 0) {
      p.note("Nothing installed to act on.");
      continue;
    }

    if (action === "update") {
      const sel = await p.multiselect({
        message: "Select skills to update (space to toggle, enter to confirm)",
        options: skillOptions(health),
        required: false,
      });
      if (p.isCancel(sel) || (sel as string[]).length === 0) continue;
      const s = p.spinner();
      s.start("Updating from catalog");
      const results: string[] = [];
      for (const id of sel as string[]) {
        try {
          await update({ id });
          results.push(`✅ ${id} — updated`);
        } catch (e) {
          results.push(`❌ ${id} — ${(e as Error).message}`);
        }
      }
      s.stop("Update finished");
      p.note(results.join("\n"), "Update results");
    }

    if (action === "remove") {
      const sel = await p.multiselect({
        message: "Select skills to REMOVE (space to toggle, enter to confirm)",
        options: skillOptions(health),
        required: false,
      });
      if (p.isCancel(sel) || (sel as string[]).length === 0) continue;
      const ok = await p.confirm({
        message: `Remove ${(sel as string[]).length} skill(s)? This deletes ~/.claude/skills/<id>/ and the install receipt.`,
        initialValue: false,
      });
      if (p.isCancel(ok) || !ok) continue;
      const results: string[] = [];
      for (const id of sel as string[]) {
        try {
          await uninstall({ id });
          results.push(`🗑  ${id} — removed`);
        } catch (e) {
          results.push(`❌ ${id} — ${(e as Error).message}`);
        }
      }
      p.note(results.join("\n"), "Removed");
    }
  }

  p.outro("Done. 🍣");
}
