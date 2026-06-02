import { z } from "zod";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { load } from "../catalog/cache.js";
import { handle as listInstalled } from "./list-installed.js";
import { handle as installSkill } from "./install-skill.js";
import { renderChecklist, type RenderRow } from "../catalog/render.js";
import type { Entry } from "../types.js";

export const onboardStarterPackInput = z.object({}).strict();

export const onboardStarterPackDescription = `Interactively install the starter-pack skills the user is missing.

When to call:
  - First session / onboarding, or when the user wants to set up their starter pack.

Behavior:
  - Computes the starter-pack skills not yet installed.
  - If the MCP client supports elicitation, it shows the user a REAL interactive
    checkbox form (one box per missing skill) and installs exactly what they check —
    no text parsing needed. This is the preferred path.
  - If the client does NOT support elicitation, it returns a Markdown checklist
    (present_as: "checklist") for you to show; then ask which to install and call
    install_skill once per pick.
  - Never installs anything the user did not select.`;

function clip(text: string, max = 100): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

function toRow(e: Entry): RenderRow {
  return { id: e.id, name: e.name, description: e.description, verified: e.verified, tags: e.tags };
}

function format(e: Entry) {
  return { id: e.id, name: e.name, type: e.type, description: e.description, tags: e.tags, verified: e.verified };
}

export async function handle(_args: z.infer<typeof onboardStarterPackInput>, server: Server) {
  const [catalog, installed] = await Promise.all([load(), listInstalled()]);
  const installedIds = new Set<string>([
    ...installed.receipts.map((r) => r.id),
    ...installed.raw_skills_dir,
  ]);
  const starter = catalog.entries.filter((e) => e.tags.includes("starter-pack"));
  const missing = starter
    .filter((e) => !installedIds.has(e.id))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.tags.length - a.tags.length);

  if (missing.length === 0) {
    return {
      mode: "complete" as const,
      installed: [],
      next_step: "The starter pack is already complete. Tell the user; do not install anything.",
    };
  }

  // Does the connected client support elicitation? Only then can we show a real
  // interactive picker. Otherwise fall back to a Markdown checklist + text reply.
  const canElicit = Boolean(server.getClientCapabilities()?.elicitation);

  if (!canElicit) {
    return {
      mode: "markdown-fallback" as const,
      present_as: "checklist" as const,
      candidates: missing.map(format),
      rendered: renderChecklist(missing.map(toRow)),
      next_step:
        "This client can't show an interactive picker. Show the checklist above, ask which the user wants, " +
        "then call install_skill once per pick. Install nothing they didn't choose.",
    };
  }

  // Real interactive selection: one boolean checkbox per missing skill. The MCP
  // elicitation schema only allows flat primitive properties, so a multi-pick is
  // modeled as N booleans rather than an array.
  const properties: Record<string, { type: "boolean"; title: string; description: string; default: boolean }> = {};
  for (const e of missing) {
    properties[e.id] = { type: "boolean", title: e.name, description: clip(e.description), default: false };
  }

  const result = await server.elicitInput({
    message: "Pick the starter-pack skills to install (check the ones you want):",
    requestedSchema: { type: "object", properties, required: [] },
  });

  if (result.action !== "accept" || !result.content) {
    return {
      mode: "declined" as const,
      installed: [],
      next_step: "The user dismissed the picker. Don't install anything; carry on with their task.",
    };
  }

  const chosen = missing.filter((e) => result.content?.[e.id] === true);
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
    installed: installedNow,
    next_step: installedNow.length
      ? `Installed ${installedNow.length} skill(s) via the picker. For each, give the user its trigger phrase and note it's ` +
        `active next session (usable now by reading its SKILL.md). Then stop — don't propose more this turn.`
      : "The user checked nothing in the picker. Don't install anything; move on.",
  };
}
