import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CreateMessageRequestParamsBase } from "@modelcontextprotocol/sdk/types.js";
import { claudeCodeSkillsDir, packageTemplatesDir } from "../paths.js";

const draftEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal("claude_code_skill"),
  description: z.string().min(1),
  tags: z.array(z.string()).min(1),
  verified: z.literal(false),
  author: z.object({ name: z.string().min(1) }),
  install: z.object({
    skill_files: z.array(
      z.object({
        source: z.string().url().startsWith("https://"),
        target: z.string().min(1),
      })
    ),
  }),
  source: z.object({
    adapter: z.literal("propose_new_skill"),
  }),
});

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
      "Optional SKILL.md body. If provided, validated and written without sampling."
    ),
});

export const proposeNewSkillDescription = `Create a draft SKILL.md when no catalog entry matches the user's need.

When to call:
  - find_skill returned no useful matches.
  - The user described a workflow novel enough that it deserves its own skill.

Behavior:
  - Uses MCP sampling to ask the LLM to write a tailored SKILL.md from scratch.
  - Returns a clear error if the MCP host does not support sampling/createMessage.
  - Validates frontmatter, required sections, catalog Entry shape, and resolvable install commands before writing.
  - If draft_body is provided, validates that body and skips sampling.
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
  let slug = args.slug ?? slugify(args.task_description);
  let taskDescription = args.task_description;
  let triggers =
    args.triggers && args.triggers.length > 0 ? args.triggers : derive_triggers(args.task_description);
  let conceptEdited = false;
  let conceptFormError: string | null = null;

  // Let the user edit the concept (id / what it does / triggers) BEFORE we draft
  // and write anything — but only if the client supports an interactive form.
  // The form is an optional refinement step: if the picker errors or times out
  // (e.g. no human attached), record it and proceed with the proposed concept
  // rather than failing the whole tool.
  if (!args.draft_body && Boolean(server.getClientCapabilities?.()?.elicitation)) {
    const res = await elicitConceptForm(server, { slug, taskDescription, triggers }).catch((e: unknown) => {
      conceptFormError = e instanceof Error ? e.message : String(e);
      return null;
    });
    if (res && res.action === "accept" && res.content) {
      const c = res.content as Record<string, unknown>;
      if (typeof c["slug"] === "string" && c["slug"].trim()) slug = slugify(c["slug"]);
      if (typeof c["task_description"] === "string" && c["task_description"].trim()) {
        taskDescription = c["task_description"].trim();
      }
      if (typeof c["triggers"] === "string" && c["triggers"].trim()) {
        triggers = c["triggers"].split(",").map((t) => t.trim()).filter(Boolean);
      }
      conceptEdited = true;
    }
    // declined/cancel/error → keep the originally proposed concept
  }

  // slugify() can yield "" or a single char (e.g. a task_description with no
  // ASCII alphanumerics), which would write SKILL.md straight into the skills
  // root or fail the name===slug check confusingly. Validate before writing.
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    throw new Error(
      `could not derive a valid skill slug from the input; pass an explicit kebab-case slug`
    );
  }

  const body = args.draft_body
    ? args.draft_body
    : await generateWithSampling(server, { slug, taskDescription, triggers });

  await validateSkillDraft(body, { slug, triggers });

  const dir = join(claudeCodeSkillsDir(), slug);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "SKILL.md");
  await writeFile(path, body, "utf8");

  return {
    ok: true,
    slug,
    path,
    concept_edited: conceptEdited,
    ...(conceptFormError
      ? {
          concept_form_error:
            `The interactive concept-edit form failed (${conceptFormError}); the draft used the proposed ` +
            `concept as-is. Tell the user and offer to refine slug/description/triggers in text.`,
        }
      : {}),
    next_steps: [
      `Open ${path} and refine the instructions.`,
      "Test the skill by running a fresh Claude session.",
      "When happy, copy SKILL.md content into a PR under handpicked/ in the claude-omakase repo.",
    ],
  };
}

function elicitConceptForm(
  server: Server,
  current: { slug: string; taskDescription: string; triggers: string[] }
): ReturnType<Server["elicitInput"]> {
  return server.elicitInput({
    message: "Review the new skill's concept — edit anything before I draft it:",
    requestedSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          title: "Skill id (slug)",
          description: "kebab-case folder name under ~/.claude/skills/",
          default: current.slug,
        },
        task_description: {
          type: "string",
          title: "What it does",
          description: "One or two sentences describing the skill's job.",
          default: current.taskDescription,
        },
        triggers: {
          type: "string",
          title: "Trigger phrases (comma-separated)",
          description: "Phrases that should activate the skill later.",
          default: current.triggers.join(", "),
        },
      },
      required: [],
    },
  });
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

  if (typeof server.createMessage !== "function") {
    throw new Error(samplingUnsupportedMessage());
  }

  let result: Awaited<ReturnType<typeof server.createMessage>>;
  try {
    result = await server.createMessage(samplingParams);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`${samplingUnsupportedMessage()} Original error: ${message}`);
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

export async function validateSkillDraft(
  body: string,
  params: { slug: string; triggers: string[] }
): Promise<void> {
  const frontmatter = parseFrontmatter(body);
  const name = readFrontmatterScalar(frontmatter, "name");
  const description = readFrontmatterScalar(frontmatter, "description");
  const triggers = readFrontmatterList(frontmatter, "triggers");

  if (name !== params.slug) {
    throw new Error(`draft frontmatter name must be "${params.slug}"`);
  }
  if (!description) {
    throw new Error("draft frontmatter is missing description");
  }
  if (triggers.length === 0) {
    throw new Error("draft frontmatter is missing triggers");
  }

  for (const section of [
    "What this skill does",
    "When to activate",
    "Steps",
    "Examples",
  ]) {
    if (!new RegExp(`^##\\s+${escapeRegExp(section)}\\s*$`, "im").test(body)) {
      throw new Error(`draft is missing required section: ${section}`);
    }
  }

  if (/{{[^}]+}}/.test(body)) {
    throw new Error("draft contains unresolved template placeholders");
  }

  const draftEntry = {
    id: params.slug,
    name,
    type: "claude_code_skill",
    description,
    tags: triggers,
    verified: false,
    author: { name: "local-user" },
    install: {
      skill_files: [
        {
          source: `https://example.invalid/${params.slug}/SKILL.md`,
          target: "SKILL.md",
        },
      ],
    },
    source: { adapter: "propose_new_skill" },
  };
  draftEntrySchema.parse(draftEntry);

  await checkInstallCommands(body);
}

function samplingUnsupportedMessage(): string {
  return (
    "host does not support sampling/createMessage for propose_new_skill. " +
    "Use a Claude Code MCP host with sampling support, or pass draft_body to skip sampling."
  );
}

function parseFrontmatter(body: string): string {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match?.[1]) {
    throw new Error("draft must start with YAML frontmatter");
  }
  return match[1];
}

function readFrontmatterScalar(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"));
  if (!match?.[1]) {
    return null;
  }
  return stripYamlQuotes(match[1].trim());
}

function readFrontmatterList(frontmatter: string, key: string): string[] {
  const inline = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"));
  if (inline?.[1]) {
    return inline[1]
      .split(",")
      .map((item) => stripYamlQuotes(item.trim()))
      .filter(Boolean);
  }

  const block = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:\\s*\\r?\\n((?:\\s+-\\s+.+\\r?\\n?)+)`, "m"));
  if (!block?.[1]) {
    return [];
  }

  return block[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^\s+-\s+(.+?)\s*$/)?.[1])
    .filter((item): item is string => Boolean(item))
    .map((item) => stripYamlQuotes(item));
}

function stripYamlQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

async function checkInstallCommands(body: string): Promise<void> {
  const checks = [
    ...findRegistryCommands(body, /\b(?:npm\s+(?:install|add)|npx)\s+([^\n]+)/gi, "npm"),
    ...findRegistryCommands(body, /\b(?:(?:python\s+-m\s+)?pip(?:x)?\s+(?:install|run)|uvx)\s+([^\n]+)/gi, "pypi"),
  ];

  for (const check of checks) {
    await assertPackageResolves(check.registry, check.packageName);
  }
}

function findRegistryCommands(
  body: string,
  pattern: RegExp,
  registry: "npm" | "pypi"
): { registry: "npm" | "pypi"; packageName: string }[] {
  return [...body.matchAll(pattern)]
    .map((match) => firstPackageToken(match[1] ?? "", registry))
    .filter((packageName): packageName is string => Boolean(packageName))
    .map((packageName) => ({ registry, packageName }));
}

function firstPackageToken(args: string, registry: "npm" | "pypi"): string | null {
  for (const token of args.split(/\s+/)) {
    const cleaned = token.trim().replace(/[.,;:)]+$/g, "");
    if (!cleaned || cleaned.startsWith("-")) {
      continue;
    }
    if (/^(https?:|git\+|\.{0,2}\/)/.test(cleaned)) {
      continue;
    }
    return registry === "npm" ? stripNpmVersion(cleaned) : stripPypiVersion(cleaned);
  }
  return null;
}

function stripNpmVersion(packageName: string): string {
  const versionSeparator = packageName.lastIndexOf("@");
  if (versionSeparator <= 0) {
    return packageName;
  }
  return packageName.slice(0, versionSeparator);
}

function stripPypiVersion(packageName: string): string {
  return packageName.split(/[<>=~!]/)[0] ?? packageName;
}

async function assertPackageResolves(
  registry: "npm" | "pypi",
  packageName: string
): Promise<void> {
  const url =
    registry === "npm"
      ? `https://registry.npmjs.org/${packageName.replace("/", "%2F")}`
      : `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `draft install command references unresolved ${registry} package: ${packageName}`
    );
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
