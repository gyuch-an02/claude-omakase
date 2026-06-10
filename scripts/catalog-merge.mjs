export function mergeSelectedAdapters(previousEntries, refreshedEntries, selectedAdapters) {
  if (!selectedAdapters || selectedAdapters.length === 0) return refreshedEntries;
  const selected = new Set(selectedAdapters);
  const preserved = previousEntries.filter((entry) => !selected.has(entry.source?.adapter));
  // Dedupe by id, preserved-first: an id already owned by a NON-selected adapter
  // in the previous catalog keeps that entry even if a selected adapter now
  // produces the same id. Without this, a partial rebuild can emit the same id
  // twice (e.g. previous handpicked entry + refreshed skillsmp entry), and
  // runtime `entries.find(e => e.id === …)` resolves whichever sorts first —
  // breaking the registry's first-listed-adapter-wins contract.
  const byId = new Map();
  for (const entry of [...preserved, ...refreshedEntries]) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Carry LLM enrichment (`search_terms`) forward from the previous catalog.
 *
 * enrich-catalog.mjs is a MAINTAINER step (needs a local LLM endpoint) and does
 * NOT run in the daily CI refresh — adapters never emit search_terms. Without
 * this carry-over, every full `build:catalog` run replaces enriched entries with
 * freshly-fetched ones and silently WIPES all enrichment from catalog.json.
 *
 * A refreshed entry that already carries its own non-empty search_terms wins
 * (future adapters may emit them); otherwise the previous catalog's terms for
 * the same id are restored.
 */
export function carryOverEnrichment(previousEntries, entries) {
  if (!Array.isArray(previousEntries) || previousEntries.length === 0) return entries;
  const prevTerms = new Map();
  for (const e of previousEntries) {
    if (Array.isArray(e.search_terms) && e.search_terms.length > 0) {
      prevTerms.set(e.id, e.search_terms);
    }
  }
  if (prevTerms.size === 0) return entries;
  return entries.map((e) => {
    if (Array.isArray(e.search_terms) && e.search_terms.length > 0) return e;
    const terms = prevTerms.get(e.id);
    return terms ? { ...e, search_terms: terms } : e;
  });
}
