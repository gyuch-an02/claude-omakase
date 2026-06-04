# Automation runbook

## Adapter auto-merge

Adapter-only pull requests can opt into auto-merge by applying the `adapter`
label. The `.github/workflows/adapter-auto-merge.yml` workflow runs on
`pull_request_target`, does not check out or execute PR code, and asks GitHub to
auto-merge the PR with a squash merge after required checks pass.

Required setup:

- Repository auto-merge must be enabled in GitHub settings.
- Branch protection should require the `CI / build` check on `main`. Note: as of
  the matrixed CI, `build` is an **aggregate gate** that goes green only after
  every Node matrix leg (`checks`) passes — so requiring `CI / build` alone still
  gates on the full matrix. No branch-protection change is needed.
- The pull request must be open, non-draft, and labeled `adapter`.

Verification:

1. Open a throwaway adapter PR.
2. Apply the `adapter` label.
3. Confirm the workflow enables auto-merge.
4. Confirm the PR merges only after `CI / build` passes.

## Catalog rollback

Catalog refresh PRs should only change `catalog.json`. If a refresh is merged
and later found bad, restore the previous catalog from `main` or the last known
good commit:

```bash
git switch -c rollback/catalog-refresh
git checkout <known-good-ref> -- catalog.json
npm run test:adapter -- --out adapter-smoke-report.json
git diff -- catalog.json
```

To verify the rollback path without touching the working tree, run:

```bash
npm run verify:catalog-rollback
```

The verifier creates a temporary detached worktree, writes a deliberately bad
`catalog.json`, restores `catalog.json` from `origin/main` or
`CATALOG_ROLLBACK_BASE`, and checks that the restored file exactly matches the
base ref.
