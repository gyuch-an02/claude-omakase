# Claude Omakase

[![npm version](https://img.shields.io/npm/v/claude-omakase.svg)](https://www.npmjs.com/package/claude-omakase) [![CI](https://github.com/gyuch-an02/claude-omakase/actions/workflows/ci.yml/badge.svg)](https://github.com/gyuch-an02/claude-omakase/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> *The chef picks. You approve.*

**Claude Omakase** is an MCP server that turns Claude into a proactive skill curator. Register it once, and Claude will notice when you keep doing the same thing manually — then offer to install the right skill for you. No searching, no reading docs. Just say yes or no.

```
┌──────────────────────────────────────────────────────────┐
│                      Claude Code                         │
│                                                          │
│  ┌─────────────────┐         ┌──────────────────────┐   │
│  │ omakase-chef    │  calls  │ claude-omakase MCP   │   │
│  │ SKILL.md        │ ──────▶ │ server (stdio)       │   │
│  │ (the behavior)  │         │ (registry + install) │   │
│  └─────────────────┘         └──────────┬───────────┘   │
└────────────────────────────────────────│────────────────┘
                                         │ fetched at build time
                                         ▼
         ┌──────────────────────────────────────────────┐
         │  Federated catalog (400+ skills)             │
         │  ├── handpicked/     verified seeds + overlay │
         │  ├── mcp-servers-repo  Anthropic reference   │
         │  ├── awesome-mcp       community list        │
         │  └── skillsmp          public marketplace    │
         └──────────────────────────────────────────────┘
```

## How it works

1. **You install the MCP server** — one `npx` command added to your MCP host config.
2. **Claude watches** — the bundled `omakase-chef` skill instructs Claude to monitor your workflow in the background.
3. **Claude notices** — after you repeat the same kind of manual task three times, Claude surfaces the right skill from the catalog.
4. **You approve** — Claude installs it to `~/.claude/skills/` and it's active next session.

First time? Claude greets you with a **starter pack** of universally useful skills so you're not starting from zero.

## Install

```bash
# 1. Install the omakase-chef skill
npx claude-omakase-install

# 2. Add the MCP server to your Claude Code config
claude mcp add omakase -- npx -y claude-omakase
```

**Requirements:** Node.js 20+, Claude Code (or another MCP host that supports stdio servers).

That's it. Restart your Claude session and the chef is active.

<details>
<summary>Manual MCP config (Claude Desktop or other hosts)</summary>

Add this to your MCP host config file and restart the host:

```json
{
  "mcpServers": {
    "omakase": {
      "command": "npx",
      "args": ["-y", "claude-omakase"]
    }
  }
}
```

</details>

## What Claude does for you

Once registered, these things just happen:

| Situation | Claude does |
|---|---|
| You summarize three PRs in one session | Offers to install `pr-summarizer` |
| You mention "I always have to do X by hand" | Searches for a skill that covers X |
| You ask "what can I install?" | Runs `recommend_skills` against your profile |
| No skills installed yet | Shows the starter pack |
| No catalog match found | Drafts a new `SKILL.md` tailored to your task using MCP sampling |

You can also be explicit: *"I have a recurring task that doesn't have a skill yet"* → Claude calls `propose_new_skill`, writes a draft SKILL.md to `~/.claude/skills/`, and iterates with you until it's right.

## Starter pack

When you have no skills installed, `recommend_skills` returns four universally useful skills:

| Skill | What it does |
|---|---|
| **Grill Me** | Stress-tests your plans — Claude interviews you relentlessly, one hard question at a time |
| **Understand Anything** | Deep explanations of code, systems, or concepts — leads with WHY, not HOW |
| **Write a Skill** | Turns any recurring workflow into a reusable Claude skill |
| **Quick Review** | Fast, severity-tagged code review (`🔴 bug`, `🟡 perf`, `🔵 style`) — no praise, no fluff |

Install any of them: *"Install the Grill Me skill"* → Claude calls `install_skill("grill-me")`.

## MCP tools

| Tool | Description |
|---|---|
| `find_skill` | Search the catalog by task description |
| `list_installed_skills` | List installed skills and install receipts |
| `install_skill` | Download and install a skill to `~/.claude/skills/<id>/` |
| `recommend_skills` | Ranked suggestions based on your profile, context, and install state |
| `set_profile` | Save your role, languages, and tools so recommendations improve over time |
| `propose_new_skill` | Draft a new SKILL.md from scratch using MCP sampling |

## Catalog

The catalog is federated from multiple sources at build time. Nothing is hand-curated — adapters generate entries, and a daily CI job opens a PR if the catalog drifts.

| Adapter | Source | Notes |
|---|---|---|
| `handpicked` | `handpicked/*.json` in this repo | Manually audited, `verified: true` |
| `mcp-servers-repo` | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Anthropic reference servers |
| `awesome-mcp` | [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | Community list |
| `skillsmp` | [skillsmp.com](https://skillsmp.com) | Public marketplace |

Want to add a source? See `src/adapters/README.md` and run:

```bash
npm run scaffold:adapter -- <source-name>
```

## Privacy

Everything Omakase writes stays on your machine:

| Path | Contents |
|---|---|
| `~/.claude/skills/<id>/` | Installed skill files |
| `~/.config/claude-omakase/profile.json` | Your profile (role, languages, tools) |
| `~/.local/share/claude-omakase/installed/` | Install receipts |
| `~/.cache/claude-omakase/catalog.json` | Cached catalog (refreshed every 6h) |

No telemetry. No accounts. Outbound calls happen only for catalog refresh and skill file downloads (when you approve an install).

## Develop

```bash
git clone https://github.com/gyuch-an02/claude-omakase
cd claude-omakase
npm install
npm run build           # compile TypeScript
npm run build:catalog   # fetch all adapters → catalog.json
npm run typecheck       # type check without emitting
npm test                # run all tests
```

Register your local build with Claude Code:

```bash
claude mcp add omakase -- node /path/to/claude-omakase/dist/server.js
```

## Contributing

All contributions are welcome — from first-timers to seasoned TypeScript developers.

**Good first issues:** look for the [`good first issue`](https://github.com/gyuch-an02/claude-omakase/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) label.

**Quick ways to contribute:**

- **New adapter:** `npm run scaffold:adapter -- <name>` → implement `fetch(): Promise<Entry[]>` → register in `src/adapters/index.ts` → PR.
- **New handpicked entry:** add a JSON file to `handpicked/` following the `Entry` shape in `src/types.ts`.
- **Bug or feature:** open an issue or PR — all contributions welcome.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full guide, including the PR checklist and local dev loop.

We follow the [Contributor Covenant](CODE_OF_CONDUCT.md). Please read it before participating.

## License

MIT. © 2026 Claude Omakase contributors.
