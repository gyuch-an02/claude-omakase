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
npx -y -p claude-omakase claude-omakase-install

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

## Use cases

Concrete, end-to-end walkthroughs of what Omakase actually does.

### 1. First session — onboarding from zero

```
You:     (start a new Claude session, no skills installed)
Claude:  Before we get started — what kind of work do you do most?
You:     mostly code review and some data analysis
Claude:  Here's the starter pack. Pick the ones that fit — I'll install whatever you check:
         - [ ] Quick Review — one-line, severity-tagged feedback on any diff  ← best fit
         - [ ] Understand Anything — deep explanations that lead with WHY
         - [ ] Grill Me — stress-test a plan by getting interviewed
         - [ ] Write a Skill — turn a recurring workflow into a new skill
You:     the first two
Claude:  Installed Quick Review and Understand Anything to ~/.claude/skills/. Active next session.
```

### 2. Repeated manual work — proactive nudge

```
You:     (run `git diff`, review by hand; repeat across three PRs in one session)
Claude:  You've reviewed three diffs by hand this session. There's a Quick Review skill
         that gives one-line severity-tagged feedback — want me to install it?
You:     yes
Claude:  Done. Say "review this diff" next session to use it.
```

### 3. Intent in your prompt — suggestion without asking

```
You:     I need to automate browser testing across Chrome and Firefox
Claude:  That lines up with a browser-testing skill in the catalog (not installed yet) —
         want me to add it? (otherwise I'll just help directly)
```

### 4. Nothing matches — draft a new skill

```
You:     I keep reformatting our weird internal changelog format by hand
Claude:  No catalog skill covers that. Want me to draft one? I'll write a SKILL.md
         tailored to your changelog format and we'll iterate.
```

### 5. Manage what you've installed

```bash
npx claude-omakase tui
```

An interactive terminal app to **list** installed skills, **health-check** them
(missing `SKILL.md`? missing receipt? update available?), **update** them from the
catalog, and **remove** them — all with arrow keys and checkboxes. See
[Manage your skills](#manage-your-skills) below.

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
| `recommend_skills` | Ranked suggestions based on your profile, context, and install state (returns a ready-to-show `rendered` Markdown table/checklist) |
| `uninstall_skill` | Remove `~/.claude/skills/<id>/` and its install receipt (idempotent) |
| `update_skill` | Re-download a skill's files from the catalog |
| `doctor_skills` | Health report per skill: SKILL.md present? receipt present? in catalog? version match? |
| `set_profile` | Save your role, languages, and tools so recommendations improve over time |
| `propose_new_skill` | Draft a new SKILL.md from scratch using MCP sampling |

## Manage your skills

A terminal UI for the day-to-day lifecycle, no Claude session required:

```bash
npx claude-omakase tui      # or: omakase tui
```

It shows a health dashboard for every installed skill and lets you act on them:

```
┌  🍱  Claude Omakase — skill manager
│
◇  3 installed · 2 healthy · 1 need attention ───────────────╮
│      Skill              SKILL.md  Receipt  Catalog         │
│  ──────────────────────────────────────────────────────   │
│  ✅  quick-review        ✓         ✓        ✓               │
│  🔄  grill-me            ✓         ✓        update!         │
│  ⚠️  understand-anything ✗ missing ✓        ✓               │
╰────────────────────────────────────────────────────────────╯
│
◇  What would you like to do?
│  ● Re-run health check
│  ○ Update skill(s) from catalog
│  ○ Remove skill(s)
│  ○ Quit
```

- **Health check** — flags skills with a missing `SKILL.md`, a missing install receipt, or a newer version available in the catalog.
- **Update** — re-downloads selected skills' files from the catalog (multi-select).
- **Remove** — deletes selected skills and their receipts, with a confirmation prompt.

The same operations are available to Claude as the `doctor_skills`, `update_skill`, and `uninstall_skill` MCP tools.

## Proactive hooks (optional)

Two opt-in [Claude Code hooks](https://docs.claude.com/en/docs/claude-code/hooks) make discovery deterministic instead of relying on Claude noticing on its own. They ship in the repo under `hooks/` (not auto-installed — you register them yourself).

| Hook | Event | What it does |
|---|---|---|
| `omakase-repetition.mjs` | `PostToolUse` (Bash) | Tracks command workflows (single commands **and** multi-step chains via n-gram detection) in one **cross-session** file with timestamps; when a task recurs 2× within a rolling window, nudges Claude to find a matching skill. Heredoc bodies and shell keywords are filtered out. |
| `omakase-suggest.mjs` | `UserPromptSubmit` | Matches each prompt against the catalog; if a not-yet-installed skill clearly fits, suggests it once per session (with a cooldown). |

Register them in your Claude Code `settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "command": "node /path/to/claude-omakase/hooks/omakase-repetition.mjs" }
      ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [
        { "type": "command", "command": "node /path/to/claude-omakase/hooks/omakase-suggest.mjs" }
      ] }
    ]
  }
}
```

Tunable via env vars: `OMAKASE_REPETITION_THRESHOLD` (default 2), `OMAKASE_REPETITION_WINDOW_DAYS` (default 14), `OMAKASE_SUGGEST_THRESHOLD` (default 5), `OMAKASE_SUGGEST_COOLDOWN` (default 3 prompts). Both are local-only — no network, no telemetry.

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
