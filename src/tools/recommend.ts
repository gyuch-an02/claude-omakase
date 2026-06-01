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

Special behavior:
  - No skills installed → returns the starter-pack (mode "starter-pack").
  - Some skills installed but the starter-pack is incomplete and the user gave no specific ask → suggests the best missing starter-pack skill (mode "starter-pack-gap"). Use this to complete a user's starter pack after they've installed a few.
  - Recommendations always exclude skills the user already has installed.
In every mode: still pick the single best match, not the full list.`;

export async function handle(args: z.infer<typeof recommendInput>) {
  const [catalog, profile, installed] = await Promise.all([
    load(),
    profileLib.load(),
    listInstalled(),
  ]);

  // A whitespace-only context is not a real ask — Zod allows "   ", but it must
  // not suppress the starter-pack-gap nudge. Normalize to undefined.
  const ask = args.context?.trim() ? args.context.trim() : undefined;

  const tokens = profileTokens(profile);
  if (ask) tokens.push(ask);
  const query = tokens.join(" ").trim();

  const installedIds = installedIdSet(installed);
  const notInstalled = (e: Entry) => !installedIds.has(e.id);

  const starterPack = catalog.entries.filter((e) => e.tags.includes("starter-pack"));
  const missingStarter = starterPack.filter(notInstalled);

  // First-time user: no skills installed → surface the starter-pack.
  if (installedIds.size === 0) {
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
      next_step:
        `First-time user. Serve the ONE recommendation above with a one-sentence reason, then ask "install it?". ` +
        `Do not list the others. On approval, call install_skill and follow its next_step onboarding.`,
    };
  }

  // Returning user with an incomplete starter pack and no specific ask:
  // fill the gap — suggest the best starter-pack skill they don't have yet.
  // Gate on the absence of an *explicit* ask (args.context), NOT on the combined
  // query. A saved profile makes `query` non-empty, but the chef still wants the
  // gap nudge when the user hasn't asked for anything specific — the profile is
  // used only to rank which missing staple to surface first.
  if (!ask && missingStarter.length > 0) {
    const profileRanked =
      query.length > 0 ? search(missingStarter, query, args.limit).map((r) => r.entry) : [];
    const candidates = (
      profileRanked.length > 0
        ? profileRanked
        : missingStarter.sort(
            (a, b) => Number(b.verified) - Number(a.verified) || b.tags.length - a.tags.length
          )
    ).slice(0, args.limit);
    return {
      mode: "starter-pack-gap" as const,
      profile_summary: profile,
      installed_count: installedIds.size,
      missing_starter_pack: missingStarter.map((e) => e.id),
      onboarding_message:
        "You have some skills, but your starter pack isn't complete yet. Here's the next one worth adding.",
      recommendations: candidates.map(format),
      next_step:
        `Serve the ONE recommendation above with a one-sentence reason ("you've got X, this rounds it out"), then ask "install it?". ` +
        `Never show the full list. On approval, call install_skill and follow its next_step onboarding.`,
    };
  }

  let candidates: Entry[];
  let mode: "profile-search" | "verified-defaults";
  if (query.length === 0) {
    mode = "verified-defaults";
    candidates = catalog.entries
      .filter((e) => e.verified)
      .filter(notInstalled)
      .sort((a, b) => b.tags.length - a.tags.length)
      .slice(0, args.limit);
  } else {
    mode = "profile-search";
    candidates = search(catalog.entries, query, args.limit + installedIds.size)
      .map((r) => r.entry)
      .filter(notInstalled)
      .slice(0, args.limit);
  }

  return {
    mode,
    profile_summary: profile,
    recommendations: candidates.map(format),
    next_step:
      `Serve the ONE best recommendation with a one-sentence reason, then ask "install it?". ` +
      `Never show a menu. On approval, call install_skill and follow its next_step onboarding.`,
  };
}

// Installed skill ids come from two sources: Omakase install receipts and the
// raw ~/.claude/skills/ directory names (skills installed by any tool).
function installedIdSet(installed: Awaited<ReturnType<typeof listInstalled>>): Set<string> {
  const ids = new Set<string>();
  for (const r of installed.receipts) ids.add(r.id);
  for (const name of installed.raw_skills_dir) ids.add(name);
  return ids;
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
