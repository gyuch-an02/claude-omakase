import { mkdirSync, renameSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { load } from "../catalog/cache.js";
import * as codeSkills from "../installer/code-skills.js";
import { installedRecordsDir } from "../paths.js";
import type { InstalledRecord, UserParam } from "../types.js";

export const installSkillInput = z.object({
  id: z.string().min(1).describe("Catalog entry id to install (from find_skill results)."),
  force: z
    .boolean()
    .default(false)
    .describe(
      "Replace an existing ~/.claude/skills/<id>/ directory. Only set this after explicit user approval."
    ),
  inputs: z
    .record(z.string())
    .default({})
    .describe(
      "Values for the entry's `requires_user_params`. Keys must match each param's `key`."
    ),
});

export const installSkillDescription = `Install a Claude skill by id from the catalog.

When to call:
  - Only AFTER the user has explicitly approved the install. Never call speculatively.
  - You must have collected values for any \`requires_user_params\` returned by find_skill.
  - If a previous install already exists, ask before retrying with \`force: true\`.

Behavior:
  - claude_code_skill / claude_skill → drops files into ~/.claude/skills/<id>/, effective next Claude session.
  - Writes an install receipt under ~/.local/share/claude-omakase/installed/<id>.json.

Returns a human-readable summary plus the receipt path.`;

export async function handle(args: z.infer<typeof installSkillInput>) {
  const catalog = await load();
  const entry = catalog.entries.find((e) => e.id === args.id);
  if (!entry) {
    throw new Error(`unknown catalog entry: ${args.id}`);
  }

  validateInputs(entry.install.user_params ?? [], args.inputs);

  const record: InstalledRecord = {
    id: entry.id,
    kind: entry.type,
    installed_at: new Date().toISOString(),
    source_version: entry.version,
    entry_snapshot: entry,
  };

  const { skillDir } = await codeSkills.install(entry, { force: args.force });
  record.skill_dir = skillDir;
  const summary = `Installed skill "${entry.name}" at ${skillDir}. Claude will pick it up next session.`;

  await writeReceipt(record);

  return {
    ok: true,
    summary,
    id: entry.id,
    skill_dir: record.skill_dir ?? null,
    next_step:
      `Onboard the user now, in this order: ` +
      `(1) tell them the exact files landed at ${skillDir}; ` +
      `(2) give them the ONE trigger phrase to activate "${entry.name}" — read it from the skill's frontmatter if present; ` +
      `(3) say it becomes auto-active next session, but you can use it THIS session immediately by reading ${skillDir}/SKILL.md and following it. ` +
      `Then stop — do not propose another skill this turn.`,
  };
}

function validateInputs(params: UserParam[], inputs: Record<string, string>): void {
  for (const p of params) {
    if (p.required && (inputs[p.key]?.trim() ?? "") === "") {
      throw new Error(`missing required user param: ${p.key} (${p.label})`);
    }
  }
}

// Atomic temp+rename, matching blocklist/profile writes: a crash mid-write must
// not leave a truncated receipt that doctor/update later fail to parse.
async function writeReceipt(record: InstalledRecord): Promise<void> {
  const dir = installedRecordsDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${record.id}.json`);
  const tmp = join(dir, `.${record.id.replace(/\//g, "-")}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(tmp, JSON.stringify(record, null, 2) + "\n", "utf8");
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
