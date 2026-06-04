# Trust & Safety

Claude Omakase installs third-party content (`SKILL.md` files, and metadata that
names npm/PyPI packages) into a user's `~/.claude/skills/`. That makes it a
**supply-chain surface**. This document is the single place that states what runs
automatically, what requires a human, and what every trust marker actually means.
If anything here conflicts with code, the code wins — file a bug.

## Threat model — what we defend against

1. **Hallucinated entries.** An LLM (an adapter, `propose_new_skill`, or a
   `handpicked/` draft) invents a package that doesn't exist, a `SKILL.md` URL
   that 404s, a fabricated publisher, or an `http://` source. "The JSON looks
   right" does not catch these.
2. **Malicious or compromised sources.** A federated source serves a `SKILL.md`
   that instructs Claude to do something harmful, or a package name that
   typosquats a real one.
3. **Silent installation.** Anything landing in `~/.claude/skills/` without the
   user explicitly approving it.
4. **Path escape.** An install target that writes outside
   `~/.claude/skills/<id>/`.

## The boundary — automated vs. human

| Action | Who decides | Enforcement |
| --- | --- | --- |
| Catalog entry is **well-formed & resolvable** | Automated | 3 gates below (`scripts/test-adapter.mjs`) |
| Catalog entry is **`verified: true`** | **Human audit only** | `handpicked/README.md` checklist; never a CI side effect |
| Adapter-only PR **merges** | Automated *after* CI | `adapter-auto-merge.yml` — see "Auto-merge" |
| Skill is **installed** to disk | **End user, explicitly** | `install_skill` asks first; `omakase-chef` SKILL.md forbids silent installs |
| Install **target path** | Automated reject | `src/installer/code-skills.ts` — relative-only, no `..`, no absolute |

Two things are deliberately **never** automated: flipping `verified` to `true`,
and writing a skill to disk without user approval.

## The three gates (every LLM-generated entry)

Defined in full in [`ai-protocol.md`](ai-protocol.md). Summary:

1. **Schema** — conforms to the `Entry` shape in [`src/types.ts`](../src/types.ts).
   `type` is exactly `claude_code_skill` or `claude_skill`; required fields
   present; no invented top-level fields; `id` kebab-case and not colliding with
   a higher-trust source.
2. **Install resolvability** — every install target must exist:
   `install.skill_files[*].source` returns **HTTP 200**; `install.command`
   packages resolve on their registry (`registry.npmjs.org` / `pypi.org`). An
   entry with neither is invalid.
3. **HTTPS-only sources** — `install.skill_files[*].source` must start with
   `https://`. No `http://`, `file://`, or relative paths. `target` must be a
   simple relative path landing under `~/.claude/skills/<id>/`.

Run the automated gates against the built catalog:

```bash
npm run build
npm run build:catalog
npm run test:adapter -- --fail-on-error   # gate a merge; omit the flag for the soft daily refresh
```

## What `verified: true` means (and does not)

- **Means:** a human ran the [`handpicked/README.md` audit checklist](../handpicked/README.md#audit-checklist)
  — confirmed the publisher, the HTTPS `SKILL.md` URL, the relative target, and
  that Omakase runs no install command or post-install script — and recorded it
  in the entry's `audit.checks`.
- **Does NOT mean:** CI is green. The gates above prove an entry is *resolvable
  and well-formed*, not *trustworthy*. Never set `verified: true` to make a check
  pass.

Unverified entries still appear in the catalog; the chef prefers `verified: true`
when recommending, and the user always approves the actual install.

## Auto-merge — the tightest surface, explained

`adapter`-labeled, adapter-only PRs can auto-merge. The guardrails
([`automation.md`](automation.md)):

- The workflow runs on `pull_request_target` and **does not check out or execute
  PR code** — it only asks GitHub to enable auto-merge.
- Auto-merge completes **only after the required `CI / build` check passes** on a
  non-draft PR labeled `adapter`.
- Requires repo auto-merge enabled + branch protection requiring `CI / build` on
  `main`.

Adapters are **pure metadata producers** — they never run an install command. The
package/URL they name is only ever fetched (a) during the resolvability gate and
(b) when an end user approves an install.

## Rollback

A bad `catalog.json` refresh is restored from the last good ref:

```bash
git switch -c rollback/catalog-refresh
git checkout <known-good-ref> -- catalog.json
npm run test:adapter -- --out adapter-smoke-report.json
```

Verify the rollback path without touching the working tree:

```bash
npm run verify:catalog-rollback
```

## Privacy / outbound network

No telemetry, no accounts. The only outbound calls are (a) catalog refresh and
(b) skill-file download during an **approved** install. New endpoints require an
issue first (see [`CONTRIBUTING.md`](../CONTRIBUTING.md) ground rules).

## Reporting a vulnerability

Do not open a public issue. See [`SECURITY.md`](../SECURITY.md).
