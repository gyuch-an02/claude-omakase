// Adapter registry. Each adapter is a self-contained module that returns a
// list of catalog entries. Order matters for dedupe — first-listed adapter
// wins on id collisions, so put trusted sources (handpicked) before community
// ones.
//
// SKILLS ONLY. MCP-server sources (glama, awesome-mcp, mcp-servers-repo) are
// intentionally NOT registered: they list MCP servers, which have no SKILL.md
// and cannot install as Claude Code skills — they guessed a `…/main/SKILL.md`
// URL that 404s for ~98% of entries. The adapter files are kept for a future
// `mcp_server` install path (see CLAUDE.md "Out of scope"); until then, this
// registry federates only sources that yield real, installable SKILL.md skills.

import type { Entry } from "../types.js";
import { fetch as fetchHandpicked } from "./handpicked.js";
import { fetch as fetchSkillsmp } from "./skillsmp.js";
import { fetch as fetchGithubSkills } from "./github-skills.js";

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
  {
    name: "skillsmp",
    description:
      "Public agent-skills marketplace at skillsmp.com (the source behind ByteDance's find-skills SKILL).",
    fetch: fetchSkillsmp,
  },
  {
    name: "github-skills",
    description:
      "Raw GitHub code search for public repositories containing Claude Code SKILL.md files.",
    fetch: fetchGithubSkills,
  },
];

export function adapterNames(): string[] {
  return adapters.map((adapter) => adapter.name);
}

export function selectAdapters(names?: string[]): Adapter[] {
  if (!names || names.length === 0) return adapters;
  const wanted = new Set(names);
  const selected = adapters.filter((adapter) => wanted.has(adapter.name));
  const missing = [...wanted].filter(
    (name) => !adapters.some((adapter) => adapter.name === name)
  );
  if (missing.length > 0) {
    throw new Error(
      `unknown adapter(s): ${missing.join(", ")}. Valid adapters: ${adapterNames().join(", ")}`
    );
  }
  return selected;
}

export async function fetchAll(adapterNames?: string[]): Promise<Entry[]> {
  const byId = new Map<string, Entry>();
  for (const adapter of selectAdapters(adapterNames)) {
    let entries: Entry[];
    try {
      entries = await adapter.fetch();
    } catch (e) {
      console.error(`adapter ${adapter.name} failed: ${(e as Error).message}`);
      continue;
    }
    if (entries.length === 0) {
      // Loud zero-entry signal: an adapter that quietly returns [] (auth broke,
      // API shape changed, rate-limited to nothing) looks identical to a healthy
      // run in the merged output — the daily refresh would just keep stale
      // entries forever without anyone noticing.
      console.error(
        `adapter ${adapter.name} returned 0 entries — possible upstream breakage (auth, API shape, rate limit).`
      );
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
