import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { claudeCodeSkillsDir, installedRecordsDir } from "../paths.js";
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

  return {
    receipts,
    raw_skills_dir: skills,
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
    .sort();
}
