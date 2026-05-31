// Adapter for skillsmp.com — the public agent-skills marketplace.
//
// Endpoint:
//   GET https://skillsmp.com/api/v1/skills/search?q=<query>&limit=<n>
//
// Actual response shape (verified 2026-05-31):
//   { success: true, data: { skills: [...] }, meta: {...} }
//
// Each hit:
//   { id, name, author, description, githubUrl, skillUrl, stars, updatedAt }
//
// githubUrl is a GitHub tree URL (e.g. github.com/owner/repo/tree/main/path).
// We convert it to a raw SKILL.md URL for install.skill_files.
//
// Anonymous rate limit: ~50 req/day. Seed set ≤14 queries → well under limit.

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
  name?: string;
  author?: string;
  description?: string;
  githubUrl?: string;   // tree URL: github.com/owner/repo/tree/branch/path
  skillUrl?: string;    // canonical skillsmp.com page
  stars?: number;
  updatedAt?: string;
}

interface SkillsmpResponse {
  success?: boolean;
  data?: { skills?: SkillsmpHit[] } | SkillsmpHit[];
  results?: SkillsmpHit[];
  skills?: SkillsmpHit[];
  meta?: unknown;
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

  // Handle nested shape: { data: { skills: [...] } }  (current API as of 2026-05)
  if (body.data && !Array.isArray(body.data) && Array.isArray((body.data as { skills?: unknown }).skills)) {
    return (body.data as { skills: SkillsmpHit[] }).skills;
  }
  // Legacy / alternate shapes
  const hits = Array.isArray(body.data) ? body.data
    : Array.isArray(body.results) ? body.results
    : Array.isArray(body.skills) ? body.skills
    : [];
  return hits;
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

// Map a skillsmp hit to our Entry shape.
// Returns null when id, description, or a derivable SKILL.md URL is missing.
export function normalize(hit: SkillsmpHit): Entry | null {
  const id = (hit.id ?? slugify(hit.name ?? "")).trim();
  if (!id) return null;

  const name = (hit.name ?? id).trim();
  const description = (hit.description ?? "").trim();
  if (!description) return null;

  const skillMdUrl = deriveSkillMdUrl(hit);
  if (!skillMdUrl) return null;

  const homepage = hit.skillUrl ?? skillMdUrl;

  return {
    id,
    name,
    type: "claude_code_skill",
    description,
    tags: ["skillsmp"],
    verified: false,
    author: { name: hit.author ?? "skillsmp community" },
    homepage,
    install: {
      skill_files: [{ source: skillMdUrl, target: "SKILL.md" }],
    },
    source: {
      adapter: "skillsmp",
      origin: homepage,
      fetched_at: new Date().toISOString(),
    },
  };
}

// Convert a GitHub tree URL to a raw SKILL.md URL.
// Input:  https://github.com/owner/repo/tree/branch/some/path
// Output: https://raw.githubusercontent.com/owner/repo/branch/some/path/SKILL.md
function deriveSkillMdUrl(hit: SkillsmpHit): string | null {
  const url = hit.githubUrl;
  if (!url) return null;

  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/.exec(url);
  if (m) {
    const [, owner, repo, branch, path] = m;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}/SKILL.md`;
  }

  // Plain repo URL (no path) — look for SKILL.md at root
  const repoM = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)$/.exec(url);
  if (repoM) {
    return `https://raw.githubusercontent.com/${repoM[1]}/${repoM[2]}/main/SKILL.md`;
  }

  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

