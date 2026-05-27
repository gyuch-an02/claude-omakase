# Claude Omakase: Testing the 30-Minute Adapter Promise

Claude Omakase is a small MCP server plus bundled Claude skill for proactive skill discovery. The premise is simple: when Claude notices that a user keeps doing the same manual task, it can search a federated catalog of Claude skills, explain the match, and install the selected skill only after explicit approval.

The catalog is designed to be federated, not hand-maintained. Contributors add one adapter per upstream source, and the daily catalog refresh workflow opens a reviewable PR when adapter output drifts.

## The Promise

For the hackathon, we wanted a contributor-facing promise that was specific enough to test:

> A first-time contributor should be able to add a new catalog adapter and reach green CI in about 30 minutes.

That promise matters because adapter contributions are the main growth path for the project. If adding a source requires understanding the whole MCP server, the catalog will stay small. If adding a source is a narrow, documented workflow, external contributors can help expand coverage without touching security-critical install logic.

## What We Tested

The timing pass used the contributor quickstart and the normal PR path:

- `docs/contributor-quickstart.md` explains the adapter contract.
- `src/adapters/README.md` defines required `Entry` fields and safety rules.
- `npm run typecheck`, `npm run build`, and `npm test` match the PR CI gate.
- `npm run build:catalog` proves adapter output can be federated into `catalog.json`.
- `npm run test:adapter` produces a smoke report for install metadata.

The run exposed a very practical problem: before contributors can parse a real upstream source, they lose time copying the same adapter shell, placing tests correctly, remembering required metadata fields, and adding basic safety checks.

## Result

The #26 timing/DX PR added `npm run scaffold:adapter -- <source-name>`.

That command creates:

- `src/adapters/<source-name>.ts`
- `src/adapters/<source-name>.test.ts`
- a source-assumptions header
- a normalizer stub
- an HTTPS `SKILL.md` guard
- duplicate-tag cleanup
- no-overwrite protection
- a passing fixture-style test

The merged PR also fixed a test-runner portability issue. The previous test command depended on a shell glob behavior that produced a known warning locally and failed in GitHub Actions once script tests were added. The final CI-compatible command now runs both source tests and script tests directly.

Concrete run data:

- PR #45 was opened at 2026-05-27 08:10 UTC and merged at 2026-05-27 08:17 UTC.
- The final CI build passed in 16 seconds, from 2026-05-27 08:16:14 UTC to 2026-05-27 08:16:30 UTC.
- Local validation passed with 20 tests.
- The adapter smoke report showed 3 entries, 3 passed, 0 failed, and 0 skipped.
- The scaffolding PR changed 6 files with 279 additions and 6 deletions.

## What Changed for Contributors

Before the timing pass, a new adapter author had to start from a blank TypeScript file and manually translate the written contract into code. After the timing pass, the first implementation step is copyable:

```bash
npm run scaffold:adapter -- my-source
```

The contributor still owns the hard part: understanding the upstream source and deciding which fields are trustworthy. The scaffolder removes the easy-to-forget boilerplate so the contributor can spend the 30-minute window on source-specific parsing and reviewable catalog output.

## Safety Boundary

The timing work did not loosen install safety. Adapters still produce metadata only. They do not execute install commands, write skill files, or modify Claude configuration.

The install path remains guarded by the existing invariant:

- skill files must come from HTTPS URLs
- skill file targets must be relative paths
- writes happen only through the installer after explicit user approval

That boundary is why adapter contributions are a good first external contribution: they expand discovery without touching the destructive install surface.

## Remaining Friction

Two follow-ups remain worth tracking:

- `npm run build:catalog` can still log `skillsmp` schema warnings when that upstream API shape changes. The command exits successfully, but the warning is noisy for first-time contributors.
- `npm run lint` is not currently useful because ESLint v9 expects an `eslint.config.*` file and this repo has not added one yet.

Neither blocked the adapter timing pass, but both are good future DX cleanups.

## Takeaway

The 30-minute adapter promise is credible when the contributor workflow is narrow: scaffold files, parse one source, test with a fixture, register the adapter, refresh the catalog, and open a PR with the validation notes.

Claude Omakase now has that path documented and partially automated. The next test is to hand the quickstart to someone outside the core team and see whether they can add a real source without needing private context.
