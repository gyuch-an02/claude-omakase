# omakase-chef (bundled skill)

This directory ships **inside the `claude-omakase` npm package**. When a user runs `install.sh`, the `SKILL.md` here is copied into `~/.claude/skills/omakase-chef/` so that every fresh Claude session loads the behavior.

`SKILL.md` is the soul of the product — it tells Claude **when to propose skills proactively**. Without it, the `omakase` MCP server is just a registry that needs to be asked. With it, Claude becomes the chef.

## Editing the chef

Changes here ship to all users on their next `npm install -g claude-omakase` (or `install.sh` re-run). Treat it like product copy:

- Bias toward concrete examples over abstract guidance — LLMs follow examples better than rules.
- Each rule should answer "when does Claude do this?" with a concrete trigger.
- If a phrasing change is non-obvious (e.g. "say it like X, not Y"), include a short rationale comment.
- Keep both Korean and English examples — the product targets both audiences.

## Why a skill and not a system prompt?

We don't control Claude Desktop's system prompt. Skills are the supported extension point:

- Loaded automatically from `~/.claude/skills/*/SKILL.md` on each session.
- Visible to the user (they can `cat` it and audit what we're telling Claude to do).
- Removable (delete the directory).
- Per-user (no global injection).

This means **the user is always in the loop**. They can read exactly what behavior we've defined and edit it themselves.
