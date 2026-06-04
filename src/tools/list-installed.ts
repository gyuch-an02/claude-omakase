import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { claudeCodeSkillsDir, installedRecordsDir } from "../paths.js";
import { isInternalSkillId } from "../internal-skills.js";
import type { InstalledRecord } from "../types.js";

export const listInstalledInput = z.object({}).strict();

export const listInstalledDescription = `Report which Claude skills are currently installed for the user.

When to call:
  - Before suggesting an install — you may discover the user already has the skill.
  - When the user asks "what do I have installed?"
  - As a precondition to recommend_skills, so recommendations exclude what's already there.

Reads two sources:
  - Omakase install receipts under ~/.local/share/claude-omakase/installed/
  - ~/.claude/skills/ directory listing (may include skills installed by other tools)`;

export async function handle() {
  const receipts = readReceipts();
  const skills = readSkillsDir();

  // A skill installed via Omakase has BOTH a receipt and a ~/.claude/skills dir,
  // so receipts.length + skills.length double-counts. Count distinct ids — the
  // same union recommend_skills uses.
  const userReceiptIds = receipts.map((r) => r.id).filter((id) => !isInternalSkillId(id));
  const userSkillIds = skills.filter((id) => !isInternalSkillId(id));
  const installedCount = new Set([...userReceiptIds, ...userSkillIds]).size;

  return {
    receipts: receipts.filter((r) => !isInternalSkillId(r.id)),
    raw_skills_dir: userSkillIds,
    installed_count: installedCount,
    next_step:
      installedCount === 0
        ? `No skills installed. This is a first session — ask the user ONE question about the work they do most, then call recommend_skills with that as context and serve the single best starter-pack skill.`
        : `The user already has ${installedCount} skill(s). Call recommend_skills with NO context to check for a starter-pack gap; if mode is "starter-pack-gap", offer the one missing staple. Otherwise stay quiet until a workflow trigger fires.`,
  };
}

function readReceipts(): InstalledRecord[] {
  const dir = installedRecordsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return [];
  }
  const out: InstalledRecord[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = readFileSync(join(dir, file), "utf8");
      out.push(JSON.parse(raw) as InstalledRecord);
    } catch {
      // skip corrupt receipts
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function readSkillsDir(): string[] {
  const dir = claudeCodeSkillsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((id) => !id.startsWith("."))
    .filter((id) => !isInternalSkillId(id))
    .sort();
}
