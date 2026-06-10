/**
 * Shared relevance engine — the ONE place that compares a user's context/query
 * against a catalog entry's text (name + description + tags + category).
 *
 * Consumed by BOTH:
 *   - the MCP search tools (src/catalog/search.ts → find_skill, recommend_skills)
 *   - the proactive hook (hooks/omakase-suggest.mjs)
 * so the suggestion you get automatically and the one you get on request rank
 * skills the same way. Pure ESM, zero deps (hooks run as bare .mjs). The relative
 * path `../../hooks/retrieval.mjs` resolves identically from src/ and dist/.
 *
 * Model: field-weighted term match, multiplied by an IDF boost.
 *   - Field weights give a strong prior (an id/tag hit beats a description hit)
 *     and, crucially, keep working on a TINY corpus where IDF → 0.
 *   - IDF (document frequency over the corpus) lets a rare, meaningful term
 *     ("scrape", "kubernetes") outweigh a common one ("data", "tool") once the
 *     catalog is large. Floored at 0 and applied as (1 + idf) so the field
 *     weight ALWAYS contributes — a single-entry catalog still scores matches.
 *
 * This is LEXICAL relevance (term overlap), not dense embeddings. It captures
 * "does the context's vocabulary appear in this skill's description"; synonyms it
 * does not yet. A dense-embedding rerank can layer on top later.
 */

// Generic words that imply no particular skill — dropped from both the query and
// the document frequency stats so they never drive a match.
export const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "and", "or", "for", "in", "on", "at", "is", "it",
  "this", "that", "with", "my", "me", "i", "you", "do", "can", "how", "what",
  "please", "help", "want", "need", "make", "get", "use", "have", "be", "will",
  "should", "would", "could", "are", "was", "as", "by", "from", "into", "your",
  "claude", "code", "skill", "skills", "omakase", "file", "files", "tool", "tools",
]);

// Field weights: the prior on WHERE a term matched. id/tag are strong signals;
// description is real but weaker. These mirror the original hook weights, plus
// description and category, which the hook previously ignored entirely.
export const FIELD_WEIGHTS = {
  id: 4,
  tag: 3,
  // LLM-generated synonyms/keywords (search_terms) are deliberate intent signals
  // — weighted like a name word, above a plain description hit.
  searchTerm: 2.5,
  name: 2.5,
  category: 2,
  description: 1.5,
  nameSubstring: 1.0,
  descSubstring: 0.8,
};

/** Lowercase, split on non-alphanumeric (keep Hangul), drop stopwords + 1-char. */
export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function idSegments(id) {
  return String(id ?? "")
    .toLowerCase()
    .split(/[-_/]+/)
    .filter(Boolean);
}

// Per-entry token bags, computed once per entry and reused across query terms.
function entryFields(entry) {
  // search_terms are short synonym phrases; tokenize each so a multi-word term
  // ("web scraping") contributes both tokens.
  const synTokens = new Set();
  for (const term of entry.search_terms ?? []) {
    for (const tok of tokenize(term)) synTokens.add(tok);
  }
  return {
    idSegs: new Set(idSegments(entry.id)),
    tags: new Set((entry.tags ?? []).map((t) => String(t).toLowerCase())),
    searchTerms: synTokens,
    nameWords: new Set(tokenize(entry.name)),
    catWords: new Set(tokenize(entry.category ?? "")),
    descWords: new Set(tokenize(entry.description)),
    lowerName: String(entry.name ?? "").toLowerCase(),
    lowerDesc: String(entry.description ?? "").toLowerCase(),
  };
}

/**
 * Build a reusable index over the catalog: per-entry token bags + document
 * frequency per term (how many entries contain it, in any field) + N. O(corpus).
 */
export function buildIndex(entries) {
  const fields = entries.map(entryFields);
  const df = new Map();
  for (const f of fields) {
    const terms = new Set([
      ...f.idSegs, ...f.tags, ...f.searchTerms, ...f.nameWords, ...f.catWords, ...f.descWords,
    ]);
    for (const t of terms) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return { entries, fields, df, N: entries.length };
}

// IDF boost ≥ 1. Rare term → larger boost; term in every doc → ~1 (field weight
// still counts). Floored at 0 so common terms never go negative.
function idfBoost(term, index) {
  const n = index.df.get(term) ?? 0;
  const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
  return 1 + Math.max(0, idf);
}

/** Best field weight for `term` against one entry's precomputed token bags. */
function termFieldWeight(term, f) {
  if (f.idSegs.has(term)) return FIELD_WEIGHTS.id;
  if (f.tags.has(term)) return FIELD_WEIGHTS.tag;
  if (f.searchTerms.has(term)) return FIELD_WEIGHTS.searchTerm;
  if (f.nameWords.has(term)) return FIELD_WEIGHTS.name;
  if (f.catWords.has(term)) return FIELD_WEIGHTS.category;
  if (f.descWords.has(term)) return FIELD_WEIGHTS.description;
  if (term.length >= 4 && f.lowerName.includes(term)) return FIELD_WEIGHTS.nameSubstring;
  if (term.length >= 4 && f.lowerDesc.includes(term)) return FIELD_WEIGHTS.descSubstring;
  return 0;
}

/**
 * Score one entry (by index position) against pre-tokenized query terms.
 * Returns { score, reasons } where reasons are the matched terms (strongest
 * first). Used directly by callers that want to add their own boosts on top.
 */
export function scoreEntryAt(i, queryTokens, index) {
  const f = index.fields[i];
  let score = 0;
  const matched = [];
  for (const term of new Set(queryTokens)) {
    const w = termFieldWeight(term, f);
    if (w > 0) {
      score += w * idfBoost(term, index);
      matched.push({ term, w });
    }
  }
  matched.sort((a, b) => b.w - a.w);
  return { score, reasons: matched.map((m) => m.term) };
}

/**
 * Rank a whole catalog against a free-text query. Returns scored entries
 * (score > 0) sorted high→low, then by id for stability. `limit` truncates.
 * The single entry point most callers want.
 */
export function rank(entries, query, { limit = Infinity } = {}) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const index = buildIndex(entries);
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const { score, reasons } = scoreEntryAt(i, tokens, index);
    if (score > 0) out.push({ entry: entries[i], score, reasons });
  }
  out.sort((a, b) => b.score - a.score || String(a.entry.id).localeCompare(String(b.entry.id)));
  return Number.isFinite(limit) ? out.slice(0, limit) : out;
}
