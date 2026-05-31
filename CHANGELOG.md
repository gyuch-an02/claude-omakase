# Changelog

All notable changes to this project will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added
- `set_profile` MCP tool — saves user role, languages, and tools for better recommendations
- `uninstall_skill`, `update_skill`, `doctor_skills` lifecycle tools
- `recommend_skills` V2: filters already-installed skills, returns match scores/reasons
- Catalog health probing via `node scripts/build-catalog.mjs --probe`
- Issue templates: bug report, feature request
- PR template
- Dependabot config (weekly npm + Actions updates)
- Branch protection on `main` (CI required, 1 review)
- GitHub topics: mcp, claude, claude-code, skill, anthropic, model-context-protocol

---

## [0.2.0] — 2026-05-30

### Added
- **MCP sampling for `propose_new_skill`** — Claude writes a tailored SKILL.md from scratch using `sampling/createMessage` instead of a generic template
- **Starter pack** — `recommend_skills` returns 4 universally useful skills (grill-me, understand-anything, write-a-skill, quick-review) when no skills are installed
- **4 new catalog adapters** → catalog grows from 3 to 400+ entries:
  - `mcp-servers-repo` — Anthropic's [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
  - `awesome-mcp` — community [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
  - `skillsmp` fixed — nested `data.skills` response shape now handled correctly
- **True omakase UX** — omakase-chef SKILL.md rewritten: one recommendation per moment, not a menu; always shows trigger phrase after install
- **Automated publishing** via npm Trusted Publishing (GitHub Actions OIDC, `environment: npm`)
- CODE_OF_CONDUCT.md, badges (npm, CI, MIT), community health files

### Fixed
- `skillsmp` adapter: was always returning 0 entries due to response shape mismatch
- Template placeholder substitution in `propose_new_skill` (`{{slug}}` etc. now render correctly)
- `recommend_skills` default limit reduced to 1 (omakase = one course at a time)

### Changed
- `omakase-chef/SKILL.md` completely rewritten to enforce chef-picks-one philosophy

---

## [0.1.0] — 2026-05-27

### Added
- Initial npm publish
- 5 MCP tools: `find_skill`, `list_installed_skills`, `install_skill`, `recommend_skills`, `propose_new_skill`
- Federated catalog from `handpicked/` + `skillsmp` adapter
- `omakase-chef/SKILL.md` bundled skill — proactive pattern detection
- `install.sh` + `npx claude-omakase-install` installer
- TypeScript MCP server, stdio transport
- CI: lint, typecheck, tests, catalog-refresh workflow

[Unreleased]: https://github.com/gyuch-an02/claude-omakase/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/gyuch-an02/claude-omakase/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gyuch-an02/claude-omakase/releases/tag/v0.1.0
