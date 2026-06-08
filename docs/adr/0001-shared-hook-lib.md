# Hooks share a `_shared.mjs` lib instead of staying standalone

The three omakase hooks (`omakase-suggest`, `omakase-repetition`,
`omakase-session-start`) were originally standalone single files that copy-pasted
`readStdin`, the catalog-path lookup, and a best-effort state write. That kept each
hook independently copyable, but the duplication drifted: only some hooks wrote
state atomically or pruned it, and `omakase-suggest` grew `suggest.json`
unbounded. We extracted the shared concerns into `hooks/_shared.mjs`
(`readStdin`, `catalogPath`, `loadCatalogEntries`, `loadJson`, `writeStateAtomic`,
`stateDir`, `cleanText`) so atomicity and the catalog lookup live in one place.

We accepted the trade-off — a hook can no longer be lifted out as a single file —
because the hooks always ship together in the npm package, and a single audited
state-write path matters more than copy-paste portability. Do not re-inline these
helpers back into the hooks to "make them standalone"; that reintroduces the drift
this decision removed.
