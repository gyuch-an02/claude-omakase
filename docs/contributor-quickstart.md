# Add Your First Adapter in 30 Minutes

This guide is for a first-time contributor adding a new catalog source to Claude Omakase. The goal is a small PR that adds one adapter, proves it with a fixture-based test, and leaves `catalog.json` reproducible.

## What You Are Building

An adapter is a TypeScript module that turns an upstream source of Claude skills into Omakase `Entry[]` records.

You will add:

- `src/adapters/<source>.ts`
- `src/adapters/<source>.test.ts`
- a registration line in `src/adapters/index.ts`
- a refreshed `catalog.json`

Adapters do not install anything. They only produce metadata. Omakase installs skills later, after explicit user approval, by downloading declared `install.skill_files`.

## 0. Before You Start

You need:

- Node.js 20+
- npm
- a source URL that lists or describes Claude skills
- enough confidence that the source is safe to index

Clone, branch, and install:

```bash
git clone https://github.com/gyuch-an02/claude-omakase
cd claude-omakase
git switch -c <your-name>/<source>-adapter
npm install
npm run typecheck
npm test
```

Expected result: typecheck passes and tests pass.

Timing-run note: branch before editing. It is easy to lose time later separating unrelated files if you begin on `main` or on another issue branch.

## 1. Pick a Source

Good sources:

- expose skill directories, `SKILL.md` files, or a simple API
- provide stable HTTPS URLs
- identify the publisher or author
- let you derive a direct raw `SKILL.md` URL

Avoid sources that:

- require logging in for public catalog data
- only expose install commands with no inspectable skill file
- mix unrelated packages with no reliable way to detect Claude skills
- require running upstream code to discover entries

Write down the source assumptions at the top of the adapter file. Future maintainers should know what endpoint you used and which fields you trust.

## 2. Create the Adapter

Scaffold the adapter and its beside-file test:

```bash
npm run scaffold:adapter -- <source>
```

The source name must be kebab-case, for example `awesome-skills` or `company-docs`.
The command refuses to overwrite existing files, so it is safe to run before you
start editing.

It creates `src/adapters/<source>.ts` with this starting shape:

```ts
import type { Entry } from "../types.js";

export async function fetch(): Promise<Entry[]> {
  return [];
}
```

Each returned entry must include:

- `id`: kebab-case, stable, unique within your adapter
- `name`
- `type`: usually `"claude_code_skill"`
- `description`
- `tags`: at least one
- `verified`: usually `false` unless the repo has been manually audited
- `author.name`
- `install.skill_files`: direct HTTPS source URL and relative target path
- `source.adapter`: your adapter name

Minimal entry:

```ts
const entry: Entry = {
  id: "example-skill",
  name: "Example Skill",
  type: "claude_code_skill",
  description: "Shows the shape of an adapter-produced entry.",
  tags: ["example"],
  verified: false,
  author: { name: "Example Publisher" },
  homepage: "https://github.com/example/skills/tree/main/example-skill",
  install: {
    skill_files: [
      {
        source: "https://raw.githubusercontent.com/example/skills/main/example-skill/SKILL.md",
        target: "SKILL.md"
      }
    ]
  },
  source: {
    adapter: "example",
    origin: "https://github.com/example/skills"
  }
};
```

Do not execute upstream commands. Do not write files. Do not set `verified: true` unless the PR also explains the audit.

## 3. Add a Fixture-Style Test

The scaffold command already creates `src/adapters/<source>.test.ts` with a
passing fixture-style normalizer test. Replace the placeholder fixture with
recorded upstream input from your source.

Tests must not hit the live network. Put the parser or normalizer behind a small exported function, then test that function with recorded input.

Place the test beside the adapter:

```text
src/adapters/<source>.test.ts
```

Do not create a separate `__tests__/` directory for adapters. The current test runner discovers `src/**/*.test.ts`.

Pattern:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./example.js";

test("normalize: creates an installable entry", () => {
  const entry = normalize({
    id: "example-skill",
    name: "Example Skill",
    description: "Useful example.",
    skill_md_url: "https://raw.githubusercontent.com/example/skills/main/example-skill/SKILL.md"
  });

  assert.ok(entry);
  assert.equal(entry.id, "example-skill");
  assert.equal(entry.install.skill_files?.[0]?.target, "SKILL.md");
});
```

Test the boring failure cases too:

- missing id or name
- missing description
- missing raw `SKILL.md` URL
- non-HTTPS source URL
- duplicate tags

## 4. Register the Adapter

Edit `src/adapters/index.ts`.

Add the import:

```ts
import { fetch as fetchExample } from "./example.js";
```

Add it to `adapters` after trusted overlays and before lower-trust broad crawlers:

```ts
{
  name: "example",
  description: "Example public skill source.",
  fetch: fetchExample,
}
```

Order matters. First adapter wins on duplicate `id`s. Put handpicked and verified sources before community marketplaces.

## 5. Refresh the Catalog

Run:

```bash
npm run build
npm run build:catalog
```

Then inspect:

```bash
node -e "const c=require('./catalog.json'); console.log(c.entries.length, c.entries.map(e => e.id).slice(0, 10))"
```

If your adapter needs network and the network is unavailable, document that in the PR. The adapter registry catches failures so one broken source does not abort the whole refresh.

If `build:catalog` logs warnings from an unrelated adapter, do not hide them. Include the warning in your PR notes and explain whether your intended catalog entries still appeared. If the command exits successfully and your diff is expected, the warning may be follow-up work rather than a blocker for your adapter PR.

## 6. Run the Full Local Check

Run:

```bash
npm run typecheck
npm run build
npm test
npm run build:catalog
```

Before opening a PR, also inspect your diff:

```bash
git diff --stat
git diff -- src/adapters/<source>.ts src/adapters/<source>.test.ts src/adapters/index.ts
```

The diff should be boring: one adapter, one test, one registry line, and `catalog.json` if adapter output changed. Revert generated catalog timestamp churn if the catalog entries did not actually change.

## 7. PR Checklist

In the PR description, include:

- Source URL or API endpoint.
- What fields you parse.
- Why `verified` is `true` or `false`.
- How you derived `install.skill_files[*].source`.
- Local commands you ran.
- Any network failures or skipped entries.

Copyable checklist:

```md
## Adapter source

- Source:
- Trust level:
- Expected entry count:

## Parsing notes

- ID:
- Description:
- Author:
- SKILL.md URL:

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run build:catalog`

## Safety

- [ ] No install commands are executed by the adapter.
- [ ] All skill file sources are HTTPS.
- [ ] All skill file targets are relative paths.
- [ ] `verified: true` is used only for manually audited entries.
```

## Common Mistakes

- **Live network in tests:** Record a small fixture instead.
- **Unstable ids:** Use upstream slugs when available. Do not derive ids from mutable display names if a stable id exists.
- **Missing raw file URL:** A homepage is not enough. Omakase needs `install.skill_files[*].source`.
- **Over-trusting community sources:** Default to `verified: false`.
- **Silent drops:** If the adapter skips an entry, make the normalizer return `null` for a clear reason and cover it in tests.

## 30-Minute Timing Target

Use this pacing for the cold-start exercise:

- 0-5 min: clone, install, run baseline checks
- 5-10 min: inspect upstream source and write parsing assumptions
- 10-12 min: run `npm run scaffold:adapter -- <source>` and register the adapter
- 12-20 min: implement adapter and normalizer
- 20-25 min: add fixture tests
- 25-30 min: register adapter, refresh catalog, run checks

If you miss 30 minutes, write down exactly where you got stuck. That friction is valuable: it should become either a docs patch or a code-side DX fix.

## G10 Timing-Pass Fixes

The second contributor timing pass found that first-time authors lose time
copying the adapter shape, picking a test location, and remembering required
`Entry` fields. The `scaffold:adapter` command now creates the adapter and
beside-file test in one step, including:

- a source-assumptions header
- a normalizer stub
- an HTTPS `SKILL.md` guard
- duplicate-tag cleanup
- a fixture-style passing test

## C6 Timing-Pass Fixes

The first contributor timing pass found four avoidable slowdowns. This v1 quickstart bakes those fixes in:

- **Branch first:** the setup command now creates a feature branch before edits.
- **Test location:** adapter tests are explicitly placed at `src/adapters/<source>.test.ts`.
- **Catalog warnings:** contributors are told how to report unrelated adapter warnings without treating every warning as their own failure.
- **Diff hygiene:** contributors are told to revert generated `catalog.json` churn when entries did not change.

These notes are intentionally specific. If a future timing run finds new friction, update this section with the exact mistake and the doc or code change that prevents it.
