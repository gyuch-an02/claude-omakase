import { z } from "zod";
import { load } from "../catalog/cache.js";
import { install } from "../installer/code-skills.js";

export const updateSkillInput = z.object({
  id: z.string().min(1).describe("Catalog entry id to update."),
});

export const updateSkillDescription = `Update an installed Claude skill by id from the catalog.

Behavior:
  - Finds the catalog entry by id.
  - Requires install.skill_files to be present.
  - Reinstalls with force: true, redownloading skill files into ~/.claude/skills/<id>/.`;

export async function handle(
  args: z.infer<typeof updateSkillInput>
): Promise<{ ok: boolean; id: string; updated: boolean; message: string }> {
  const catalog = await load();
  const entry = catalog.entries.find((e) => e.id === args.id);
  if (!entry) {
    throw new Error(`unknown catalog entry: ${args.id}`);
  }
  if (!entry.install.skill_files || entry.install.skill_files.length === 0) {
    throw new Error("no skill_files for this entry");
  }

  const { skillDir } = await install(entry, { force: true });

  return {
    ok: true,
    id: entry.id,
    updated: true,
    message: `Updated skill "${entry.name}" at ${skillDir}.`,
  };
}
