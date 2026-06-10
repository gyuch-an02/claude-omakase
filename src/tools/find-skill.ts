import { z } from "zod";
import { load } from "../catalog/cache.js";
import { search } from "../catalog/search.js";
import { renderSkillTable } from "../catalog/render.js";
import * as blocklist from "../blocklist.js";

export const findSkillInput = z.object({
  task_description: z
    .string()
    .min(1)
    .describe(
      "Plain-language description of what the user is trying to do. Keywords + a sentence is best."
    ),
  // Default 8: a recall@K screening (scripts/eval-recall.mjs) showed the correct
  // skill lands within the top-8 ~93% of the time and plateaus there (top-20 adds
  // nothing). 8 is the cheapest K that maximizes recall — Claude reads all of them
  // and reranks, so search only has to surface the answer SOMEWHERE in the K, not
  // at rank 1 (lexical rank-1 alone is ~78%).
  limit: z.number().int().min(1).max(20).default(8),
});

export const findSkillDescription = `Search the federated catalog for Claude skills that would help with a task.

When to call:
  - The user describes a goal that could be automated ("I keep doing X by hand").
  - You (the assistant) notice the user has repeated a similar manual workflow 3+ times in this session — call this proactively without being asked.
  - The user mentions a tool, integration, data source, or workflow that might have a Claude skill.

Returns the top-K candidate matches (ranked by a keyword+synonym score). You are the reranker: the score and order are only a HINT — READ every candidate's description and pick the one that genuinely fits the user's intent, which is often NOT rank 1 (lexical rank-1 is right only ~78% of the time; reading the top-K lifts that to ~90%+). Match the user's actual goal, not just surface keywords; a high-scoring entry whose description is off-topic is the wrong pick.

This is an omakase product: do NOT show the user the list. Choose the SINGLE best match (prefer verified: true on a genuine tie), serve it with one sentence of WHY, and ask "install it?" — wait for explicit approval before calling install_skill. If none of the K actually fit, say so and offer propose_new_skill rather than forcing a weak match.`;

export async function handle(args: z.infer<typeof findSkillInput>) {
  const catalog = await load();
  // Exclude skills the user permanently declined ("never recommend").
  const blocked = blocklist.load();
  const candidates = catalog.entries.filter((e) => !blocked.has(e.id));
  const results = search(candidates, args.task_description, args.limit);
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
    rendered: renderSkillTable(
      results.map((r) => ({
        id: r.entry.id,
        name: r.entry.name,
        description: r.entry.description,
        verified: r.entry.verified,
        tags: r.entry.tags,
      }))
    ),
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
