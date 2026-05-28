# Hallucination-Check Protocol for LLM-Generated Catalog Entries

When Claude (or any LLM) drafts a catalog `Entry` — a `handpicked/*.json` overlay,
an adapter's output, or a `propose_new_skill` scaffold — it can produce
**plausible but false** metadata: a package that doesn't exist, a `SKILL.md` URL
that 404s, a fabricated publisher, or an `http://` source. None of these are
caught by "the JSON looks right." This protocol defines the three gates every
LLM-generated entry must pass before it is trusted (`verified: true`) or merged.

The gates below are not new tooling. They formalize what
[`scripts/test-adapter.mjs`](../scripts/test-adapter.mjs) already enforces and what
[`handpicked/README.md`](../handpicked/README.md) asks auditors to check by hand.

## Gate 1 — Schema validation

The entry must conform to the `Entry` shape in
[`src/types.ts`](../src/types.ts). An LLM will happily omit required fields or
invent new ones, so validate structurally, not by eye.

Required fields:

- `id` — kebab-case, unique within its source
- `name`
- `type` — exactly `"claude_code_skill"` or `"claude_skill"`
- `description` — describes what the skill actually instructs Claude to do
- `tags` — non-empty array
- `verified` — boolean; only `true` after a real audit (see Gate 2 + the
  `handpicked/README.md` checklist)
- `author.name`
- `install.skill_files` — at least one `{ source, target }` pair
- `source.adapter` — e.g. `"handpicked"`

Reject the entry if:

- any required field is missing or the wrong type
- `type` is not one of the two allowed values
- an unknown top-level field was invented (flag it; it is usually a hallucination)
- `id` is not kebab-case or collides with an existing entry from a
  higher-trust source

## Gate 2 — Install resolvability

Every install target the LLM names must actually exist. This is the gate that
catches invented URLs and package names.

- **`install.skill_files[*].source`** — must return **HTTP 200**. A `HEAD`
  request is enough; fall back to `GET` on `403`/`405`.
- **`install.command`** (legacy field) — the named package must resolve in its
  registry:
  - `npx <pkg>` → `https://registry.npmjs.org/<pkg>` returns 200
  - `uvx`/`pipx <pkg>` → `https://pypi.org/pypi/<pkg>/json` returns 200
- An entry with neither `install.command` nor `install.skill_files` is invalid.

Run the automated check against the built catalog:

```bash
npm run build
npm run build:catalog
npm run test:adapter -- --fail-on-error
```

`test:adapter` writes `adapter-smoke-report.json` and lists every failed check.
Without `--fail-on-error` it is a soft check (exit 0) for the daily refresh; use
`--fail-on-error` when gating a merge.

## Gate 3 — HTTPS-only sources

Every `install.skill_files[*].source` **must start with `https://`**. No
`http://`, no `file://`, no relative paths, no IP literals. Plaintext or local
sources cannot be audited or trusted and are rejected before the HTTP-200 check
even runs (see `checkSkillFile` in
[`scripts/test-adapter.mjs`](../scripts/test-adapter.mjs)).

`install.skill_files[*].target` must be a simple **relative** path that lands
under `~/.claude/skills/<id>/` (e.g. `"SKILL.md"`). Absolute paths or `..`
segments are rejected.

## Manual audit (before `verified: true`)

Automated gates prove the entry is *resolvable and well-formed*. They do not
prove the source is *trustworthy*. Before setting `verified: true`, also confirm
the publisher, scope, and reviewability items in the
[`handpicked/README.md` audit checklist](../handpicked/README.md#audit-checklist),
and record what you checked in the entry's `audit.checks` field:

```json
"audit": {
  "audited_by": "Your Name",
  "audited_at": "2026-05-28",
  "checks": [
    "Publisher is the public <org> repository.",
    "Install source is HTTPS and returned HTTP 200 during audit.",
    "Install target is a single relative SKILL.md file.",
    "No install command or post-install script is executed by Omakase."
  ]
}
```

## When a gate fails

- **Do not** "fix" a 404 source by guessing another URL. Go back to the upstream
  page and copy the real raw URL, or drop the entry.
- **Do not** flip `verified` to `true` to make a check pass. `verified` reflects a
  human audit, not a green CI run.
- If the LLM invented a field or package, treat the whole entry as suspect and
  re-derive it from the upstream source by hand.
