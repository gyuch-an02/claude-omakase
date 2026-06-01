# Catalog Refresh Rollback

If a `catalog-refresh` run produces a broken `catalog.json` — schema-invalid
entries, install URLs that 404, fields the validator rejects — the previous
catalog is always recoverable from `main`'s git history. `catalog.json` is
normal git-tracked content; there is no separate backup to maintain.

This page documents the rollback paths and how to verify them.

## How catalog.json reaches main

[`.github/workflows/catalog-refresh.yml`](../.github/workflows/catalog-refresh.yml)
runs daily, rebuilds `catalog.json`, and opens a PR (branch
`chore/catalog-refresh`) via `peter-evans/create-pull-request@v7`. The workflow
**never pushes directly to `main`** — a human reviews and merges the PR. That
manual review is the first safety boundary.

## Rollback paths

### A. Bad catalog on a refresh PR, not yet merged

The bad content only lives on `chore/catalog-refresh`. **Close the PR.** `main`
is untouched. Nothing else to do. The next scheduled refresh will rebuild from
scratch.

### B. Bad catalog already merged into main — revert the merge

Recommended for any catalog regression on `main`:

```bash
git switch main
git pull
git revert -m 1 <merge-sha>     # -m 1 keeps the pre-merge main as the parent
git push
```

This restores the previous `catalog.json` *and* leaves a revert commit so an
audit can see what was rolled back and why.

### C. Restore only catalog.json from a known-good commit

If surrounding commits should stay but only `catalog.json` is wrong:

```bash
git switch -c chore/catalog-rollback
git show <good-sha>:catalog.json > catalog.json
git add catalog.json
git commit -m "chore(catalog): rollback to <good-sha>"
git push -u origin chore/catalog-rollback
```

Then open a normal PR.

## Verify the rollback path locally

You can confirm the previous catalog is recoverable from `main` right now
without changing anything:

```bash
git fetch origin main
git show origin/main:catalog.json | head -6
```

If the first lines of the live catalog print, the rollback path works. The
same `git show <ref>:catalog.json` form works against any commit SHA, so every
historical version of `catalog.json` is recoverable.

This verification was run when this page was written and returned the live
catalog (12,144 lines) as expected.

## Why no separate backup is needed

`catalog.json` is built deterministically by
[`scripts/build-catalog.mjs`](../scripts/build-catalog.mjs) from the adapter
sources, then committed to git on every merge. Git stores every historical
revision, so the previous file is always one `git show` away. A separate
backup store would only create a second source of truth to keep in sync.
