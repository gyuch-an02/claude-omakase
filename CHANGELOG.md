# Changelog

All notable changes to this project will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Removed
- **In-repo AI-usage log convention** — deleted `docs/ai-log.md`, the `ai-log-check` workflow, the `CLAUDE.md` "Skill: ai-usage-log" section, and the PR-template checklist item. That log was a hackathon-level meta concern that had leaked into the product repo (wrong place, wrong format); contributors no longer need to add a `docs/ai-log.md` entry per PR.

### Changed
- **Repetition hook rewrite** (`hooks/omakase-repetition.mjs`): now tracks signatures in one **cross-session** file with timestamps and a rolling window (default 14 days) instead of resetting per session; default threshold lowered 3 → 2; signature extraction drops heredoc bodies, shell keywords, and non-command fragments (no more `5.`/`##`/`done`/`)"` false positives). Tunable via `OMAKASE_REPETITION_THRESHOLD` and `OMAKASE_REPETITION_WINDOW_DAYS`.
- **Installer now ships the hooks.** `install.sh` and `claude-omakase-install` copy all proactive hooks to `~/.claude/hooks/omakase/` (a stable path) and print an opt-in `settings.json` snippet. They still never edit your Claude config. The `hooks/` directory is now included in the published npm package.

### Added
- **Session-start onboarding hook** — `hooks/omakase-session-start.mjs` (`SessionStart`): on a fresh session (`startup`/`clear`, not resume/compact) it injects a one-shot instruction telling Claude to run the omakase-chef *Session start* routine immediately, so new users are greeted with the starter pack instead of having to ask. Delegates all branching to `omakase.list_installed_skills`; fires at most once per `OMAKASE_SESSION_COOLDOWN_HOURS` (default 24, set `0` to greet every startup). Opt-in; register it yourself.
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

## [0.3.0] — 2026-06-01

### Added
- **Skill manager TUI** — `npx claude-omakase tui` (also `omakase tui`): an interactive terminal app to list installed skills, health-check them (missing SKILL.md / receipt / update available), update from the catalog, and remove them. Built on `@clack/prompts` (new runtime dependency). The `claude-omakase` binary now dispatches on a `tui`/`manage` subcommand; with no subcommand it still starts the stdio MCP server.
- **Pretty rendering for suggestions** — `recommend_skills` and `find_skill` now return a `rendered` field: a ready-to-show Markdown checklist (starter-pack onboarding) or table (search/profile results), so Claude shows a clean table/checklist in chat instead of improvising one.
- **Proactive suggestion hook** — `hooks/omakase-suggest.mjs` (`UserPromptSubmit`): matches each prompt against the catalog and suggests a fitting, not-yet-installed skill once per session (with a cooldown). Distinct from the repetition hook and from `propose_new_skill`. Opt-in; register it yourself.
- **`Suggest a skill for the catalog` issue template** + `ISSUE_TEMPLATE/config.yml` (quickstart + security contact links) to make the lowest-effort contribution path guided.

### Changed
- README: new **Use cases** section (5 end-to-end walkthroughs), **Manage your skills** (TUI) section, **Proactive hooks** section, and the lifecycle tools added to the MCP tools table.

---

## [0.2.4] — 2026-06-01

### Added
- **Lifecycle tools** (supersedes #67, rebased onto current `main`): `uninstall_skill` (idempotently removes `~/.claude/skills/<id>/` + receipt), `update_skill` (force-reinstalls from catalog `skill_files`), and `doctor_skills` (per-skill health report: SKILL.md present? receipt present? in catalog? version match?).
- `recommend_skills` profile-search results now carry `match_score` + `match_reasons` so the chef can explain why a pick fits.

### Note
- #67's original branch was built on a stale base and would have reverted the `packageVersion()` serverInfo fix and the test-import boot guard in `server.ts`, plus the starter-pack-gap / profile / checklist work in `recommend.ts`. Only the genuinely new pieces were salvaged onto current `main`; the regressions were dropped.

---

## [0.2.3] — 2026-06-01

### Changed
- **Starter-pack onboarding is now a checklist.** `recommend_skills` returns the full starter pack (mode `starter-pack`) and every missing staple (mode `starter-pack-gap`) with `present_as: "checklist"`, so first-time and returning users can select and install any subset at once. This is the one deliberate exception to omakase's "serve exactly one" rule — all other modes still return a single pick. `omakase-chef/SKILL.md` updated to match.

### Added
- **Deterministic repetition detector** (`hooks/omakase-repetition.mjs`) — opt-in `PostToolUse(Bash)` hook that counts repeated command signatures (single commands, plus multi-step chained/sequential workflows via n-gram detection) and nudges Claude to call `find_skill` once a workflow repeats 3×. Replaces the soft, model-judgment-only repetition trigger with a reliable one for demos. Not auto-wired by `install.sh` — register it manually.

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
