# Upstream PR #602 Description Update

Target:

- <https://github.com/TensorBlock/awesome-mcp-servers/pull/602>

Updated body:

```md
Adds Claude Omakase to the Developer Productivity & Utilities section.

Claude Omakase is a small MCP server plus bundled Claude skill that helps Claude recommend and install Claude Code skills from a federated catalog, with explicit user approval before writing to `~/.claude/skills/`.

Why it belongs in this list:

- It is an MCP server intended for Claude users and Claude Code workflows.
- It focuses on developer productivity: repeated-task detection, skill discovery, and approved skill installation.
- Its catalog is federated through adapter modules rather than maintained only as a static list.
- The project now includes a contributor quickstart for adding a new catalog adapter in about 30 minutes.

Hackathon validation notes:

- The adapter onboarding path was tested through the G10 timing/DX pass in `gyuch-an02/claude-omakase#26`.
- The resulting DX PR added `npm run scaffold:adapter -- <source-name>` so first-time contributors can generate an adapter module and beside-file test from one command.
- Final CI for that PR passed in 16 seconds.
- Local validation passed with 20 tests.
- The adapter smoke report showed 3 entries, 3 passed, 0 failed, and 0 skipped.

This follows the list format with a single repository link and one-sentence description.
```

Reason for the update:

- Issue #33 asks us to polish upstream PR descriptions with the live timing results from C6/G10.
- This body keeps the upstream contribution concise while documenting why Claude Omakase is mature enough to list.
