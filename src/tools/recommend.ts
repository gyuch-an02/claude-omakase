import { z } from "zod";
import { load } from "../catalog/cache.js";
import * as profileLib from "../profile.js";
import { search } from "../catalog/search.js";
import { handle as listInstalled } from "./list-installed.js";
import type { Entry } from "../types.js";

export const recommendInput = z.object({
  context: z
    .string()
    .optional()
    .describe(
      "Recent user activity in plain text. The most useful input is a 1–3 sentence summary of what the user has been doing in the last few messages."
    ),
  limit: z.number().int().min(1).max(10).default(3),
});

export const recommendDescription = `Suggest skills the user probably wants based on their profile + recent activity + what's already installed.

When to call PROACTIVELY (without being asked):
  - The user has done 3+ similar manual operations in a row that map to a known tool.
  - The user just told you about a recurring task in their workflow.
  - The user set or updated their profile and hasn't seen suggestions yet.
  - This is the user's FIRST session with Claude Code (no skills installed yet).

When to call REACTIVELY:
  - The user asks "what should I install?" or similar.

Returns a small ranked list. Never silently install — show the recommendations to the user and ask which (if any) to install.

Special behavior: if no skills are installed, returns the starter-pack (universally useful skills) regardless of profile or context.`;

export async function handle(args: z.infer<typeof recommendInput>) {
  const [catalog, profile, installed] = await Promise.all([
    load(),
    profileLib.load(),
    listInstalled(),
  ]);

  // First-time user: no skills installed → surface starter-pack
  if (installed.receipts.length === 0 && installed.raw_skills_dir.length === 0) {
    const starterPack = catalog.entries.filter((e) =>
      e.tags.includes("starter-pack")
    );
    return {
      mode: "starter-pack" as const,
      profile_summary: profile,
      onboarding_message:
        "No skills installed yet. Here's a starter pack of universally useful skills — install any that sound helpful and you can always add more later.",
      recommendations: starterPack.map(format),
    };
  }

  const tokens: string[] = [];
  if (profile.role) tokens.push(profile.role);
  if (profile.occupation) tokens.push(profile.occupation);
  if (profile.languages) tokens.push(...profile.languages);
  if (profile.tools) tokens.push(...profile.tools);
  if (profile.usecases) tokens.push(...profile.usecases);
  if (args.context) tokens.push(args.context);

  const query = tokens.join(" ").trim();

  let candidates: Entry[];
  let mode: "profile-search" | "verified-defaults";
  if (query.length === 0) {
    mode = "verified-defaults";
    candidates = catalog.entries
      .filter((e) => e.verified)
      .sort((a, b) => b.tags.length - a.tags.length)
      .slice(0, args.limit);
  } else {
    mode = "profile-search";
    candidates = search(catalog.entries, query, args.limit).map((r) => r.entry);
  }

  return {
    mode,
    profile_summary: profile,
    recommendations: candidates.map(format),
  };
}

function format(e: Entry) {
  return {
    id: e.id,
    name: e.name,
    type: e.type,
    description: e.description,
    tags: e.tags,
    verified: e.verified,
  };
}
