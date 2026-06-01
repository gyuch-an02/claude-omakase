// Defensive catalog hygiene. Adapters scrape READMEs and marketplaces, so a
// malformed source (e.g. an HTML anchor inside a markdown category header) can
// leak junk tokens like `<a`, `name="developer`, `tools"><` into an entry's
// tags. Those pollute keyword search and mis-rank results.
//
// We clean tags at load time so a polluted catalog.json — including one already
// published — is corrected at runtime, not only after the next rebuild.

import type { Catalog, Entry } from "../types.js";

// A valid tag starts with an alphanumeric (ASCII or CJK) and contains only
// tag-safe characters. Anything with HTML/markup punctuation (< > " ' = / \)
// is rejected outright.
const VALID_TAG = /^[a-z0-9가-힣][a-z0-9가-힣.+#_-]+$/;

export function sanitizeTags(tags: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    const t = raw.trim().toLowerCase();
    if (t.length < 2) continue;
    if (!VALID_TAG.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function sanitizeEntry(entry: Entry): Entry {
  return { ...entry, tags: sanitizeTags(entry.tags) };
}

export function sanitizeCatalog(catalog: Catalog): Catalog {
  return { ...catalog, entries: catalog.entries.map(sanitizeEntry) };
}
