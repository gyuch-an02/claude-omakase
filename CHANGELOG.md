# Changelog

All notable changes to this project will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [0.7.4] — 2026-06-15

### Fixed (signal quality — from real-world user feedback)
- **Trigger extraction no longer mistakes shell fragments for tasks (root cause).** The repetition detector split commands on `;` `|` `&&` *without respecting quotes*, so words inside a quoted body leaked out as fake "task signatures": `python -c "...; system call"` became a recurring `system` workflow, `node -e "const ..."` became `const`. Quoted bodies are now blanked before splitting, and interpreters running inline code (`node -e`, `python -c`, `bash -c`, `psql -c`, `ssh "…"`) are dropped entirely — an ad-hoc inline script is never a repeatable task worth a skill. This was the source of most false nudges.
- **Matching ignores meaningless tokens.** Pure-number/number-ish tokens (`06`, `00`, `2024`) and a set of over-generic tech words (`system`, `data`, `server`, `script`, …) were matching skill-id segments (e.g. `csv-to-sif-06-00`, `data-visualization-system`) and burying the genuinely relevant skill at score 0. Tokens now require a letter and skip the generic set, on both the query and the document-frequency side. Shared by the hook and the MCP `find_skill`/`recommend_skills`.
- **Hooks no longer try to hijack the agent loop.** The injected PostToolUse context was imperative ("call `omakase.find_skill`, pick the best, propose, ask") — firing mid-task on noise. It is now a quiet, explicitly *ignorable* hint: judge first, default to staying silent and continuing the user's task, and never run a tool or interrupt just to act on it.

### Added
- `hooks/omakase-repetition.test.mjs` regression tests for the above: quote-aware segmentation, inline-eval rejection, clean signatures for real commands, and the non-imperative note framing. `signatures`/`stripQuotedBodies`/`buildNote` are now exported (the hook still self-runs only as the entrypoint).

## [0.7.3] — 2026-06-11

### Added
- **Claude Code plugin packaging.** The repo is now installable as a plugin (and hosts its own marketplace): `/plugin marketplace add gyuch-an02/claude-omakase` → `/plugin install claude-omakase@omakase`. One command bundles the MCP server (`.mcp.json` → `npx -y claude-omakase`), the omakase-chef skill, and all three proactive hooks **auto-registered** via `hooks/hooks.json` — no `settings.json` editing, no separate installer. Plugin hooks resolve the committed `catalog.json` via their bundled-path fallback, so no cache seeding is needed on this channel.
- **Plugin contract tests** in `scripts/installer-contract.test.mjs`: plugin.json version stays in sync with package.json, hooks.json references only existing files and mirrors the manual snippet's events/matcher, the chef skill path is shared by both install channels, marketplace.json points at the repo root.

### Changed
- **`omakase-chef/` moved to `skills/omakase-chef/`** — the plugin default skills path. Both installers (`install.sh` raw URL, `claude-omakase-install` package-relative copy) now source from the new location; the install destination (`~/.claude/skills/omakase-chef/`) is unchanged.
- README: plugin install is the recommended path; the manual path is kept for Claude Desktop / other MCP hosts, with a warning not to combine both (double hook registration).

## [0.7.2] — 2026-06-11

### Fixed
- **The proactive suggest hook honors "never recommend again".** `offer_skill`'s permanent declines (`declined.json`) were excluded by `find_skill`/`recommend_skills` but NOT by the `UserPromptSubmit` hook — a declined skill kept being re-suggested once per session on every matching prompt. The hook now reads the decline list (`$XDG_DATA_HOME/claude-omakase/declined.json`) and skips those ids.
- **Catalog refresh no longer wipes LLM enrichment.** `enrich-catalog.mjs` writes `search_terms` into catalog.json, but adapters never emit that field — so every full `build:catalog` (including the daily CI refresh) silently dropped all enrichment. `build-catalog.mjs` now carries `search_terms` forward from the previous catalog by id (a refreshed entry with its own terms still wins).
- **`doctor_skills` flags empty SKILL.md files.** A zero-byte `SKILL.md` (truncated download, interrupted write) counted as healthy even though Claude Code ignores it. Doctor now reports `skill_md_empty` and excludes such skills from the healthy count; the TUI shows `✗ empty`.

### Added
- **TUI: install from catalog.** `claude-omakase tui` gains an "Install skill(s) from catalog (search)" action — keyword search through the same ranking as `find_skill` (declined skills excluded), multi-select, per-skill failure isolation. The TUI now covers the full lifecycle (install/update/remove/health) instead of only the second half.

## [0.7.1] — 2026-06-11

### Fixed
- **Installed hooks actually run.** Both installers (`install.sh` and `claude-omakase-install`) copied the three hook entry points to `~/.claude/hooks/omakase/` but not `_shared.mjs`/`retrieval.mjs`, which all three import — every installed hook died with `ERR_MODULE_NOT_FOUND`. Both installers now ship the two modules alongside the hooks.
- **Installed hooks can see a catalog.** From `~/.claude/hooks/omakase/`, the hooks' bundled-catalog fallback (`../catalog.json`) doesn't exist, and the XDG cache copy was only written after a remote/live fetch — so the suggest hook and the repetition hook's catalog gate silently no-oped on a fresh install. Now: both installers seed `~/.cache/claude-omakase/catalog.json`, and the server refreshes that cache copy whenever it serves from the bundled catalog.
- **Picker failures in `offer_skill` / `propose_new_skill` no longer abort the tool.** Both called `elicitInput()` unguarded; a client that advertises elicitation but errors/times out (e.g. headless session) turned the whole call into an opaque error. `offer_skill` now returns a loud `picker-error` mode with a text fallback (matching `recommend_skills`); `propose_new_skill` treats the concept-edit form as optional and proceeds with the proposed concept, reporting `concept_form_error`.
- **Partial catalog rebuilds can't emit duplicate ids.** `mergeSelectedAdapters` concatenated preserved + refreshed entries without dedupe, so an id owned by a non-selected adapter (e.g. handpicked) could appear twice after a selected adapter (e.g. skillsmp) started producing the same id. Preserved entries now win and each id appears once.
- **Daily catalog refresh uses the intended skillsmp budget.** `catalog-refresh.yml` declared `OMAKASE_SKILLSMP_MAX_REQUESTS`/`MAX_PAGES_PER_SEED` twice; YAML last-key-wins silently downgraded the authenticated budget from 450/6 to 180/2. Duplicate keys removed.
- **Handpicked entries are shape-validated.** A hand-edited `handpicked/*.json` missing `id`/`tags`/`install` used to pass `JSON.parse(...) as Entry` silently and crash downstream (`entry.tags.includes` in recommend). Invalid files are now skipped with a loud per-field reason.
- **skillsmp adapter hardened against untrusted response data.** A null/non-object hit or non-string `id`/`name`/`description`/`author`/`skillUrl` no longer throws mid-page (which aborted the whole adapter); path-like ids (`owner/repo/...`) are slugified so install dirs stay flat; an invalid `OMAKASE_SKILLSMP_*` env value now warns and falls back instead of silently fetching zero pages.
- **Atomic install receipts** — `install_skill` writes receipts via temp+rename like every other state file, so a crash mid-write can't leave a truncated receipt for `doctor`/`update` to choke on.
- **Dev web server binds loopback by default.** `web-server.ts` exposes unauthenticated install/uninstall endpoints and used to listen on all interfaces; it now binds `127.0.0.1` unless `OMAKASE_WEB_HOST` is set explicitly.

### Changed
- **Zero-entry adapters log loudly** during federation — an adapter that quietly returns `[]` (broken auth, changed API shape) looked identical to a healthy run while the daily refresh preserved stale entries forever.
- **`claude-omakase-install` hook snippet now registers the repetition hook for Edit/Write/MultiEdit/NotebookEdit too**, matching `install.sh` — the edit-tools signal (recurring doc updates) existed in the hook but the npm installer's snippet never wired it.
- **github-skills adapter logs skipped SKILL.md fetches** (404/403) instead of silently dropping the entry.
- **Lint ignores `web/dist/`** build artifacts.

### Added
- **AI-usage log back at `docs/ai-log.md`** — reverses the 0.5.0 removal below. The team submission guideline requires the AI-usage log to live in the product repo for review. Seeded as the merged/frozen log (sourced from the out-of-repo `ai_log/ai-log-frozen.md`), then kept current per PR via a **soft PR-template checklist item** — append a dated bullet entry when AI tools materially shaped the PR, skip otherwise. This is a reminder, **not** a CI gate: the `ai-log-check` workflow and the `CLAUDE.md` "Skill: ai-usage-log" section stay gone, so a missing entry never fails CI.

## [0.6.0] — 2026-06-04

### Added
- **GitHub SKILL.md search adapter** — federates community skills by searching GitHub code for `SKILL.md` files, deriving raw URLs and reading frontmatter for name/description/tags. Token-gated (`GITHUB_TOKEN`); scraped entries are always `verified: false`. Handles blob URLs whose branch names contain slashes via `repository.default_branch`.
- **IDE/editor preferences in the profile** — `set_profile` now accepts `ides` (e.g. `["Claude Code", "VS Code", "Cursor"]`) and `recommend_skills` folds them into ranking tokens.
- **Selected-adapter catalog builds** — `scripts/build-catalog.mjs` can build from a chosen subset of adapters for faster iteration.
- **Hero logo + restructured README header.**

### Fixed
- **Bundled `omakase-chef` no longer shows up as a user skill** — it was counted in `list_installed_skills` and flagged by `doctor_skills`/the TUI as an unhealthy, receipt-less, not-in-catalog skill. An `isInternalSkillId()` choke point now excludes it from install counts, the health dashboard, and recommendation install-state — so a fresh user reads "0 installed" (and still gets the full starter pack) rather than "1".
- **Atomic skill install** — files are staged in a temp dir and renamed into `~/.claude/skills/<id>/` only after every write succeeds; a failed download leaves no partial install, and a failed forced reinstall preserves the existing one. Orphan `.tmp-*` staging dirs are ignored by the lifecycle scans.
- **Atomic catalog cache write** — the cache is written through a same-dir temp file and renamed into place, so an interrupted write can't truncate `catalog.json`.
- **One failed skill no longer crashes the TUI batch** — update/remove operations are isolated per skill; a single failure is reported and the loop continues.
- **Long skill ids are truncated in the TUI** — a very long scraped id (e.g. `summarize-github-pull-request-…`) used to overflow its column and collide with the `SKILL.md`/`Receipt`/`Catalog` markers. Names are now clipped to the column width with an ellipsis.
- **Exact hyphenated skill-id matching** and **refined-zod tool-schema unwrapping** so tool inputs with `.refine()`/defaults expose correct JSON Schema.

### Changed
- **Repetition hook fires on tasks, not tooling.** `hooks/omakase-repetition.mjs` was over-eager: default threshold 2 plus a `SKIP` list that only covered shell builtins meant ordinary dev noise (`grep`, `cut`, `git status`, `npm run`, `gh pr`, …) tripped a "find a skill" nudge — recommending on nearly every run instead of when it mattered. Now: (1) default `OMAKASE_REPETITION_THRESHOLD` raised 2 → 3; (2) `SKIP` extended with primitive text/file/system tools; (3) a new `DENY_SIG` set drops VCS/build/pkg/infra plumbing subcommands (analysis-flavored ones like `git diff`/`blame`/`show` are kept — repeating those is a real "review this" signal); (4) a catalog gate stays silent when no catalog is available, since `find_skill` would return nothing. Added `hooks/omakase-repetition.test.mjs` covering SKIP, DENY_SIG, the kept-analysis case, composite workflows, the threshold, and the catalog gate.
- **`find_skill` description** aligned with the skill-only catalog.
- **Lint coverage** extended to `scripts/` and `hooks/`.

## [0.5.0] — 2026-06-03

### Added
- **Interactive TUI** — `npx claude-omakase tui` (alias `manage`) launches a `@clack/prompts` skill manager: a health dashboard per installed skill plus update/remove via checkboxes. `tui.ts` exports `runTui()`; the pure render helpers (`statusIcon`/`catalogCell`/`renderTable`) are now unit-tested.

### Fixed
- **Path traversal via catalog `entry.id`** — `code-skills.install/uninstall` fed `entry.id` into `join()`+`mkdir`/`rmSync` with no guard (while `uninstall_skill`'s input did). A scraped or remote-overridden entry with id `../x` could create or `rmSync` a directory outside `~/.claude/skills/`. Added `assertSafeId()` at the choke point, covering install + update.
- **Malformed catalog crashed the whole server** — a catalog that is valid JSON but lacks an `entries` array crashed `sanitizeCatalog` on `entries.map`, taking down every tool. Readers now validate shape and fall through; a bad remote throws (logged, not silently emptied).
- **`propose_new_skill` could write into the skills root** — a `task_description` with no ASCII alphanumerics produced an empty slug; now validated against the kebab-case pattern before writing.
- **Renderer didn't escape skill names** — a scraped name with `|` or a newline could break the rendered Markdown table/checklist; names are now clipped and pipe-escaped.
- **npx entrypoint detection** — the server now starts reliably when launched through the npx / global-install shim.

### Removed
- **`onboard_starter_pack` tool** — merged into `recommend_skills`. It duplicated the gap computation and split one concept ("set up the starter pack") across two tools that differed only by entry point (empty vs. partial install). `recommend_skills` with no context now drives the picker for both cases. The toolset drops from 11 to 10.
- **In-repo AI-usage log convention** — deleted `docs/ai-log.md`, the `ai-log-check` workflow, the `CLAUDE.md` "Skill: ai-usage-log" section, and the PR-template checklist item. That log was a hackathon-level meta concern that had leaked into the product repo (wrong place, wrong format); contributors no longer need to add a `docs/ai-log.md` entry per PR.

### Changed
- **`recommend_skills` now owns starter-pack onboarding end to end.** With no context it offers the full pack (no skills installed) or the missing staples (partial install), and on elicitation-capable clients it shows a real checkbox picker and installs the selection directly (`mode: "installed"` / `"declined"`). Non-picker paths are **loud, never silent**: a picker that errors or times out returns `mode: "picker-error"`, and a client without elicitation returns `picker: "unsupported"` — both carry the `rendered` checklist and a `next_step` that tells Claude to say *why* there's no picker before falling back to text.
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

## [0.4.1] — 2026-06-02

### Fixed
- **Reliable stdio in any environment.** The MCP server now routes `console.log`/`info`/`debug` to stderr at startup, so stdout is reserved strictly for the JSON-RPC stream. A stray stdout write from the server or any transitive dependency would corrupt the protocol and surface as "failed to connect" in a fresh `npx -y claude-omakase` registration. Added an end-to-end stdio handshake test (`src/e2e/server-handshake.test.ts`) that spawns the built server, runs `initialize` + `tools/list`, and asserts the full toolset plus pure-JSON stdout — the MCP contract a clean-env client depends on, which the handler unit tests never exercised.

---

## [0.4.0] — 2026-06-02

A suite of interactive flows built on **MCP elicitation** — the chat surface now drives real native dialogs instead of display-only Markdown.

### Added
- **Interactive starter-pack onboarding** — new `onboard_starter_pack` tool. On MCP clients that support **elicitation** (e.g. Claude Code), it shows a *real* native checkbox picker (one box per missing starter skill) and installs exactly what the user checks — no markdown, no text parsing. On clients without elicitation it returns a Markdown checklist (`mode: "markdown-fallback"`) to drive the old type-to-select flow. `omakase-chef/SKILL.md` first-session flow rewritten to call it. Resolves the limitation that the previous checklist was display-only markdown, not a selectable widget.
- **Interactive `offer_skill`** — offers one found skill with a native **Install / Not now / Never recommend** picker via elicitation; on clients without it, returns `mode: "ask"` (then call again with `decision`). "Never" is persisted to a local block list (`~/.local/share/claude-omakase/declined.json`) and excluded from both `find_skill` and `recommend_skills` thereafter.
- **`propose_new_skill` concept editing** — on elicitation-capable clients, before drafting it shows an editable form (skill id / what it does / triggers) so the user can tweak the concept first; `concept_edited` is reported in the response.

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

[Unreleased]: https://github.com/gyuch-an02/claude-omakase/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/gyuch-an02/claude-omakase/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/gyuch-an02/claude-omakase/compare/v0.4.1...v0.5.0
[0.2.0]: https://github.com/gyuch-an02/claude-omakase/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gyuch-an02/claude-omakase/releases/tag/v0.1.0
