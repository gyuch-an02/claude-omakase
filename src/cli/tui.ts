#!/usr/bin/env node
import * as p from "@clack/prompts";
import * as doctor from "../tools/doctor.js";
import * as updateSkill from "../tools/update-skill.js";
import * as uninstallSkill from "../tools/uninstall-skill.js";

function statusIcon(skill: doctor.SkillHealth): string {
  if (!skill.skill_md_exists) return "⚠️ ";
  if (skill.in_catalog && skill.catalog_version && skill.installed_version &&
      skill.catalog_version !== skill.installed_version) return "🔄";
  if (skill.skill_md_exists && skill.receipt_exists) return "✅";
  return "⚠️ ";
}

function catalogCell(skill: doctor.SkillHealth): string {
  if (!skill.in_catalog) return "✗ missing";
  if (skill.catalog_version && skill.installed_version &&
      skill.catalog_version !== skill.installed_version) return "update!";
  return "✓       ";
}

function renderTable(skills: doctor.SkillHealth[]): string {
  const rows = skills.map((s) => {
    const icon = statusIcon(s);
    const name = s.id.padEnd(22);
    const skillMd = s.skill_md_exists ? "✓        " : "✗ missing";
    const receipt = s.receipt_exists ? "✓      " : "✗ missing";
    const catalog = catalogCell(s);
    return `│  ${icon}  ${name}${skillMd} ${receipt} ${catalog}`;
  });

  const header = `│      Skill                  SKILL.md  Receipt  Catalog         `;
  const divider = `│  ${"─".repeat(60)}`;

  return [header, divider, ...rows].join("\n");
}

async function runHealthCheck(): Promise<doctor.DoctorResult> {
  const spin = p.spinner();
  spin.start("Checking skills…");
  const result = await doctor.handle();
  spin.stop(`${result.total} installed · ${result.healthy} healthy · ${result.issues} need attention`);
  return result;
}

async function main(): Promise<void> {
  p.intro("🍱  Claude Omakase — skill manager");

  let health = await runHealthCheck();

  while (true) {
    p.note(renderTable(health.skills), `${health.total} installed · ${health.healthy} healthy · ${health.issues} need attention`);

    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "check", label: "Re-run health check" },
        { value: "update", label: "Update skill(s) from catalog" },
        { value: "remove", label: "Remove skill(s)" },
        { value: "quit", label: "Quit" },
      ],
    });

    if (p.isCancel(action) || action === "quit") {
      p.outro("Done.");
      break;
    }

    if (action === "check") {
      health = await runHealthCheck();
      continue;
    }

    if (action === "update") {
      const updatable = health.skills.filter(
        (s) =>
          s.in_catalog &&
          s.catalog_version &&
          s.installed_version &&
          s.catalog_version !== s.installed_version
      );
      if (updatable.length === 0) {
        p.log.info("All skills are up to date.");
        continue;
      }
      const picks = await p.multiselect({
        message: "Select skills to update:",
        options: updatable.map((s) => ({
          value: s.id,
          label: `${s.id}  (${s.installed_version} → ${s.catalog_version})`,
        })),
        required: false,
      });
      if (!p.isCancel(picks) && Array.isArray(picks) && picks.length > 0) {
        const spin = p.spinner();
        for (const id of picks as string[]) {
          spin.start(`Updating ${id}…`);
          await updateSkill.handle({ id });
          spin.stop(`Updated ${id}`);
        }
        health = await runHealthCheck();
      }
      continue;
    }

    if (action === "remove") {
      const picks = await p.multiselect({
        message: "Select skills to remove:",
        options: health.skills.map((s) => ({ value: s.id, label: s.id })),
        required: false,
      });
      if (!p.isCancel(picks) && Array.isArray(picks) && picks.length > 0) {
        const confirmed = await p.confirm({
          message: `Remove ${(picks as string[]).join(", ")}?`,
        });
        if (!p.isCancel(confirmed) && confirmed) {
          const spin = p.spinner();
          for (const id of picks as string[]) {
            spin.start(`Removing ${id}…`);
            await uninstallSkill.handle({ id });
            spin.stop(`Removed ${id}`);
          }
          health = await runHealthCheck();
        }
      }
      continue;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
