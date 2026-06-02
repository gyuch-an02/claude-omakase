#!/usr/bin/env node
// Claude Omakase — Skill Suggester MCP server.
// Run with stdio transport (the only mode Claude Desktop / Claude Code uses).
//
//   $ node dist/server.js
//
// Registered with Claude via:
//   {
//     "mcpServers": {
//       "omakase": { "command": "npx", "args": ["-y", "claude-omakase"] }
//     }
//   }

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as findSkill from "./tools/find-skill.js";
import * as listInstalled from "./tools/list-installed.js";
import * as installSkill from "./tools/install-skill.js";
import * as recommend from "./tools/recommend.js";
import * as setProfile from "./tools/set-profile.js";
import * as proposeNewSkill from "./tools/propose-new-skill.js";
import * as uninstallSkill from "./tools/uninstall-skill.js";
import * as updateSkill from "./tools/update-skill.js";
import * as doctor from "./tools/doctor.js";
import * as onboard from "./tools/onboard.js";

interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handle: (args: unknown) => Promise<unknown>;
}

// Single source of truth: read the version from the package manifest so
// serverInfo.version never drifts from the published package version.
export function packageVersion(): string {
  try {
    const pkgPath = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<void> {
  const server = new Server(
    { name: "claude-omakase", version: packageVersion() },
    { capabilities: { tools: {} } }
  );

  const tools: Tool[] = [
    {
      name: "find_skill",
      description: findSkill.findSkillDescription,
      inputSchema: findSkill.findSkillInput,
      handle: (args) => findSkill.handle(findSkill.findSkillInput.parse(args)),
    },
    {
      name: "list_installed_skills",
      description: listInstalled.listInstalledDescription,
      inputSchema: listInstalled.listInstalledInput,
      handle: () => listInstalled.handle(),
    },
    {
      name: "install_skill",
      description: installSkill.installSkillDescription,
      inputSchema: installSkill.installSkillInput,
      handle: (args) => installSkill.handle(installSkill.installSkillInput.parse(args)),
    },
    {
      name: "uninstall_skill",
      description: uninstallSkill.uninstallSkillDescription,
      inputSchema: uninstallSkill.uninstallSkillInput,
      handle: (args) => uninstallSkill.handle(uninstallSkill.uninstallSkillInput.parse(args)),
    },
    {
      name: "update_skill",
      description: updateSkill.updateSkillDescription,
      inputSchema: updateSkill.updateSkillInput,
      handle: (args) => updateSkill.handle(updateSkill.updateSkillInput.parse(args)),
    },
    {
      name: "doctor_skills",
      description: doctor.doctorDescription,
      inputSchema: doctor.doctorInput,
      handle: () => doctor.handle(),
    },
    {
      name: "recommend_skills",
      description: recommend.recommendDescription,
      inputSchema: recommend.recommendInput,
      handle: (args) => recommend.handle(recommend.recommendInput.parse(args)),
    },
    {
      name: "onboard_starter_pack",
      description: onboard.onboardStarterPackDescription,
      inputSchema: onboard.onboardStarterPackInput,
      handle: (args) => onboard.handle(onboard.onboardStarterPackInput.parse(args), server),
    },
    {
      name: "set_profile",
      description: setProfile.setProfileDescription,
      inputSchema: setProfile.setProfileInput,
      handle: (args) => setProfile.handle(setProfile.setProfileInput.parse(args)),
    },
    {
      name: "propose_new_skill",
      description: proposeNewSkill.proposeNewSkillDescription,
      inputSchema: proposeNewSkill.proposeNewSkillInput,
      handle: (args) =>
        proposeNewSkill.handle(proposeNewSkill.proposeNewSkillInput.parse(args), server),
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) {
      throw new Error(`unknown tool: ${req.params.name}`);
    }
    try {
      const result = await tool.handle(req.params.arguments ?? {});
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (e) {
      return {
        isError: true,
        content: [
          { type: "text" as const, text: `Error: ${(e as Error).message}` },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Minimal Zod → JSON Schema. MCP clients only use a few field types.
// We avoid pulling in a full zod-to-json-schema lib since our schemas are
// small and shaped predictably.
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = zodToJsonSchema(v);
      if (!(v instanceof z.ZodOptional) && !(v instanceof z.ZodDefault)) {
        required.push(k);
      }
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }
  if (schema instanceof z.ZodString) {
    const out: Record<string, unknown> = { type: "string" };
    const desc = schema.description;
    if (desc) out["description"] = desc;
    return out;
  }
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchema(schema.element) };
  }
  if (schema instanceof z.ZodRecord) {
    return { type: "object", additionalProperties: zodToJsonSchema(schema.valueSchema) };
  }
  if (schema instanceof z.ZodOptional) return zodToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return zodToJsonSchema(schema.removeDefault());
  return {};
}

// Only boot when run as the entrypoint, so the module can be imported (e.g. by
// tests) without starting a transport. A `tui`/`manage` subcommand launches the
// interactive skill manager instead of the stdio MCP server, so the human CLI
// (`npx claude-omakase tui`) and the agent share one binary.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const subcommand = process.argv[2];
  const run =
    subcommand === "tui" || subcommand === "manage"
      ? import("./cli/tui.js").then((m) => m.runTui())
      : main();
  run.catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
