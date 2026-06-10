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
