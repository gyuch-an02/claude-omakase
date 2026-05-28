# CLAUDE.md

Guidance for Claude (and other AI assistants) working in this repository.

This is `claude-omakase`, an MCP server that proactively suggests and installs
Claude skills. Before changing catalog data, read
[`docs/ai-protocol.md`](docs/ai-protocol.md) and follow its three gates for any
LLM-generated `Entry`.

## Skill: ai-usage-log

**Every Claude-assisted commit must append one log entry to
[`docs/ai-log.md`](docs/ai-log.md).** This is how the project keeps an honest,
reviewable record of what AI did and why.

When you have staged a change and are about to commit:

1. Append a new entry to the **bottom** of `docs/ai-log.md`.
2. The entry is a dated `##` heading followed by **exactly five sentences in
   Korean (한국어)**.
3. The five sentences should cover: *what* changed, *which files*, *why*, *how it
   stays consistent with existing repo conventions*, and *that the change was
   committed*.
4. Include the `docs/ai-log.md` change in the **same commit** as the work it
   describes, so a PR is never missing its log entry.

Entry template:

```md
## YYYY-MM-DD — <짧은 제목>

1. <첫 번째 문장>
2. <두 번째 문장>
3. <세 번째 문장>
4. <네 번째 문장>
5. <다섯 번째 문장>
```

A pre-merge check ([`.github/workflows/ai-log-check.yml`](.github/workflows/ai-log-check.yml))
flags any PR that does not add an entry to `docs/ai-log.md`.

## Local checks

Match CI before pushing:

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm test
```
