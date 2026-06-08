# `source_trust` is separate from `verified`

`verified: true` means a HUMAN audited the entry against the handpicked checklist.
The `mcp-servers-repo` adapter used to set `verified: true` on every entry because
its source is the official Anthropic MCP repo — but that is an automated scrape,
not a human audit, and it contradicts the project rule that `verified` reflects a
human audit, never a green pipeline.

We added a separate field, `source_trust: "official" | "community"` (undefined =
community), to carry first-party provenance independently of `verified`. Official
entries are now `verified: false, source_trust: "official"`. Ranking honours a
three-level trust order — verified (+25) > official (+10) > community — as a
tiebreaker that never outranks a real keyword match; zero-query recommendation
defaults stay strictly `verified` (human-audited). To promote an official entry to
`verified`, a human adds it to the handpicked overlay. Do not collapse these two
fields back together: provenance and audit are different guarantees.
