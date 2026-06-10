// Types for the shared relevance engine (hooks/retrieval.mjs), so the TypeScript
// MCP search tools can import the same pure-JS engine the .mjs hooks use.

export interface RankableEntry {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  category?: string;
  search_terms?: string[];
}

export interface RetrievalIndex<T extends RankableEntry = RankableEntry> {
  entries: T[];
  fields: unknown[];
  df: Map<string, number>;
  N: number;
}

export interface ScoredEntry<T extends RankableEntry = RankableEntry> {
  entry: T;
  score: number;
  reasons: string[];
}

export const STOPWORDS: Set<string>;
export const FIELD_WEIGHTS: Record<string, number>;

export function tokenize(text: string): string[];
export function buildIndex<T extends RankableEntry>(entries: T[]): RetrievalIndex<T>;
export function scoreEntryAt(
  i: number,
  queryTokens: string[],
  index: RetrievalIndex
): { score: number; reasons: string[] };
export function rank<T extends RankableEntry>(
  entries: T[],
  query: string,
  opts?: { limit?: number }
): ScoredEntry<T>[];
