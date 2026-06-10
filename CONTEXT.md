# Claude Omakase

Skill Suggester MCP server: federates a catalog of Claude skills/MCP servers from
external sources at build time, then serves recommendations and installs them at
runtime.

## Language

**Federation**:
The build-time phase that runs adapters and writes `catalog.json`. Does not run at
runtime — the server reads the pre-built file.
_Avoid_: scraping, crawling, sync

**Serving**:
The runtime phase: load `catalog.json`, search/recommend, and install on approval.
Never fetches sources live.
_Avoid_: querying, runtime fetch

**Nudge**:
A one-shot `additionalContext` string a hook injects to tell Claude to offer a
skill. The three hooks each emit one: the Suggestion hook, the Repetition
detector, and the Session-start nudge.
_Avoid_: hint, prompt, message

**Suggestion hook**:
The `UserPromptSubmit` hook (`omakase-suggest.mjs`) that scores each prompt
against the catalog and nudges when an uninstalled skill clearly fits.
_Avoid_: suggester, matcher

**Repetition detector**:
The `PostToolUse` hook (`omakase-repetition.mjs`) that nudges after a command or
file-edit task recurs THRESHOLD times across sessions.
_Avoid_: repeat hook, frequency hook
