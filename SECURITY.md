# Security policy

## Reporting a vulnerability

Email `gyuch.an02@kaist.ac.kr` with:

1. A minimal reproducer or proof-of-concept.
2. The version / commit you tested against.
3. Any constraints on disclosure timing on your end.

Do **not** open a public GitHub issue for security reports.

We aim to acknowledge within **72 hours** and ship a fix or mitigation within **30 days** for confirmed reports. Coordinated disclosure preferred.

## Threat model

- **Malicious catalog entry → arbitrary code execution.** An attacker submits an adapter PR or `handpicked/` overlay whose `skill_files` source URL points at attacker-controlled content. Mitigation: every `verified: true` flag goes through human review; community entries display the source URL before install; the MCP server never auto-installs without explicit Claude→user approval.
- **Skill file write outside the sandbox.** A bug in `installer/code-skills.ts` could write outside `~/.claude/skills/<id>/`. Mitigation: target paths are resolved and rejected if they escape the per-id directory. Adding to the write path requires tests.
- **Profile / observation data exfiltration.** Mitigation: data stays on disk under `~/.local/share` and `~/.config`; the MCP server makes no outbound calls beyond the catalog refresh and skill file downloads.

Out of scope:

- Vulnerabilities in upstream skills the user installs through us — report those upstream.
- Issues that require the attacker to already have local code execution.
- Edits to Claude Desktop / Claude Code host config files. We do not write to those.

## What `claude-omakase` writes

| Path | Purpose |
|---|---|
| `~/.claude/skills/<id>/` | Skill files dropped by `install_skill`. Removed by hand or by deleting the corresponding install receipt. |
| `~/.config/claude-omakase/profile.json` | User profile. |
| `~/.local/share/claude-omakase/installed/<id>.json` | Install receipts. |
| `~/.cache/claude-omakase/catalog.json` | Cached catalog with 6h TTL. |

Nothing else.
