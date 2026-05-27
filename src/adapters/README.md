# Adapter authoring contract

Each adapter is a TypeScript module exporting `fetch(): Promise<Entry[]>`. The adapter registry in `index.ts` enumerates them in trust order (handpicked first, community sources later) and dedupes by `id`, preserving the first occurrence.

## Adding a new adapter

1. Run `npm run scaffold:adapter -- <source-name>` to create `<source-name>.ts` and `<source-name>.test.ts`.
2. Implement `export async function fetch(): Promise<Entry[]>`. Throw on network errors — the registry catches and logs them per-adapter without aborting the whole build.
3. Register it in `index.ts`'s `adapters` array, placed according to its trust level (verified registry > community list > raw search).
4. Add the source URL and any parsing assumptions to `<source-name>.ts`'s header comment.
5. Keep the generated beside-file unit test at `<source-name>.test.ts` and pin a known input to an expected entry list. Do not hit the network in tests — use a recorded fixture.

## Required fields on `Entry`

Every adapter must populate at minimum:

- `id` (kebab-case, unique within its adapter; collisions across adapters are handled by the registry)
- `name`, `description`
- `type` (`claude_code_skill` | `claude_skill`)
- `tags` (at least one)
- `verified` (default `false`; only `true` if you can defend that decision)
- `author.name`
- `install.skill_files` (list of source URL → target relative path)
- `source.adapter` (your adapter's `name`)

Optional but encouraged: `homepage`, `version`, `license`, `requirements`.

## What adapters must NOT do

- Run install commands. Adapters are pure metadata producers.
- Set `verified: true` for entries you have not personally audited.
- Fetch data at MCP-server runtime. All network IO happens inside `scripts/build-catalog.mjs` and the result is baked into `catalog.json` shipped with the npm package.

## Build pipeline

`scripts/build-catalog.mjs` imports `adapters/index.ts`, calls `fetchAll()`, writes the merged result to `catalog.json` at the repo root, and runs a soft package-existence check against npm/PyPI for every `install.command` of type `npx` / `uvx`. CI fails on hard schema errors, soft-warns on missing packages.
