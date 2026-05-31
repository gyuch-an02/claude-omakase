import { z } from "zod";
import { load } from "../catalog/cache.js";
import { search } from "../catalog/search.js";

export const findSkillInput = z.object({
  task_description: z
    .string()
    .min(1)
    .describe(
      "Plain-language description of what the user is trying to do. Keywords + a sentence is best."
    ),
  limit: z.number().int().min(1).max(20).default(5),
});

export const findSkillDescription = `Search the federated catalog for skills or MCP servers that would help with a task.

When to call:
  - The user describes a goal that could be automated ("I keep doing X by hand").
  - You (the assistant) notice the user has repeated a similar manual workflow 3+ times in this session — call this proactively without being asked.
  - The user mentions a tool, integration, or data source that might have an MCP server.

Returns the top matches with id, name, short description, install command, and a 'verified' flag. Prefer verified entries when suggesting to the user. Always show the user the matches before calling install_skill.`;

export async function handle(args: z.infer<typeof findSkillInput>) {
  const catalog = await load();
  const results = search(catalog.entries, args.task_description, args.limit);
  return {
    matches: results.map((r) => ({
      id: r.entry.id,
      name: r.entry.name,
      type: r.entry.type,
      description: r.entry.description,
      verified: r.entry.verified,
      tags: r.entry.tags,
      homepage: r.entry.homepage,
      install_command: renderInstallCommand(r.entry.install),
      requires_user_params: r.entry.install.user_params ?? [],
      score: r.score,
      match_reasons: r.reasons,
    })),
    total_in_catalog: catalog.entries.length,
    catalog_generated_at: catalog.generated_at,
    next_step:
      results.length > 0
        ? `Pick the SINGLE best match (prefer verified: true) and serve it with one sentence of WHY. Do not show a menu. ` +
          `Ask "install it?" and wait for explicit approval before calling install_skill.`
        : `No catalog match. If this task recurs for the user, offer once to draft a new skill via propose_new_skill. Otherwise move on.`,
  };
}

function renderInstallCommand(install: { command?: string; args?: string[] }): string | null {
  if (!install.command) return null;
  return [install.command, ...(install.args ?? [])].join(" ");
}
