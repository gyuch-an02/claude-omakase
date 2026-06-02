# CLAUDE.md

Guidance for Claude (and other AI assistants) working in this repository.

This is `claude-omakase`, an MCP server that proactively suggests and installs
Claude skills. Before changing catalog data, read
[`docs/ai-protocol.md`](docs/ai-protocol.md) and follow its three gates for any
LLM-generated `Entry`.

## Local checks

Match CI before pushing:

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm test
```
