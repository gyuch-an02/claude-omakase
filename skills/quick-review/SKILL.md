---
name: quick-review
description: Review a code diff or file for correctness bugs, security issues, and clear simplifications. One finding per line, severity-tagged. Use when user wants fast, focused code review.
triggers: ["review this", "review my diff", "check this code", "what's wrong here", "quick review"]
---

# Quick Review

Give fast, focused code review. No praise. No scope creep.

## Output format

```
path/file.ts:42: 🔴 bug: null dereference if `user` is undefined. Add `user?.` guard.
path/file.ts:67: 🟡 perf: re-creates regex on every call. Move outside function.
path/file.ts:81: 🔵 style: misleading name `data` — call it `userRecords`.
```

Severity tags:
- 🔴 **bug** — correctness issue, will cause failures
- 🟡 **perf / security / logic** — important but not immediately breaking  
- 🔵 **style / naming** — only if it changes meaning or causes confusion

## Rules

- Read the full diff before commenting
- Flag only real issues — no "consider adding tests" unless tests are clearly missing for a critical path
- If a fix is obvious, state it in one line. If complex, explain why in ≤ 2 sentences.
- Skip formatting nits unless they change meaning
- End with total count: `3 issues (1 bug, 1 perf, 1 style)`
