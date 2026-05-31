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
  limit: z.number().int().min(1).max(10).default(1),
});

export const recommendDescription = `Return the single best skill for the user's current context.

IMPORTANT: default limit is 1. Do not increase it unless the user explicitly asks to see more options.
This is an omakase product — you pick one and serve it, not a menu.

When to call:
  - First session (no skills installed): ask what the user works on, then call with that as context.
  - User mentions a recurring workflow by name.
  - User asks "what should I install?" — call once, return one result.

After getting a result: present ONE recommendation with a one-sentence reason, then ask "install it?".
Never show a list. Never show more than one option at a time.

Special behavior: if no skills are installed, returns the starter-pack regardless of context.
In starter-pack mode: still pick the single best match for the user's stated work, not the full list.`;

export async function handle(args: z.infer<typeof recommendInput>) {
  const [catalog, profile, installed] = await Promise.all([
    load(),
    profileLib.load(),
    listInstalled(),
  ]);
  const installedIds = new Set([
    ...installed.receipts.map((receipt) => receipt.id),
    ...installed.raw_skills_dir,
  ]);

  const tokens = profileTokens(profile);
  if (args.context) tokens.push(args.context);
  const query = tokens.join(" ").trim();

  // First-time user: no skills installed → surface starter-pack
  if (installed.receipts.length === 0 && installed.raw_skills_dir.length === 0) {
    const starterPack = catalog.entries.filter((e) =>
      e.tags.includes("starter-pack")
    );
    const ranked =
      query.length > 0
        ? search(starterPack, query, args.limit).map((r) => r.entry)
        : starterPack
            .filter((e) => e.verified)
            .sort((a, b) => b.tags.length - a.tags.length)
            .slice(0, args.limit);
    const candidates = ranked.length > 0 ? ranked : starterPack.slice(0, args.limit);

    return {
      mode: "starter-pack" as const,
      profile_summary: profile,
      onboarding_message:
        "No skills installed yet. Here's the best first skill for your current work — you can always add more later.",
      recommendations: candidates.map(format),
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
  const availableEntries = catalog.entries.filter((e) => !installedIds.has(e.id));


  let candidates: Entry[];
  let mode: "profile-search" | "verified-defaults";
  if (query.length === 0) {
    mode = "verified-defaults";
    candidates = availableEntries
      .filter((e) => e.verified)
      .sort((a, b) => b.tags.length - a.tags.length)
      .slice(0, args.limit);
    return {
      mode,
      profile_summary: profile,
      recommendations: candidates.map(format),
    };
  } else {
    mode = "profile-search";
    const results = search(availableEntries, query, args.limit);
    return {
      mode,
      profile_summary: profile,
      recommendations: results.map((r) => ({
        ...format(r.entry),
        match_score: r.score,
        match_reasons: r.reasons,
      })),
    };
  }
}

function profileTokens(profile: Awaited<ReturnType<typeof profileLib.load>>): string[] {
  const tokens: string[] = [];
  if (profile.role) tokens.push(profile.role);
  if (profile.occupation) tokens.push(profile.occupation);
  if (profile.languages) tokens.push(...profile.languages);
  if (profile.tools) tokens.push(...profile.tools);
  if (profile.usecases) tokens.push(...profile.usecases);
  return tokens;
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
