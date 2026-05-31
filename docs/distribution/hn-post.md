# HN Show Post — Claude Omakase

**Target:** Show HN
**Post after:** Day 7 demo

---

**Title:**

Show HN: Claude Omakase – MCP server that notices when you keep doing the same thing and offers to install the right skill

---

**Body:**

Claude Omakase is a small MCP server (~600 lines of TypeScript) that watches what you do in Claude Code and proactively suggests skills from a federated catalog — without you having to search for them.

The core loop:
1. You repeat a manual task (3+ times, or say "I always have to do this by hand")
2. Claude calls `find_skill` against a 400+ entry catalog
3. Claude proposes one install — no menu, just the best match
4. You say yes or no

If there's no match, Claude drafts a new SKILL.md tailored to your workflow using MCP sampling. You can PR it back and it goes in the catalog.

**Why "omakase"?** An omakase chef doesn't hand you a menu. They watch what you eat and serve exactly what belongs next. That's the UX model: Claude picks one, you approve.

**What it federates:**
- `modelcontextprotocol/servers` (Anthropic reference)
- `awesome-mcp-servers` (community list)
- `skillsmp.com` (public marketplace)
- `handpicked/*.json` (manually audited safety overlay)

**Install:**

```bash
npx claude-omakase-install
claude mcp add omakase -- npx -y claude-omakase
```

**Add a new catalog source in ~30 minutes:**

```bash
npm run scaffold:adapter -- <source-name>
# generates src/adapters/<name>.ts + beside test
# implement fetch(): Promise<Entry[]>
# register in src/adapters/index.ts
```

GitHub: https://github.com/gyuch-an02/claude-omakase

Built during a 7-day hackathon. Feedback on the adapter authoring contract especially welcome — we want this to be a community-maintained catalog, not a hand-curated list.
