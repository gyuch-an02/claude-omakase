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
import * as proposeNewSkill from "./tools/propose-new-skill.js";

interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handle: (args: unknown) => Promise<unknown>;
}

async function main(): Promise<void> {
  const server = new Server(
    { name: "claude-omakase", version: "0.1.0" },
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
      name: "recommend_skills",
      description: recommend.recommendDescription,
      inputSchema: recommend.recommendInput,
      handle: (args) => recommend.handle(recommend.recommendInput.parse(args)),
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
