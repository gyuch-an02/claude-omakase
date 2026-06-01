---
name: Suggest a skill for the catalog
about: Propose a Claude skill to add as a verified handpicked entry
title: "skill: <skill name>"
labels: ["skill-suggestion", "good first issue"]
---

<!--
This is the easiest way to contribute. If a skill exists that the catalog
doesn't surface (or surfaces with wrong metadata), propose it here — then send a
`handpicked/<id>.json` PR. See handpicked/README.md for the schema + audit rules.
-->

## The skill

- **Name:**
- **Proposed id (kebab-case):**
- **What it does (one sentence):**
- **Homepage / source repo:**
- **`SKILL.md` raw URL (must be `https://`):**
- **Suggested tags:**

## Why it belongs in the catalog

<!-- Who is it for? What recurring task does it remove? Why isn't an adapter enough? -->

## Audit checklist (required for `verified: true`)

Check what you actually verified — see `handpicked/README.md` for details.

- [ ] **Publisher** is nameable/defensible (official org, maintainer, repo with history)
- [ ] **Source URL** is `https://`, returns HTTP 200, points at the expected file
- [ ] **Target path** is a simple relative path under `~/.claude/skills/<id>/`
- [ ] **No arbitrary install command** — file-only skill preferred
- [ ] **Description matches** what the skill actually instructs Claude to do
- [ ] A maintainer can review the upstream source from the links above

## Anything else

<!-- License, caveats, whether you plan to open the handpicked/ PR yourself. -->
