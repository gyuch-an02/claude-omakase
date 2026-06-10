import { z } from "zod";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { load as loadCatalog } from "../catalog/cache.js";
import { handle as installSkill } from "./install-skill.js";
import * as blocklist from "../blocklist.js";

export const offerSkillInput = z.object({
  id: z.string().min(1).describe("Catalog entry id to offer (e.g. the best find_skill match)."),
  decision: z
    .enum(["install", "not_now", "never"])
    .optional()
    .describe(
      "The user's decision. Omit to let the MCP client show an interactive picker (preferred). " +
        "Provide it after asking the user in text on clients without elicitation."
    ),
});

export const offerSkillDescription = `Offer ONE found skill to the user and act on their choice: install / not now / never recommend.

When to call:
  - After find_skill picks a best match, to get the user's decision interactively.

Behavior:
  - With no \`decision\`: on clients that support MCP elicitation, shows a native
    3-way picker (Install / Not now / Never recommend) and acts on the choice.
    On clients without elicitation, returns mode "ask" — you then ask the user in
    text and call this tool again with \`decision\` set.
  - "install" → installs the skill. "never" → adds it to a local block list so it
    is never recommended again (excluded from find_skill and recommend_skills).
    "not_now" → does nothing this time.
  - Already-blocked ids return mode "already-declined" without prompting.`;

export async function handle(args: z.infer<typeof offerSkillInput>, server: Server) {
  const catalog = await loadCatalog();
  const entry = catalog.entries.find((e) => e.id === args.id);
  if (!entry) throw new Error(`unknown catalog entry: ${args.id}`);

  if (blocklist.has(entry.id)) {
    return {
      mode: "already-declined" as const,
      id: entry.id,
      next_step: "The user previously chose never to see this skill. Don't offer it; move on.",
    };
  }

  // Resolve the decision: explicit arg, else interactive elicitation, else ask-in-text.
  let decision = args.decision ?? null;
  if (!decision) {
    const canElicit = Boolean(server.getClientCapabilities()?.elicitation);
    if (!canElicit) {
      return {
        mode: "ask" as const,
        skill: { id: entry.id, name: entry.name, description: entry.description, verified: entry.verified },
        next_step:
          `This client has no interactive picker. Tell the user about "${entry.name}" in one sentence with WHY, ` +
          `then ask: install, not now, or never recommend it again? Call offer_skill again with decision set.`,
      };
    }
    // The client advertised elicitation but the picker can still error or time
    // out (e.g. no human attached to this session). Surface that loudly with an
    // explicit text fallback — never let it bubble up as an opaque tool error.
    let result: Awaited<ReturnType<Server["elicitInput"]>>;
    try {
      result = await server.elicitInput({
        message: `Install "${entry.name}"? — ${clip(entry.description)}`,
        requestedSchema: {
          type: "object",
          properties: {
            choice: {
              type: "string",
              title: entry.name,
              description: "What would you like to do with this skill?",
              enum: ["install", "not_now", "never"],
            },
          },
          required: ["choice"],
        },
      });
    } catch (err) {
      return {
        mode: "picker-error" as const,
        id: entry.id,
        error: (err as Error).message,
        skill: { id: entry.id, name: entry.name, description: entry.description, verified: entry.verified },
        next_step:
          `The interactive picker failed (${(err as Error).message}). TELL THE USER the picker didn't come up, ` +
          `then describe "${entry.name}" in one sentence with WHY and ask: install, not now, or never recommend ` +
          `it again? Call offer_skill again with decision set.`,
      };
    }
    if (result.action !== "accept" || !result.content) {
      return { mode: "dismissed" as const, id: entry.id, next_step: "Picker dismissed. Don't install; move on." };
    }
    const choice = result.content["choice"];
    decision = choice === "install" || choice === "never" ? choice : "not_now";
  }

  if (decision === "install") {
    const r = await installSkill({ id: entry.id, force: false, inputs: {} });
    return { mode: "installed" as const, id: entry.id, skill_dir: r.skill_dir, next_step: r.next_step };
  }
  if (decision === "never") {
    blocklist.add(entry.id);
    return {
      mode: "never" as const,
      id: entry.id,
      next_step: `Recorded — "${entry.name}" won't be recommended again. Acknowledge briefly and move on.`,
    };
  }
  return {
    mode: "declined" as const,
    id: entry.id,
    next_step: "User passed for now (not blocked). Move on; you may offer it again later.",
  };
}

function clip(text: string, max = 100): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}
