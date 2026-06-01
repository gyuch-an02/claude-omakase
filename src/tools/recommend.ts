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
  - No skills installed → returns the FULL starter-pack as a checklist (mode "starter-pack", present_as "checklist").
  - Some skills installed but the starter-pack is incomplete and the user gave no specific ask → returns ALL missing starter-pack skills as a checklist (mode "starter-pack-gap", present_as "checklist"). Use this to complete a user's starter pack after they've installed a few.
  - Recommendations always exclude skills the user already has installed.

ONBOARDING EXCEPTION: the two starter-pack modes are the ONLY case where you present a list. When present_as is "checklist", show every returned skill as a checkable item and let the user select and install any subset. In all OTHER modes, still pick the single best match, not the full list.

In "profile-search" mode each recommendation carries match_score and match_reasons — use them to explain WHY the pick fits, but still serve only one.`;

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

  // First-time user: no skills installed → surface the WHOLE starter-pack as a
  // checklist. This is the one onboarding exception to "serve exactly one".
  if (installedIds.size === 0) {
    return {
      mode: "starter-pack" as const,
      present_as: "checklist" as const,
      profile_summary: profile,
      onboarding_message:
        "No skills installed yet. Here's the starter pack — pick the ones that fit how you work and I'll install them.",
      recommendations: orderAll(starterPack, query).map(format),
      next_step:
        `ONBOARDING EXCEPTION — present a checklist, not one pick. Show EVERY skill above as a checkable item ` +
        `(the most relevant first), each with a one-line reason. Let the user select any subset (or all, or none). ` +
        `On approval, call install_skill once per selected skill, then follow each result's next_step onboarding.`,
    };
  }

  // Returning user with an incomplete starter pack and no specific ask:
  // fill the gap — suggest the best starter-pack skill they don't have yet.
  // Gate on the absence of an *explicit* ask (args.context), NOT on the combined
  // query. A saved profile makes `query` non-empty, but the chef still wants the
  // gap nudge when the user hasn't asked for anything specific — the profile is
  // used only to rank which missing staple to surface first.
  if (!ask && missingStarter.length > 0) {
    return {
      mode: "starter-pack-gap" as const,
      present_as: "checklist" as const,
      profile_summary: profile,
      installed_count: installedIds.size,
      missing_starter_pack: missingStarter.map((e) => e.id),
      onboarding_message:
        "You have some skills, but your starter pack isn't complete yet. Here are the staples you're still missing — pick the ones you want.",
      recommendations: orderAll(missingStarter, query).map(format),
      next_step:
        `ONBOARDING EXCEPTION — present a checklist, not one pick. Show EVERY missing staple above as a checkable ` +
        `item (the most relevant first), each with a one-line reason. Let the user select any subset (or all, or none). ` +
        `On approval, call install_skill once per selected skill, then follow each result's next_step onboarding.`,
    };
  }

  const singlePickNextStep =
    `Serve the ONE best recommendation with a one-sentence reason, then ask "install it?". ` +
    `Never show a menu. On approval, call install_skill and follow its next_step onboarding.`;

  // No query at all → safe verified defaults.
  if (query.length === 0) {
    const candidates = catalog.entries
      .filter((e) => e.verified)
      .filter(notInstalled)
      .sort((a, b) => b.tags.length - a.tags.length)
      .slice(0, args.limit);
    return {
      mode: "verified-defaults" as const,
      profile_summary: profile,
      recommendations: candidates.map(format),
      next_step: singlePickNextStep,
    };
  }

  // Profile-search. An explicit ask must dominate the profile: ranking on the
  // combined (profile + ask) query let a strong profile tag (e.g. "frontend")
  // outrank the actual request (e.g. "code review"). Rank on `ask` when present;
  // fall back to the profile-derived query only when there's no explicit ask.
  // Surface match_score + match_reasons so the chef can explain WHY a skill fits.
  const rankQuery = ask ?? query;
  const results = search(catalog.entries, rankQuery, args.limit + installedIds.size)
    .filter((r) => notInstalled(r.entry))
    .slice(0, args.limit);
  return {
    mode: "profile-search" as const,
    profile_summary: profile,
    recommendations: results.map((r) => ({
      ...format(r.entry),
      match_score: r.score,
      match_reasons: r.reasons,
    })),
    next_step: singlePickNextStep,
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

// Order all entries by relevance to `query` WITHOUT dropping any — used by the
// starter-pack checklist modes, which must surface every staple, most-relevant
// first. With no query, fall back to verified-then-breadth ordering.
function orderAll(all: Entry[], query: string): Entry[] {
  if (query.length === 0) {
    return [...all].sort(
      (a, b) => Number(b.verified) - Number(a.verified) || b.tags.length - a.tags.length
    );
  }
  const ranked = search(all, query, all.length).map((r) => r.entry);
  const seen = new Set(ranked.map((e) => e.id));
  return [...ranked, ...all.filter((e) => !seen.has(e.id))];
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
