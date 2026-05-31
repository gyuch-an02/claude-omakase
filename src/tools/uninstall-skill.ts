import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { claudeCodeSkillsDir, installedRecordsDir } from "../paths.js";

export const uninstallSkillInput = z.object({
  id: z
    .string()
    .min(1)
    .refine(
      (id) =>
        !id.startsWith("/") &&
        !id.includes("\\") &&
        !id.split("/").includes(".."),
      "id must be a safe relative skill id"
    )
    .describe("Installed skill id to uninstall."),
});

export const uninstallSkillDescription = `Uninstall a Claude skill by id.

Behavior:
  - Does not look up the catalog.
  - Removes ~/.claude/skills/<id>/ if present.
  - Removes the Omakase install receipt if present.
  - Idempotent: succeeds even when neither path exists.`;

export async function handle(
  args: z.infer<typeof uninstallSkillInput>
): Promise<{
  ok: boolean;
  id: string;
  removed_dir: string | null;
  removed_receipt: string | null;
}> {
  const skillDir = join(claudeCodeSkillsDir(), args.id);
  const receiptPath = join(installedRecordsDir(), `${args.id}.json`);
  const removedDir = existsSync(skillDir) ? skillDir : null;
  const removedReceipt = existsSync(receiptPath) ? receiptPath : null;

  rmSync(skillDir, { recursive: true, force: true });
  rmSync(receiptPath, { force: true });

  return {
    ok: true,
    id: args.id,
    removed_dir: removedDir,
    removed_receipt: removedReceipt,
  };
}
