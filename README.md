# Claude Omakase

> *"Skill 설치는 어려워. 우리가 골라줄게."*
> The chef picks. You approve.

**Claude Omakase** is an MCP server plus a bundled `omakase-chef` skill that turns Claude into a proactive curator of Claude skills. You register it once with your MCP host. After that, when Claude notices you doing similar manual work three times in a row, *Claude itself* offers to install the right skill into `~/.claude/skills/`. You say yes or no. The chef does the rest.

```
┌───────────────────────────────────────────────────────────┐
│                       Claude Code                         │
│                                                           │
│   ┌──────────────────┐         ┌──────────────────────┐   │
│   │ omakase-chef     │  reads  │  claude-omakase MCP  │   │
│   │ SKILL.md         │ ───────▶│  server (stdio)      │   │
│   │ (behavior)       │         │  (registry+install)  │   │
│   └──────────────────┘         └──────────┬───────────┘   │
└─────────────────────────────────────────│─────────────────┘
                                          │ build-time
                                          ▼
            ┌────────────────────────────────────────────┐
            │ Federated catalog                          │
            │  - handpicked verified seeds               │
            │  - skillsmp adapter                        │
            └────────────────────────────────────────────┘
```

## Scope

- **In:** Claude skills (`claude_code_skill`, `claude_skill`) installed into `~/.claude/skills/<id>/`.
- **Out:** Claude Desktop config edits, MCP-server install destinations. The catalog only carries entries we can install as skill files.

## Install

One line:

```bash
curl -fsSL https://raw.githubusercontent.com/gyuch-an02/claude-omakase/main/install.sh | bash
```

Requirements: Node.js 20+ and Claude Code (or another MCP host) installed.

Release note: the installer prints an `npx -y claude-omakase` MCP snippet. The
npm package publication path is tracked in
[issue #48](https://github.com/gyuch-an02/claude-omakase/issues/48); until that
is resolved, use a local checkout with `npm link` for development and demos.

Fallback MCP config for the local `npm link` path:

```json
{
  "mcpServers": {
    "omakase": { "command": "claude-omakase" }
  }
}
```

The script:

1. Drops `omakase-chef/SKILL.md` into `~/.claude/skills/omakase-chef/`.
2. Prints an `mcpServers` snippet for you to add to your MCP host config by hand. We deliberately do not edit any host config file automatically.

That's the only manual step. After this, every install is a conversation.

## What you can ask Claude

Once registered, the chef is active in every session. Things that "just work":

- "I keep redrafting commit messages by hand — can you help?" → Claude finds a `git-commit-helper` skill, asks to install it.
- "Summarize this PR for me." → Claude proposes a `pr-summarizer` skill, installs it on approval.
- *(no prompt at all)* You ask Claude to summarize three PRs in one conversation → Claude says "I noticed you keep asking for PR summaries. Want me to drop in the `pr-summarizer` skill so it's one tool call from now on?"
- "What can I install?" → `recommend_skills` runs against your profile.

You can also explicitly:

- `I have a recurring task that doesn't have a skill yet.` → Claude scaffolds a new `SKILL.md` you can refine (via `propose_new_skill`).

## Tools the MCP exposes

| Tool | Purpose |
|---|---|
| `find_skill` | Search the federated catalog by task description. |
| `list_installed_skills` | Read install receipts plus the contents of `~/.claude/skills/`. |
| `install_skill` | Drop skill files into `~/.claude/skills/<id>/` and write a receipt. |
| `recommend_skills` | Top-N suggestions from profile, recent context, and installed state. |
| `propose_new_skill` | Scaffold a draft `SKILL.md` when no catalog entry matches. |

## Why an MCP server (and not a desktop app)?

- Discovery should happen **in conversation**, not in a separate window.
- A chat-native LLM already has the context to make better recommendations than a search box.
- A TypeScript MCP server is a small, sharp surface — easy to read, easy to extend.

The trade-off: there is no clickable catalog browser. If you want to see what's available, ask Claude. If you want raw data, read `catalog.json` directly.

## Federation, not curation

The catalog is **federated** from upstream sources at build time. `handpicked/` is a small verification overlay — not the primary source of truth. The community contributes by writing **adapters** (one TypeScript file each), not by maintaining a registry by hand.

Currently active sources:

- `handpicked/` — manually-audited verified seed entries and overrides. Current bundled seeds include `jupyter-notebook`, `openai-docs`, and `playwright`.
- `skillsmp` — the public agent-skills marketplace at [skillsmp.com](https://skillsmp.com) (the source behind ByteDance's `find-skills` SKILL). Adapter at `src/adapters/skillsmp.ts`.

Planned: more community skill aggregators as stable, inspectable sources are identified.

Adapter authoring contract: `src/adapters/README.md`. First-time adapter
contributors can start with:

```bash
npm run scaffold:adapter -- <source-name>
```

## Privacy

Everything Omakase writes stays on your machine:

- `~/.config/claude-omakase/profile.json` — your profile.
- `~/.local/share/claude-omakase/installed/` — install receipts.
- `~/.cache/claude-omakase/catalog.json` — cached catalog.

No telemetry. No accounts. The MCP server makes outbound calls only for (a) the catalog refresh at first run and (b) downloading skill files when you approve an install.

## Develop

```bash
git clone https://github.com/gyuch-an02/claude-omakase
cd claude-omakase
npm install
npm run build           # tsc compile
npm run build:catalog   # federate adapters → catalog.json
npm run scaffold:adapter -- <source-name>
npm run typecheck
npm test
```

Run the MCP server locally to test against Claude Code:

```bash
npm link                # symlinks `claude-omakase` bin
# Then add to your MCP host config:
# {
#   "mcpServers": {
#     "omakase": { "command": "claude-omakase" }
#   }
# }
# Restart the host so it picks up the new server.
```

## License

MIT. © 2026 Claude Omakase contributors.
