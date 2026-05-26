// Adapter registry. Each adapter is a self-contained module that returns a
// list of catalog entries. Order matters for dedupe — first-listed adapter
// wins on id collisions, so put trusted sources (handpicked, Anthropic refs)
// before community ones.

import type { Entry } from "../types.js";
import { fetch as fetchHandpicked } from "./handpicked.js";

export interface Adapter {
  name: string;
  description: string;
  fetch: () => Promise<Entry[]>;
}

export const adapters: Adapter[] = [
  {
    name: "handpicked",
    description: "Local overlay: verified entries, blocklist, command overrides.",
    fetch: fetchHandpicked,
  },
];

export async function fetchAll(): Promise<Entry[]> {
  const byId = new Map<string, Entry>();
  for (const adapter of adapters) {
    let entries: Entry[];
    try {
      entries = await adapter.fetch();
    } catch (e) {
      console.error(`adapter ${adapter.name} failed: ${(e as Error).message}`);
      continue;
    }
    for (const entry of entries) {
      const existing = byId.get(entry.id);
      if (!existing) {
        byId.set(entry.id, entry);
        continue;
      }
      // First-listed adapter wins, but the later adapter may upgrade fields
      // the trusted source omitted (e.g. tags, screenshots, version).
      byId.set(entry.id, mergePreservingFirst(existing, entry));
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function mergePreservingFirst(first: Entry, second: Entry): Entry {
  return {
    ...second,
    ...first,
    tags: dedupe([...(first.tags ?? []), ...(second.tags ?? [])]),
    requirements: dedupe([
      ...(first.requirements ?? []),
      ...(second.requirements ?? []),
    ]),
  };
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
