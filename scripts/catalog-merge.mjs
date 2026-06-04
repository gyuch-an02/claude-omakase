export function mergeSelectedAdapters(previousEntries, refreshedEntries, selectedAdapters) {
  if (!selectedAdapters || selectedAdapters.length === 0) return refreshedEntries;
  const selected = new Set(selectedAdapters);
  const preserved = previousEntries.filter((entry) => !selected.has(entry.source?.adapter));
  return [...preserved, ...refreshedEntries].sort((a, b) => a.id.localeCompare(b.id));
}
