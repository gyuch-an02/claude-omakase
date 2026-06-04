## What changed

<!-- One sentence. "Adds X", "Fixes Y", "Removes Z". -->

## Why

<!-- Link the issue this closes or explain the motivation. -->
<!-- Use "Closes #NNN" to auto-close the issue on merge. -->

## How to test

<!-- Steps a reviewer can follow to verify the change works. -->
<!-- For adapter PRs: paste a snippet of `npm run build:catalog` output. -->
<!-- For SKILL.md changes: describe the trigger phrase you tested. -->

## Checklist

- [ ] `npm run lint && npm run typecheck && npm test` pass locally
- [ ] New adapter: `src/adapters/<name>.test.ts` exists with fixture-based tests
- [ ] New `handpicked/` entry: includes `verified: true` justification in PR body
- [ ] `catalog.json` rebuilt via `npm run build:catalog` if adapter output changed
- [ ] If AI tools materially shaped this PR: appended an entry to [`docs/ai-log.md`](../docs/ai-log.md) (dated bullet format — `무엇을 / 요청 / AI제안 / 사람검증 / 반영`). Skip if no AI involvement.
