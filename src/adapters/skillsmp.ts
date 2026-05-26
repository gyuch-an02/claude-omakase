// Adapter for skillsmp.com — the public agent-skills marketplace fronted by
// the find-skills SKILL (bytedance/deer-flow).
//
// The marketplace exposes a single useful endpoint:
//   GET https://skillsmp.com/api/v1/skills/search?q=<query>
// There is no "list-all". We hit it with a seed set of broad queries
// (categories, common task verbs, occupations), dedupe by the returned id,
// and emit Entry records that point at the upstream SKILL.md URL.
//
// Anonymous rate limit: 50 requests/day, 10/min. We stay well under that —
// the seed set caps at ~20 queries, run once per day by the catalog-refresh
// workflow. If you need more coverage, set CLAUDE_OMAKASE_SKILLSMP_TOKEN
// to your bearer key (authenticated tier: 500/day, 30/min).
//
// The marketplace's response schema is not publicly documented at the time
// this adapter was written, so the parsing is intentionally defensive:
// every field we touch has a fallback or a guard.

import type { Entry } from "../types.js";

const BASE = "https://skillsmp.com/api/v1/skills/search";

// Seed queries chosen to span common categories without authentication and
// without hammering the endpoint. Tune in PRs.
const SEED_QUERIES = [
  "code",
  "design",
  "testing",
  "deployment",
  "research",
  "writing",
  "data",
  "git",
  "documentation",
  "review",
  "automation",
  "scrape",
  "summarize",
  "translate",
];

const PER_QUERY_LIMIT = 25; // marketplace max is 100; smaller keeps responses fast.

interface SkillsmpHit {
  id?: string;
  slug?: string;
  name?: string;
  title?: string;
  description?: string;
  summary?: string;
  tags?: string[];
  categories?: string[];
  author?: string | { name?: string; url?: string };
  owner?: string;
  repository?: string;
  repo?: string;
  source_url?: string;
  homepage?: string;
  url?: string;
  license?: string;
  version?: string;
  // The marketplace appears to host SKILL.md content directly. We prefer
  // a raw URL if exposed; otherwise we derive one from owner/repo/path.
  skill_md_url?: string;
  raw_url?: string;
}

interface SkillsmpResponse {
  results?: SkillsmpHit[];
  data?: SkillsmpHit[];
  skills?: SkillsmpHit[];
  total?: number;
}

export async function fetch(): Promise<Entry[]> {
  const headers = buildHeaders();
  const byId = new Map<string, Entry>();

  for (const query of SEED_QUERIES) {
    let hits: SkillsmpHit[];
    try {
      hits = await searchOnce(query, headers);
    } catch (e) {
      console.error(`skillsmp: query "${query}" failed: ${(e as Error).message}`);
      continue;
    }
    for (const hit of hits) {
      const entry = normalize(hit);
      if (!entry) continue;
      if (!byId.has(entry.id)) byId.set(entry.id, entry);
    }
  }

  return [...byId.values()];
}

async function searchOnce(query: string, headers: Record<string, string>): Promise<SkillsmpHit[]> {
  const url = `${BASE}?q=${encodeURIComponent(query)}&limit=${PER_QUERY_LIMIT}`;
  const res = await globalThis.fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body = (await res.json()) as SkillsmpResponse;
  return body.results ?? body.data ?? body.skills ?? [];
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "claude-omakase-adapter (+https://github.com/gyuch-an02/claude-omakase)",
  };
  const token = process.env["CLAUDE_OMAKASE_SKILLSMP_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Map a hit to our Entry shape. Returns null when we can't construct a
// safe install (missing SKILL.md URL, missing id, etc.).
export function normalize(hit: SkillsmpHit): Entry | null {
  const id = (hit.id ?? hit.slug ?? slugify(hit.name ?? hit.title ?? "")).trim();
  if (!id) return null;

  const name = (hit.name ?? hit.title ?? id).trim();
  const description = (hit.description ?? hit.summary ?? "").trim();
  if (!description) return null;

  const skillMdUrl = deriveSkillMdUrl(hit);
  if (!skillMdUrl) return null;

  const tags = dedupe(
    [
      ...(hit.tags ?? []),
      ...(hit.categories ?? []),
      "skillsmp",
    ]
      .map((t) => t.toLowerCase())
      .filter((t) => t.length > 0)
  );
  if (tags.length === 0) tags.push("skillsmp");

  return {
    id,
    name,
    type: "claude_code_skill",
    description,
    tags,
    verified: false, // marketplace entries are community by default
    author: normalizeAuthor(hit),
    homepage: hit.homepage ?? hit.url ?? skillMdUrl,
    version: hit.version,
    license: hit.license,
    install: {
      skill_files: [
        {
          source: skillMdUrl,
          target: "SKILL.md",
        },
      ],
    },
    source: {
      adapter: "skillsmp",
      origin: hit.url ?? hit.homepage ?? skillMdUrl,
      fetched_at: new Date().toISOString(),
    },
  };
}

function deriveSkillMdUrl(hit: SkillsmpHit): string | null {
  const direct = hit.skill_md_url ?? hit.raw_url;
  if (typeof direct === "string" && direct.startsWith("https://")) return direct;

  // Try to construct a raw GitHub URL from owner/repo when present.
  const repo = hit.repository ?? hit.repo;
  if (typeof repo === "string" && /^https:\/\/github\.com\//.test(repo)) {
    // Best-effort: assume default branch "main" and a top-level SKILL.md.
    // If the repo nests skills deeper, the adapter should be extended with
    // a per-entry path hint — out of scope for the first cut.
    const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\.git)?$/.exec(repo);
    if (m) {
      const owner = m[1]!;
      const name = m[2]!.replace(/\.git$/, "");
      return `https://raw.githubusercontent.com/${owner}/${name}/main/SKILL.md`;
    }
  }
  return null;
}

function normalizeAuthor(hit: SkillsmpHit): { name: string; url?: string } {
  if (typeof hit.author === "string") return { name: hit.author };
  if (hit.author && typeof hit.author === "object") {
    return { name: hit.author.name ?? "unknown", url: hit.author.url };
  }
  if (hit.owner) return { name: hit.owner };
  return { name: "skillsmp community" };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
