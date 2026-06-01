# Anthropic Discord / Community Post

**Target:** Anthropic Discord #mcp-servers or #claude-code channel
**Post after:** Day 7 demo

---

**Post:**

Hey everyone — we just shipped **Claude Omakase**, an MCP server that makes Claude proactively suggest and install skills based on what it observes you doing.

**The pitch:** Instead of searching a catalog, Claude notices when you repeat the same manual task and taps you on the shoulder with the right skill. You say yes or no. One skill at a time, no menus.

**What's inside:**
- 6 MCP tools: `find_skill`, `list_installed_skills`, `install_skill`, `recommend_skills`, `set_profile`, `propose_new_skill`
- 400+ catalog entries federated from Anthropic's MCP repo, awesome-mcp-servers, skillsmp, and a handpicked safety overlay
- A bundled `omakase-chef` skill that drives the proactive behavior
- Daily CI cron that refreshes the catalog and opens a PR on drift
- `propose_new_skill` — when nothing matches, Claude drafts a new SKILL.md using MCP sampling

**Install:**
```
npx claude-omakase-install
claude mcp add omakase -- npx -y claude-omakase
```

**Contributing is intentionally fast:** `npm run scaffold:adapter -- <name>` generates a new adapter with a test. Implement `fetch()` and open a PR. We timed it at ~30 minutes from clone to green CI.

Repo: https://github.com/gyuch-an02/claude-omakase

Would love feedback especially on: skill matching quality, adapter contract, and any catalog sources we should federate next.

---

**Twitter/X thread version:**

1/ Just shipped Claude Omakase — an MCP server that turns Claude into a proactive skill curator.

The idea: instead of hunting for skills yourself, Claude notices when you keep doing the same thing manually and offers to install the right skill. You approve. One skill at a time.

2/ The loop:
- Claude sees you do the same thing 3x
- calls find_skill against a 400+ entry catalog
- proposes ONE skill with a one-sentence reason
- you say yes → it installs to ~/.claude/skills/ → active next session

No menus. That's the whole point.

3/ If nothing matches, Claude drafts a new SKILL.md using MCP sampling, writes it to your skills dir as a draft, and iterates with you until it's right. You can PR it back to the community catalog.

4/ The catalog is federated — daily CI pulls from Anthropic's MCP repo, awesome-mcp-servers, skillsmp, and a handpicked safety overlay. New adapters take ~30 minutes to write.

Install: npx claude-omakase-install && claude mcp add omakase -- npx -y claude-omakase

https://github.com/gyuch-an02/claude-omakase
