#!/usr/bin/env bash
#
# Claude Omakase one-line installer.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/gyuch-an02/claude-omakase/main/install.sh | bash
#
# What it does:
#   1. Verifies node >= 20 is on PATH.
#   2. Drops the bundled omakase-chef SKILL.md into ~/.claude/skills/omakase-chef/.
#   3. Copies the proactive hooks into ~/.claude/hooks/omakase/ (a stable path),
#      but does NOT register them — it prints an opt-in snippet you paste yourself.
#   4. Prints instructions for registering the claude-omakase MCP server
#      with your Claude Code (or other MCP host) of choice.
#
# What it does NOT do:
#   - Edit any Claude application config file. We deliberately keep Claude
#     Desktop / Claude Code config edits out of automated scripts. You register
#     the server yourself with the snippet printed at the end.
#   - Install global npm packages. We use `npx -y claude-omakase` so the user
#     can always pin / uninstall by editing config.
#   - Send any data anywhere. The script reads the network only to fetch this
#     file and the bundled SKILL.md.

set -euo pipefail

cyan()  { printf '\033[0;36m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*" >&2; }
ylw()   { printf '\033[0;33m%s\033[0m\n' "$*"; }

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    red "node is required but not found on PATH."
    red "Install Node.js 20+ from https://nodejs.org/ and re-run this script."
    exit 1
  fi
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt 20 ]; then
    red "Node.js 20+ required (found $(node --version))."
    exit 1
  fi
}

# Pull the omakase-chef SKILL.md from GitHub and drop it into ~/.claude/skills/.
install_chef_skill() {
  local target_dir="$HOME/.claude/skills/omakase-chef"
  mkdir -p "$target_dir"
  local url="https://raw.githubusercontent.com/gyuch-an02/claude-omakase/main/omakase-chef/SKILL.md"
  if ! curl -fsSL "$url" -o "$target_dir/SKILL.md"; then
    red "failed to download SKILL.md from $url"
    exit 1
  fi
  green "Installed omakase-chef skill at $target_dir/SKILL.md"
}

# Copy the proactive hooks to a stable path. We never register them — the user
# opts in via the snippet printed at the end.
HOOK_FILES="omakase-session-start.mjs omakase-repetition.mjs omakase-suggest.mjs"

install_hooks() {
  local hooks_dir="$HOME/.claude/hooks/omakase"
  mkdir -p "$hooks_dir"
  local base="https://raw.githubusercontent.com/gyuch-an02/claude-omakase/main/hooks"
  local h
  for h in $HOOK_FILES; do
    if ! curl -fsSL "$base/$h" -o "$hooks_dir/$h"; then
      red "failed to download $h from $base/$h"
      exit 1
    fi
  done
  green "Installed proactive hooks at $hooks_dir/"
}

print_registration_snippet() {
  cat <<'SNIPPET'
Add the following to your MCP host config (for example, your Claude Code
project-level config) and restart the host so it picks up the new server:

  {
    "mcpServers": {
      "omakase": {
        "command": "npx",
        "args": ["-y", "claude-omakase"]
      }
    }
  }
SNIPPET
}

print_hooks_snippet() {
  local hooks_dir="$HOME/.claude/hooks/omakase"
  cat <<SNIPPET
Optional — make the chef proactive. Add this "hooks" block to your Claude Code
settings.json (SessionStart greets new users with the starter pack; the other
two nudge on repetition and matching prompts). Omakase never edits this file
for you:

  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node ${hooks_dir}/omakase-session-start.mjs" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node ${hooks_dir}/omakase-repetition.mjs" } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node ${hooks_dir}/omakase-suggest.mjs" } ] }
    ]
  }
SNIPPET
}

main() {
  cyan "Claude Omakase installer"
  echo

  require_node
  install_chef_skill
  install_hooks

  echo
  green "Done."
  echo
  ylw "Next steps:"
  print_registration_snippet
  echo
  ylw "Proactive hooks (optional):"
  print_hooks_snippet
  echo
  cyan "Uninstall:"
  echo "  rm -rf \"\$HOME/.claude/skills/omakase-chef\" \"\$HOME/.claude/hooks/omakase\""
  echo "  remove the \"omakase\" entry (and any omakase hooks) from your config."
}

main "$@"
