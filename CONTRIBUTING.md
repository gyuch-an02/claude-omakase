# Contributing

There are five ways to contribute, in roughly increasing order of effort:

## 1. Write a `handpicked/` overlay

You audited a Claude skill and want to mark it `verified: true`, or you want to override an adapter's install metadata. Drop a JSON file under `handpicked/`. See `handpicked/README.md` for the schema.

PR template asks one thing: explain what you actually ran to verify. For `verified: true`, include the publisher check, the HTTPS `SKILL.md` URL check, and the target-path check from `handpicked/README.md`.

## 2. Write a new adapter

You know a source of Claude skills that we don't federate yet. Create `src/adapters/<source-name>.ts` implementing `export async function fetch(): Promise<Entry[]>`. See `src/adapters/README.md` for the full contract.

Each adapter PR should include:

- The adapter module.
- A unit test beside the adapter, e.g. `src/adapters/<source-name>.test.ts`, using a recorded fixture or normalizer input. No live network in tests.
- Registration in `src/adapters/index.ts` at the appropriate trust level.
- A refreshed `catalog.json` from `npm run build:catalog` when adapter output changes.

First-time adapter contributors should start with `docs/contributor-quickstart.md`; it is written for a 30-minute clone-to-green-CI run.

## 3. Add or refine a `profiles/*.json` role default

Role profiles help `recommend_skills` pick useful defaults for a user's work style. Add one JSON file per role or refine an existing one.

Each profile PR should include:

- `role`, `match`, and `recommend`.
- `evidence` entries that justify the match terms with short source notes.
- Recommendations that point at catalog ids that exist or are expected to exist after the same PR.

## 4. Improve `omakase-chef/SKILL.md`

This is the file that shapes Claude's proactive behavior. Concrete examples beat abstract rules — if you can show Claude *exactly* the kind of trigger you want to add, the chef gets better at the same time.

`omakase-chef/README.md` has the editing notes.

## 5. Improve the MCP server itself

Tools, types, install pipeline, catalog cache. Standard TypeScript contribution. Ground rules:

- **Skill file writes go through `installer/code-skills.ts`.** It is the only module that creates files under `~/.claude/skills/<id>/`. Add tests when extending.
- **No silent installs.** `install_skill` and `propose_new_skill` are the only tools that write user-visible state; their description must signal "ask first" so Claude does. Don't add new write paths without the same protection.
- **Adapters never run install commands.** They are pure metadata producers.
- **Don't add a network call without a reason.** Today the only outbound paths are (a) catalog refresh and (b) skill file download during approved installs. New endpoints need an issue first.
- **TS types follow `src/types.ts`.** There is one source of truth for the catalog Entry shape.

## Local loop

```bash
npm install
npm run typecheck
npm run build
npm test
npm run build:catalog
```

CI runs the same on every PR.

Notes from the first contributor timing pass:

- Create a branch before making issue-specific edits, e.g. `git switch -c changwook/<issue-slug>`.
- Keep one issue per PR. If you discover a blocker, open or use a separate blocker PR instead of mixing scopes.
- Adapter tests live beside adapter code in `src/adapters/*.test.ts`; do not use `__tests__/`.
- If `npm test` prints `shopt: globstar: invalid shell option name` on macOS but still reports passing tests, treat it as a known script portability warning.
- `npm run build:catalog` may log adapter warnings in restricted or schema-drift environments. The important questions are whether the command exits successfully and whether the intended catalog diff is expected.

## PR flow

Use GitHub's closing keywords in the PR body, not in local-only notes:

- `Closes #123` when the PR fully satisfies the issue acceptance criteria.
- `Refs #123` when the PR is partial or preparatory.
- Do not manually close an issue before the PR merges. Let GitHub auto-close it on merge when possible.

Before opening a PR, include:

- What changed.
- Why it is safe.
- Which checks you ran.
- Any known warnings or follow-up work.

## Style

- Prettier defaults for TS. Tabs are fine, spaces are fine — Prettier picks for you.
- Imperative commit subject ≤ 72 chars. Reference the affected module in the prefix, e.g. `adapters/handpicked:` or `installer:` or `chef:`.

## Reporting security issues

Don't open a public issue. See `SECURITY.md`.
