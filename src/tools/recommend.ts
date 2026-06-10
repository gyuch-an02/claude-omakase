import { z } from "zod";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { load } from "../catalog/cache.js";
import * as profileLib from "../profile.js";
import { search } from "../catalog/search.js";
import { handle as listInstalled } from "./list-installed.js";
import { handle as installSkill } from "./install-skill.js";
import { renderSkillTable, renderChecklist, type RenderRow } from "../catalog/render.js";
import * as blocklist from "../blocklist.js";
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

Special behavior (STARTER-PACK / ONBOARDING — both empty and partial):
  - No skills installed → offers the FULL starter pack.
  - Some skills installed but the starter pack is incomplete and the user gave no specific ask → offers ALL the missing starter-pack staples. Use this to complete a user's starter pack after they've installed a few.
  - In BOTH cases, if the MCP client supports elicitation, the tool shows the user a REAL interactive checkbox picker (one box per skill) and installs exactly what they check — no text parsing, no follow-up install_skill calls. Returns mode "installed" (with the chosen skills) or "declined".
  - If the client does NOT support elicitation, it returns the candidates as a Markdown checklist instead (mode "starter-pack" or "starter-pack-gap", present_as "checklist"); show it, ask which to install, then call install_skill once per pick.
  - Recommendations always exclude skills the user already has installed.

ONBOARDING EXCEPTION: the starter-pack flow is the ONLY case that touches more than one skill at once. When the picker runs it installs the user's selection directly; on the checklist fallback, present every returned skill as a checkable item and let the user select any subset. In all OTHER modes, still pick the single best match, not the full list.

In "profile-search" mode each recommendation carries match_score and match_reasons — use them to explain WHY the pick fits, but still serve only one.`;

export async function handle(args: z.infer<typeof recommendInput>, server?: Server) {
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
  // Exclude both installed skills and ones the user permanently declined.
  const blocked = blocklist.load();
  const notInstalled = (e: Entry) => !installedIds.has(e.id) && !blocked.has(e.id);

  const starterPack = catalog.entries.filter(
    (e) => e.tags.includes("starter-pack") && !blocked.has(e.id)
  );
  const missingStarter = starterPack.filter(notInstalled);

  // Starter-pack onboarding — the one flow that touches more than one skill.
  // Two entry points, one behavior:
  //   • First-time user (nothing installed) → offer the WHOLE starter pack.
  //   • Returning user, incomplete pack, no explicit ask → offer the missing
  //     staples (the "gap"). Gate on the absence of an *explicit* ask
  //     (args.context), NOT the combined query: a saved profile makes `query`
  //     non-empty, but the chef still wants the gap nudge when the user hasn't
  //     asked for anything specific — the profile only ranks which staple leads.
  const firstTime = installedIds.size === 0;
  if (firstTime || (!ask && missingStarter.length > 0)) {
    const candidates = orderAll(firstTime ? starterPack : missingStarter, query);
    if (candidates.length > 0) {
      return serveStarterPack({
        kind: firstTime ? "starter-pack" : "starter-pack-gap",
        candidates,
        profile,
        installedCount: installedIds.size,
        server,
      });
    }
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
      rendered: renderSkillTable(candidates.map(toRow)),
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
    rendered: renderSkillTable(results.map((r) => toRow(r.entry))),
    next_step: singlePickNextStep,
  };
}

// Drive the starter-pack flow. Picker-first: when the client advertises
// elicitation, show a real checkbox form and install the user's selection
// directly. Every non-picker path is LOUD — the chef must tell the user *why*
// there's no picker (unsupported client, or a picker that errored/timed out)
// rather than silently dropping to a text list as if that were normal.
async function serveStarterPack(opts: {
  kind: "starter-pack" | "starter-pack-gap";
  candidates: Entry[];
  profile: Awaited<ReturnType<typeof profileLib.load>>;
  installedCount: number;
  server?: Server;
}) {
  const { kind, candidates, profile, installedCount, server } = opts;
  const canElicit = Boolean(server?.getClientCapabilities?.()?.elicitation);

  // Genuinely incapable client (e.g. a minimal/legacy MCP host). Don't pretend
  // a text list is the intended UX — say the picker is unavailable, out loud.
  if (!canElicit) {
    return {
      mode: kind,
      present_as: "checklist" as const,
      picker: "unsupported" as const,
      profile_summary: profile,
      ...(kind === "starter-pack-gap"
        ? { installed_count: installedCount, missing_starter_pack: candidates.map((e) => e.id) }
        : {}),
      onboarding_message:
        kind === "starter-pack"
          ? "No skills installed yet. Here's the starter pack."
          : "You have some skills, but your starter pack isn't complete yet. Here are the staples you're still missing.",
      recommendations: candidates.map(format),
      rendered: renderChecklist(candidates.map(toRow)),
      next_step:
        `Your MCP client does not support the interactive picker, so I can't pop a checkbox form here. ` +
        `TELL THE USER THAT EXPLICITLY first — don't present this as the normal flow. Then show the checklist ` +
        `above, ask which to install, and call install_skill once per pick. Install nothing they didn't choose.`,
    };
  }

  // Interactive picker: one boolean checkbox per candidate. MCP elicitation
  // schemas only allow flat primitives, so a multi-pick is N booleans.
  const properties: Record<string, { type: "boolean"; title: string; description: string; default: boolean }> = {};
  for (const e of candidates) {
    properties[e.id] = { type: "boolean", title: e.name, description: clip(e.description), default: false };
  }

  let result: Awaited<ReturnType<NonNullable<Server["elicitInput"]>>>;
  try {
    result = await server!.elicitInput({
      message:
        kind === "starter-pack"
          ? "Pick the starter-pack skills to install (check the ones you want):"
          : "Your starter pack is missing a few staples — pick the ones to install:",
      requestedSchema: { type: "object", properties, required: [] },
    });
  } catch (err) {
    // The client advertised elicitation but the picker errored or timed out
    // (e.g. no human attached to this session). Surface it loudly with the data
    // intact so the chef can offer a text pick — never swallow it.
    return {
      mode: "picker-error" as const,
      starter_pack: kind,
      error: (err as Error).message,
      profile_summary: profile,
      recommendations: candidates.map(format),
      rendered: renderChecklist(candidates.map(toRow)),
      next_step:
        `The interactive picker failed (${(err as Error).message}). TELL THE USER the picker didn't come up, ` +
        `then show the checklist above and ask which to install, calling install_skill once per pick.`,
    };
  }

  if (result.action !== "accept" || !result.content) {
    return {
      mode: "declined" as const,
      starter_pack: kind,
      installed: [],
      next_step: "The user dismissed the picker. Don't install anything; carry on with their task.",
    };
  }

  const chosen = candidates.filter((e) => result.content?.[e.id] === true);
  const installedNow: Array<{ id: string; skill_dir?: string | null; error?: string }> = [];
  for (const e of chosen) {
    try {
      const r = await installSkill({ id: e.id, force: false, inputs: {} });
      installedNow.push({ id: e.id, skill_dir: r.skill_dir });
    } catch (err) {
      installedNow.push({ id: e.id, error: (err as Error).message });
    }
  }

  return {
    mode: "installed" as const,
    starter_pack: kind,
    installed: installedNow,
    next_step: installedNow.length
      ? `Installed ${installedNow.length} skill(s) via the picker. For each, give the user its trigger phrase and ` +
        `note it's active next session (usable now by reading its SKILL.md). Then stop — don't propose more this turn.`
      : "The user checked nothing in the picker. Don't install anything; move on.",
  };
}

function clip(text: string, max = 100): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

function toRow(e: Entry): RenderRow {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    verified: e.verified,
    tags: e.tags,
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
// Provenance tiebreak below `verified`: official-source entries sort above plain
// community ones. Undefined source_trust is treated as community.
function trustRank(e: Entry): number {
  return e.source_trust === "official" ? 1 : 0;
}

// first. With no query, fall back to trust-then-breadth ordering
// (verified > official > community).
function orderAll(all: Entry[], query: string): Entry[] {
  if (query.length === 0) {
    return [...all].sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        trustRank(b) - trustRank(a) ||
        b.tags.length - a.tags.length
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
  if (profile.ides) tokens.push(...profile.ides);
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
