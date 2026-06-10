# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`claude-omakase` is a **Skill Suggester MCP server**: it federates a catalog of
Claude skills/MCP servers from external sources, then exposes tools that let
Claude proactively recommend and install them. Ships with a bundled
`omakase-chef` skill (the *behavior*) alongside the server (the *registry +
executor*).

## Commands

```bash
npm install
npm run lint        # eslint src scripts hooks
npm run typecheck   # tsc --noEmit
npm run build       # tsc → dist/
npm test            # node --test over src/**/*.test.ts, scripts/*.test.mjs, hooks/*.test.mjs
```

Run a single test file (tests are `node:test`, run through `tsx`):

```bash
node --test --import tsx --test-reporter=spec src/tools/find-skill.test.ts
node --test --test-reporter=spec scripts/catalog-merge.test.mjs   # .mjs needs no tsx
```

Catalog + adapter workflow:

```bash
npm run build:catalog                       # run all adapters → catalog.json
npm run build:catalog -- --adapters handpicked,skillsmp   # subset
npm run test:adapter -- --fail-on-error     # resolvability gate; writes adapter-smoke-report.json
npm run scaffold:adapter <name>             # new adapter from template
```

Web UI (optional catalog browser, not part of the MCP):

```bash
npm run web:install && npm run web:dev      # express API + vite UI (concurrently)
```

## Architecture (the big picture)

Two-phase: **federation in CI/build time → serving at runtime.** They do not
run together on the user's machine — the server reads a pre-built `catalog.json`,
it does not fetch upstream sources live.

**Build time — `scripts/build-catalog.mjs` → `catalog.json`**
- `src/adapters/index.ts` is the registry. Each adapter (`handpicked`,
  `skillsmp`, `github-skills`) returns
  `Entry[]`. **Order matters**: `fetchAll` dedupes by `id`, first-listed adapter
  wins on collision, later adapters only *upgrade* omitted fields (tags etc.).
  Put trusted sources first.
- `handpicked/*.json` is a **safety overlay** (verified flags, blocklist,
  install-command overrides) — not the primary catalog. Do not hand-write
  catalog entries elsewhere; add an adapter or a `handpicked/` overlay.
- `catalog.json` is committed and shipped in the npm package.

**Runtime — `src/server.ts` (stdio MCP)**
- Registers ~10 tools: `find_skill`, `list_installed_skills`, `install_skill`,
  `recommend_skills`, `propose_new_skill`, `offer_skill`, `set_profile`,
  `uninstall_skill`, `update_skill`, `doctor_skills` (each in `src/tools/`).
- `src/catalog/` loads `catalog.json` + a TTL cache (`cache.ts`) and does the
  keyword/tag search (`search.ts`); `render.ts`/`sanitize.ts` shape output.
- `src/installer/code-skills.ts` writes skills to `~/.claude/skills/<id>/`.
  Install targets are validated relative paths — absolute / `..` rejected.
- **stdout is reserved strictly for the JSON-RPC stream.** `server.ts` rebinds
  `console.log/info/debug` to stderr at startup; any stray stdout write corrupts
  the protocol and the client reports "failed to connect". Never `console.log`
  to stdout in server-path code.

**Behavior layer (not code)**
- `omakase-chef/SKILL.md` is the proactive logic Claude follows ("observe →
  pick one → serve → install on approval"). `hooks/*.mjs` (session-start,
  repetition detector) nudge the chef. The MCP never auto-installs — approval
  happens at the LLM layer.

## Conventions

- **Catalog entries are never trusted by eye.** Any LLM-generated `Entry`
  (a `handpicked/*.json`, adapter output, or `propose_new_skill` scaffold) must
  pass the three gates in [`docs/ai-protocol.md`](docs/ai-protocol.md):
  schema-valid (`src/types.ts`), install-resolvable (HTTP 200 / registry lookup),
  HTTPS-only source. `verified: true` reflects a **human audit**
  (`handpicked/README.md` checklist), not a green CI run — never flip it to pass
  a check.
- Adapter failures are non-fatal: `fetchAll` logs and skips a failing adapter so
  one bad source can't sink the build.
- ESM throughout (`"type": "module"`). Relative imports use `.js` extensions
  (TS source, compiled output) even though the files are `.ts`.

## Out of scope

GUI catalog browser as a product (the `web/` dir is a dev aid), hand-curated
catalog entries, multi-model support, auto-updates. See `docs/` for the v0.2 PRD.
