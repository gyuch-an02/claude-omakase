import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { load } from "../catalog/cache.js";
import { claudeCodeSkillsDir, installedRecordsDir } from "../paths.js";
import { isInternalSkillId } from "../internal-skills.js";
import type { InstalledRecord } from "../types.js";

export interface SkillHealth {
  id: string;
  skill_dir: string;
  skill_md_exists: boolean;
  /** SKILL.md exists but is zero bytes — Claude Code silently ignores it. */
  skill_md_empty: boolean;
  receipt_exists: boolean;
  in_catalog: boolean;
  catalog_version?: string;
  installed_version?: string;
}

export interface DoctorResult {
  total: number;
  healthy: number;
  issues: number;
  skills: SkillHealth[];
  summary: string;
}

export const doctorInput = z.object({}).strict();

export const doctorDescription = `Check installed Claude skills for missing SKILL.md files and missing install receipts.

When to call:
  - The user asks whether their Claude skill installation is healthy.
  - After install, uninstall, or update operations to confirm the filesystem and receipts agree.
  - When troubleshooting skills that do not appear in Claude Code.

Reads:
  - ~/.claude/skills/<id>/SKILL.md
  - ~/.local/share/claude-omakase/installed/<id>.json
  - The current catalog, to report catalog presence and version.`;

export async function handle(): Promise<DoctorResult> {
  const catalog = await load();
  const skillsRoot = claudeCodeSkillsDir();
  const receiptsRoot = installedRecordsDir();
  const skillIds = readSkillIds(skillsRoot);
  const receipts = readReceipts(receiptsRoot);
  const ids = new Set(
    [...skillIds, ...receipts.keys()].filter((id) => !isInternalSkillId(id))
  );
  const catalogById = new Map(catalog.entries.map((entry) => [entry.id, entry]));

  const skills = [...ids].sort().map((id): SkillHealth => {
    const skillDir = join(skillsRoot, id);
    const catalogEntry = catalogById.get(id);
    const skillMdPath = join(skillDir, "SKILL.md");
    const skillMdExists = existsSync(skillMdPath);

    return {
      id,
      skill_dir: skillDir,
      skill_md_exists: skillMdExists,
      skill_md_empty: skillMdExists && skillMdSize(skillMdPath) === 0,
      receipt_exists: existsSync(join(receiptsRoot, `${id}.json`)),
      in_catalog: catalogEntry !== undefined,
      catalog_version: catalogEntry?.version,
      installed_version: receipts.get(id)?.source_version,
    };
  });
  const healthy = skills.filter(
    (skill) => skill.skill_md_exists && !skill.skill_md_empty && skill.receipt_exists
  ).length;
  const issues = skills.length - healthy;

  return {
    total: skills.length,
    healthy,
    issues,
    skills,
    summary: `${skills.length} skills checked. ${healthy} healthy. ${issues} issues.`,
  };
}

// statSync can race against a concurrent uninstall (exists check passed, file
// gone by stat) — treat that as size 0 rather than crashing the health check.
function skillMdSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function readSkillIds(root: string): Set<string> {
  if (!existsSync(root)) return new Set();
  return new Set(
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((id) => !id.startsWith("."))
      .filter((id) => !isInternalSkillId(id))
  );
}

function readReceipts(root: string): Map<string, InstalledRecord | null> {
  const receipts = new Map<string, InstalledRecord | null>();
  if (!existsSync(root)) return receipts;

  for (const file of readdirSync(root)) {
    if (!file.endsWith(".json")) continue;
    const id = file.slice(0, -".json".length);
    if (isInternalSkillId(id)) continue;
    try {
      receipts.set(id, JSON.parse(readFileSync(join(root, file), "utf8")) as InstalledRecord);
    } catch {
      receipts.set(id, null);
    }
  }

  return receipts;
}
