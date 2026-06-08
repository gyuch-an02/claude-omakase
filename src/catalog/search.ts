// Lightweight keyword + tag search. No embeddings yet.
// Scoring is deliberately simple so users can predict matches:
//
//   exact id match            → 1000
//   exact tag match (any)     →  300
//   name word match           →  120
//   description word match    →   40
//   tag prefix match          →   30
//   category match            →   20
//
// Multi-token queries sum per token. Trust adds a small tiebreaker, NOT a way to
// outrank a clear match: verified (human-audited) +25, else source_trust
// "official" (first-party provenance) +10.

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

  const scored: SearchResult[] = [];
  for (const entry of entries) {
    const { score, reasons } = scoreEntry(entry, tokens, exactQuery);
    if (score > 0) scored.push({ entry, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return scored.slice(0, limit);
}

function scoreEntry(entry: Entry, tokens: string[], exactQuery: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const lowerName = entry.name.toLowerCase();
  const lowerDesc = entry.description.toLowerCase();
  const lowerTags = entry.tags.map((t) => t.toLowerCase());
  const lowerId = entry.id.toLowerCase();

  if (lowerId === exactQuery) {
    score += 1000;
    reasons.push(`id match (${entry.id})`);
  }

  for (const tok of tokens) {
    if (lowerId === tok) {
      score += 1000;
      reasons.push(`id match (${tok})`);
      continue;
    }
    if (lowerTags.includes(tok)) {
      score += 300;
      reasons.push(`tag match (${tok})`);
      continue;
    }
    if (lowerName.split(/\s+/).includes(tok)) {
      score += 120;
      reasons.push(`name word (${tok})`);
      continue;
    }
    if (lowerDesc.includes(tok)) {
      score += 40;
      reasons.push(`description (${tok})`);
      continue;
    }
    if (lowerTags.some((t) => t.startsWith(tok))) {
      score += 30;
      reasons.push(`tag prefix (${tok})`);
      continue;
    }
    if (entry.category?.toLowerCase() === tok) {
      score += 20;
      reasons.push(`category (${tok})`);
    }
  }

  // Trust tiebreakers (never enough to outrank a real keyword match):
  // human-audited > official-provenance > community.
  if (score > 0) {
    if (entry.verified) score += 25;
    else if (entry.source_trust === "official") score += 10;
  }
  return { score, reasons };
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter((s) => s.length > 0);
}
