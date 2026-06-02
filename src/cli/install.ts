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

// Proactive hooks that make discovery deterministic. We copy them to a stable
// location so the registration snippet can reference a durable path (the npm
// package itself may live in an ephemeral npx cache). We do NOT register them —
// the user opts in by pasting the printed snippet into settings.json.
const HOOK_FILES = [
  "omakase-session-start.mjs",
  "omakase-repetition.mjs",
  "omakase-suggest.mjs",
];

function hooksTargetDir(): string {
  return join(homedir(), ".claude", "hooks", "omakase");
}

function installHooks(): void {
  const srcDir = new URL("../../hooks/", import.meta.url).pathname;
  const targetDir = hooksTargetDir();
  mkdirSync(targetDir, { recursive: true });
  for (const h of HOOK_FILES) {
    copyFileSync(join(srcDir, h), join(targetDir, h));
  }
  console.log(green(`Installed proactive hooks at ${targetDir}/`));
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

function printHooksSnippet(): void {
  const dir = hooksTargetDir();
  console.log(`Optional — make the chef proactive. Add this "hooks" block to your Claude Code
settings.json (SessionStart greets new users with the starter pack; the other
two nudge on repetition and matching prompts). Omakase never edits this file
for you:

  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node ${dir}/omakase-session-start.mjs" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node ${dir}/omakase-repetition.mjs" } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node ${dir}/omakase-suggest.mjs" } ] }
    ]
  }`);
}

function main(): void {
  console.log(cyan("Claude Omakase installer"));
  console.log();

  requireNode();
  installChefSkill();
  installHooks();

  console.log();
  console.log(green("Done."));
  console.log();
  console.log("Next steps:");
  printRegistrationSnippet();
  console.log();
  printHooksSnippet();
  console.log();
  console.log(cyan("Uninstall:"));
  console.log(`  rm -rf "$HOME/.claude/skills/omakase-chef" "$HOME/.claude/hooks/omakase"`);
  console.log(`  remove the "omakase" entry (and any omakase hooks) from your config.`);
}

main();
