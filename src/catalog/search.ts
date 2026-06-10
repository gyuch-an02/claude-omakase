// Catalog search for the MCP tools (find_skill, recommend_skills).
//
// The core "does the user's context match this skill's text" relevance is the
// SHARED engine in hooks/retrieval.mjs — the SAME code the proactive
// omakase-suggest hook uses, so an automatic suggestion and an explicit search
// rank skills identically. It's a field-weighted term match (name/description/
// tags/category) boosted by IDF; see that file for the model.
//
// On top of the shared relevance score this layer adds tool-specific signals the
// hook doesn't need:
//   exact id match            → +1000 (precise lookup by id always wins)
//   verified (human-audited)  →   +25 tiebreaker
//   source_trust "official"   →   +10 tiebreaker
//   popularity (stars)        → +log10, capped <7 (tiebreaker, never outranks
//                                a keyword hit)

import { buildIndex, scoreEntryAt, tokenize } from "../../hooks/retrieval.mjs";
import type { Entry } from "../types.js";

export interface SearchResult {
  entry: Entry;
  score: number;
  reasons: string[];
}

export function search(entries: Entry[], query: string, limit = 5): SearchResult[] {
  const exactQuery = query.trim().toLowerCase();
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const index = buildIndex(entries);
  const scored: SearchResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const { score: base, reasons } = scoreEntryAt(i, tokens, index);
    let score = base;
    const allReasons = [...reasons];

    // Exact id lookup short-circuits relevance — searching the literal id should
    // surface that one entry above everything.
    if (entry.id.toLowerCase() === exactQuery) {
      score += 1000;
      allReasons.unshift(`id match (${entry.id})`);
    }

    if (score <= 0) continue;

    // Tiebreakers — never enough to outrank a real keyword match.
    if (entry.verified) score += 25;
    else if (entry.source_trust === "official") score += 10;
    if (entry.stars && entry.stars > 0) {
      score += Math.min(Math.log10(entry.stars + 1), 7);
    }

    scored.push({ entry, score, reasons: allReasons });
  }

  scored.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return scored.slice(0, limit);
}
