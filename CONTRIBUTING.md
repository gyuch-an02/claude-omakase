# Contributing

There are four ways to contribute, in roughly increasing order of effort:

## 1. Write a `handpicked/` overlay

You audited a Claude skill and want to mark it `verified: true`, or you want to override an adapter's install metadata. Drop a JSON file under `handpicked/`. See `handpicked/README.md` for the schema.

PR template asks one thing: explain what you actually ran to verify.

## 2. Write a new adapter

You know a source of Claude skills that we don't federate yet. Create `src/adapters/<source-name>.ts` implementing `export async function fetch(): Promise<Entry[]>`. See `src/adapters/README.md` for the full contract.

Each adapter PR should include:

- The adapter module.
- A unit test under `__tests__/<source-name>.test.ts` using a recorded fixture (no live network in tests).
- Registration in `src/adapters/index.ts` at the appropriate trust level.

## 3. Improve `omakase-chef/SKILL.md`

This is the file that shapes Claude's proactive behavior. Concrete examples beat abstract rules — if you can show Claude *exactly* the kind of trigger you want to add, the chef gets better at the same time.

`omakase-chef/README.md` has the editing notes.

## 4. Improve the MCP server itself

Tools, types, install pipeline, catalog cache. Standard TypeScript contribution. Ground rules:

- **Skill file writes go through `installer/code-skills.ts`.** It is the only module that creates files under `~/.claude/skills/<id>/`. Add tests when extending.
- **No silent installs.** `install_skill` and `propose_new_skill` are the only tools that write user-visible state; their description must signal "ask first" so Claude does. Don't add new write paths without the same protection.
- **Adapters never run install commands.** They are pure metadata producers.
- **Don't add a network call without a reason.** Today the only outbound paths are (a) catalog refresh and (b) skill file download during approved installs. New endpoints need an issue first.
- **TS types follow `src/types.ts`.** There is one source of truth for the catalog Entry shape.

## Local loop

```bash
npm install
npm run build
npm test
npm run typecheck
```

CI runs the same on every PR.

## Style

- Prettier defaults for TS. Tabs are fine, spaces are fine — Prettier picks for you.
- Imperative commit subject ≤ 72 chars. Reference the affected module in the prefix, e.g. `adapters/handpicked:` or `installer:` or `chef:`.

## Reporting security issues

Don't open a public issue. See `SECURITY.md`.
