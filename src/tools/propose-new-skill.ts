import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CreateMessageRequestParamsBase } from "@modelcontextprotocol/sdk/types.js";
import { claudeCodeSkillsDir, packageTemplatesDir } from "../paths.js";

export const proposeNewSkillInput = z.object({
  task_description: z
    .string()
    .min(10)
    .describe(
      "What the user is trying to do. The more concrete, the better the resulting SKILL.md draft."
    ),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    .optional()
    .describe(
      "Slug for the new skill directory. If omitted, derived from task_description."
    ),
  triggers: z
    .array(z.string())
    .optional()
    .describe("Keywords / phrases that should activate this skill in future sessions."),
  draft_body: z
    .string()
    .optional()
    .describe(
      "Optional SKILL.md body. If provided, written as-is (skips both sampling and template)."
    ),
});

export const proposeNewSkillDescription = `Create a draft SKILL.md when no catalog entry matches the user's need.

When to call:
  - find_skill returned no useful matches.
  - The user described a workflow novel enough that it deserves its own skill.

Behavior:
  - Uses MCP sampling to ask the LLM to write a tailored SKILL.md from scratch.
  - Falls back to a type-specific scaffold (python-cli / node-script / shell-automation)
    only if draft_body is explicitly provided.
  - Writes the result to ~/.claude/skills/<slug>/SKILL.md.
  - The draft is intentionally lightweight — Claude (you) is expected to iterate
    with the user, edit the file in place, and ultimately encourage them to PR it
    back to the community.

Suggested follow-up after calling:
  1. Tell the user where the file landed.
  2. Offer to refine triggers and instructions in a second pass.
  3. Mention they can contribute it to https://github.com/gyuch-an02/claude-omakase/tree/main/handpicked once it's stable.`;

type TaskType = "python-cli" | "node-script" | "shell-automation";

export async function handle(
  args: z.infer<typeof proposeNewSkillInput>,
  server: Server
) {
  const slug = args.slug ?? slugify(args.task_description);
  const dir = join(claudeCodeSkillsDir(), slug);
  mkdirSync(dir, { recursive: true });

  const triggers = args.triggers && args.triggers.length > 0
    ? args.triggers
    : derive_triggers(args.task_description);

  let body: string;
  if (args.draft_body) {
    body = args.draft_body;
  } else {
    body = await generateWithSampling(server, { slug, taskDescription: args.task_description, triggers });
  }

  const path = join(dir, "SKILL.md");
  await writeFile(path, body, "utf8");

  return {
    ok: true,
    slug,
    path,
    next_steps: [
      `Open ${path} and refine the instructions.`,
      "Test the skill by running a fresh Claude session.",
      "When happy, copy SKILL.md content into a PR under handpicked/ in the claude-omakase repo.",
    ],
  };
}

async function generateWithSampling(
  server: Server,
  params: { slug: string; taskDescription: string; triggers: string[] }
): Promise<string> {
  const { slug, taskDescription, triggers } = params;
  const triggersYaml = triggers.map((t) => `  - "${t}"`).join("\n");

  const prompt = `You are helping write a SKILL.md file for Claude Code.

A SKILL.md is a markdown file that gives Claude a persistent set of instructions for a specific recurring task. It has YAML frontmatter (name, description, triggers) followed by markdown sections.

Write a complete, ready-to-use SKILL.md for the following task:

Task description: ${taskDescription}

Requirements:
- slug (name field): ${slug}
- triggers (phrases that activate this skill):
${triggersYaml}
- Include sections: "What this skill does", "When to activate", "Steps", "Examples"
- Steps should be concrete and actionable
- Examples should show realistic user messages and Claude responses
- Keep it focused and practical — no fluff

Output ONLY the SKILL.md content, starting with the YAML frontmatter (---).`;

  const samplingParams: CreateMessageRequestParamsBase = {
    messages: [
      {
        role: "user",
        content: { type: "text", text: prompt },
      },
    ],
    maxTokens: 2048,
    systemPrompt:
      "You are a technical writer specializing in Claude Code skill files. Output only valid SKILL.md content with no preamble or commentary.",
  };

  let result: Awaited<ReturnType<typeof server.createMessage>>;
  try {
    result = await server.createMessage(samplingParams);
  } catch (e) {
    throw new Error(
      `sampling/createMessage failed: ${(e as Error).message}. ` +
        "Ensure your MCP client supports sampling (Claude Code supports it natively). " +
        "Alternatively, pass draft_body to skip sampling."
    );
  }

  const content = result.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .filter((b): b is { type: "text"; text: string } => b.type === "text")
            .map((b) => b.text)
            .join("")
        : "text" in content && typeof (content as { text?: unknown }).text === "string"
          ? (content as { text: string }).text
          : null;

  if (!text) {
    throw new Error(
      `sampling returned unexpected content shape: ${JSON.stringify(content)}`
    );
  }

  // Strip any leading prose before the frontmatter fence.
  const fenceIdx = text.indexOf("---");
  return fenceIdx > 0 ? text.slice(fenceIdx) : text;
}

function detectType(description: string): TaskType {
  const d = description.toLowerCase();
  if (/python|\.py\b|pip\b|venv|pandas|numpy|django|flask|fastapi|pytest/.test(d)) {
    return "python-cli";
  }
  if (/\bnode\b|npm\b|\.js\b|\.ts\b|typescript|express|nextjs|next\.js|react|vitest|jest/.test(d)) {
    return "node-script";
  }
  return "shell-automation";
}

function renderTemplate(params: {
  slug: string;
  taskDescription: string;
  triggers: string[];
  type: TaskType;
}): string {
  const { slug, taskDescription, triggers, type } = params;
  const templatePath = join(packageTemplatesDir(), type, "SKILL.md");

  if (!existsSync(templatePath)) {
    throw new Error(`template not found: ${templatePath} (type: ${type})`);
  }
  const raw = readFileSync(templatePath, "utf8");

  const triggersCsv = triggers.map((t) => JSON.stringify(t)).join(", ");
  const triggersBullets = triggers.map((t) => `- "${t}"`).join("\n");

  return raw
    .replaceAll("{{slug}}", slug)
    .replaceAll("{{task_description}}", taskDescription)
    .replaceAll("{{triggers}}", triggersCsv)
    .replaceAll("{{triggers_bullets}}", triggersBullets)
    .replaceAll("{{generated_at}}", new Date().toISOString());
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function derive_triggers(s: string): string[] {
  return [
    ...new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9가-힣]+/)
        .filter((w) => w.length > 3)
        .slice(0, 6)
    ),
  ];
}

// renderTemplate kept for potential direct use (e.g. tests, draft_body generation).
export { renderTemplate, detectType };
