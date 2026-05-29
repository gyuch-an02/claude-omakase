#!/usr/bin/env node
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const cyan  = (s: string) => `\x1b[0;36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[0;32m${s}\x1b[0m`;
const red   = (s: string) => `\x1b[0;31m${s}\x1b[0m`;

function requireNode(): void {
  const major = parseInt(process.versions.node.split(".")[0]!, 10);
  if (major < 20) {
    console.error(red(`Node.js 20+ required (found ${process.version}).`));
    process.exit(1);
  }
}

function installChefSkill(): void {
  const skillSrc = new URL("../../omakase-chef/SKILL.md", import.meta.url).pathname;
  const targetDir = join(homedir(), ".claude", "skills", "omakase-chef");
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(skillSrc, join(targetDir, "SKILL.md"));
  console.log(green(`Installed omakase-chef skill at ${targetDir}/SKILL.md`));
}

function printRegistrationSnippet(): void {
  console.log(`Add the following to your MCP host config and restart the host:

  {
    "mcpServers": {
      "omakase": {
        "command": "npx",
        "args": ["-y", "claude-omakase"]
      }
    }
  }`);
}

function main(): void {
  console.log(cyan("Claude Omakase installer"));
  console.log();

  requireNode();
  installChefSkill();

  console.log();
  console.log(green("Done."));
  console.log();
  console.log("Next steps:");
  printRegistrationSnippet();
  console.log();
  console.log(cyan("Uninstall:"));
  console.log(`  rm -rf "$HOME/.claude/skills/omakase-chef"`);
  console.log(`  remove the "omakase" entry from your MCP host config.`);
}

main();
