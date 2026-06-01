# Demo Script — Claude Omakase v0.2

**Audience:** Hackathon judges, potential contributors.
**Duration:** 5–7 minutes live, 3 minutes with backup video.
**Goal:** Show the full omakase loop: observe → detect → propose → approve → install → reuse.

---

## Setup (before demo, on demo machine)

```bash
# 1. Clone + build
git clone https://github.com/gyuch-an02/claude-omakase
cd claude-omakase
npm install && npm run build

# 2. Install the chef skill
node dist/cli/install.js

# 3. Register the local build with Claude Code
claude mcp add omakase -- node $(pwd)/dist/server.js

# 4. Verify MCP server is connected
claude mcp list   # should show: omakase  node /path/to/dist/server.js
```

**Verify before going on stage:**
- `~/.claude/skills/omakase-chef/SKILL.md` exists
- Claude Code shows "omakase" in MCP servers
- `node dist/server.js` starts without error

---

## Act 1 — First Session (30 sec)

Open Claude Code. Start a new session.

Claude will call `omakase.list_installed_skills` (zero receipts), then ask:

> "Before we get started — what kind of work do you do most?"

**Say:** *"I do code reviews — PRs, diffs, that kind of thing."*

Claude calls `recommend_skills` with context "code reviews", returns `quick-review` (starter-pack, verified).

Claude says something like:
> "The skill that fits best is **Quick Review** — it gives you one-line, severity-tagged feedback on any diff. Install it?"

**Say:** *"Yes."*

Claude calls `install_skill("quick-review")`, confirms path, tells you the trigger phrase.

**Talking point:** One question. One answer. One install. That's omakase.

---

## Act 2 — Proactive Detection (2 min)

Show the repetition trigger without staging it too obviously. Paste three different diff snippets and ask Claude to summarize each one manually.

After the third, Claude taps the shoulder:
> "You've summarized three diffs in this session. There's a `pr-summarizer` skill for this — one call instead of three. Want me to install it?"

If `pr-summarizer` is not in the catalog, Claude falls through to `propose_new_skill`.

**Fallback line if the trigger doesn't fire naturally:**  
*"I keep doing this manually every week"* → Claude calls `find_skill` proactively.

**Talking point:** Claude noticed. You didn't have to search.

---

## Act 3 — Propose New Skill (1.5 min)

**Say:** *"I don't see a skill for generating release notes from git log. I do this every sprint."*

Claude:
1. Calls `find_skill("release notes from git log")` — partial or no match.
2. Offers to draft a skill.
3. Calls `propose_new_skill({ description: "...", triggers: [...] })`.
4. Reads the draft SKILL.md back section by section.
5. Asks: *"What would you change?"*

**Show:** the file written to `~/.claude/skills/release-notes-draft/SKILL.md`.

**Talking point:** No match in 400+ entries? You draft it in 2 minutes. PR it back, it's in the catalog for the next person.

---

## Act 4 — Contributor Story (45 sec)

Switch to terminal. Show the adapter scaffold:

```bash
npm run scaffold:adapter -- linear-mcp
# Writes src/adapters/linear-mcp.ts + src/adapters/linear-mcp.test.ts
```

Open the generated file. Two functions to implement: `fetch()` and `normalize()`.

**Talking point:** New adapter in 30 minutes. Changwook ran the clock.

---

## Q&A Prep

| Expected question | Answer |
|---|---|
| "Does it send my data anywhere?" | Nothing leaves the machine. Catalog refresh is outbound-only, opt-in per install. |
| "What if the catalog entry is wrong?" | `handpicked/` overlay lets you pin a correct `install_command` or revoke `verified: true`. CI smoke-tests install commands before merge. |
| "Why not a GUI?" | The best interface is the one you're already in. Claude Code is where you work. |
| "Who maintains the catalog?" | Daily cron opens a PR. Humans review. CI blocks bad install commands. |
| "Can I use it with Claude Desktop?" | Yes — add the `mcpServers` block manually. Same `npx -y claude-omakase` command. |

---

## Backup Video

Record with OBS or QuickTime before Day 7. Cover Acts 1–3 minimum.
File: save to `docs/demo-backup.mp4` (gitignored — add if needed).
