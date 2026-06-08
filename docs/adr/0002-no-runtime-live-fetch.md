# Runtime serving never live-fetches sources unless explicitly opted in

Federation (running adapters against external sources) is a build-time,
human-reviewed step; the serving path reads a pre-built `catalog.json`. The
catalog loader previously had a silent last resort: if there was no remote URL,
no fresh cache, and no bundled `catalog.json`, it ran a full live federation and
cached the result — turning the stdio MCP server into a slow web scraper that
bypassed the human catalog-review gate, with no warning.

We now fail loud instead: the loader returns an EMPTY catalog and logs how to fix
it (`build:catalog`). A live run is kept only as an explicit escape hatch behind
`OMAKASE_ALLOW_LIVE_FETCH=1`, which itself logs that it is slow and bypasses
review. This trades auto-population convenience for determinism and the no-silent-
network guarantee. Do not remove the gate to "make it just work" — silent runtime
federation is the failure mode this decision exists to prevent.
