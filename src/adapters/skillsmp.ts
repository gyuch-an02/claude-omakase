// Adapter for skillsmp.com — the public agent-skills marketplace.
//
// Endpoint (from https://skillsmp.com/openapi.json, verified 2026-06-09):
//   GET /api/v1/skills/search
//     q*       required free-text query
//     category one of the 12 marketplace categories (filter)
//     sortBy   "stars" | "recent"
//     page     1-based
//     limit    page size (max 100)
//
// Response: { success, data: { skills: [...] }, meta }
// Each hit: { id, name, author, description, githubUrl, skillUrl, stars, updatedAt }
// `category` is a FILTER input — it is NOT echoed per hit, so we tag each entry
// with the category we queried under.
//
// Strategy — QUALITY-RANKED, BOUNDED, CI-EXPANDED:
//   The marketplace indexes ~1.6M SKILL.md FILES across GitHub (forks +
//   personal ~/.claude/skills copies inflate that hugely; it is NOT 1.6M
//   distinct skills). We do NOT mirror it. CI runs a daily bounded federation:
//   primary category seeds plus broad intent/query seeds, sorted by stars. We
//   dedupe by installable SKILL.md source, preserving multi-skill repositories
//   where each tree path is a separate install target.
//
//   `q` is REQUIRED, so per category we pass a broad representative term. This
//   biases results toward that term — mitigated by many CI-side intent seeds.
//   Anonymous limit is tight; set CLAUDE_OMAKASE_SKILLSMP_TOKEN in CI and tune
//   OMAKASE_SKILLSMP_MAX_REQUESTS to expand the pool. End users never need a
//   token because they consume the committed catalog.json.

import type { Entry } from "../types.js";

const BASE = "https://skillsmp.com/api/v1/skills/search";

// The 12 primary marketplace categories, each with a broad representative query
// to satisfy the required `q` param. (category as sent to the API, q seed.)
const CATEGORY_SEEDS: { category: string; q: string }[] = [
  { category: "Tools", q: "tool" },
  { category: "Business", q: "business" },
  { category: "Development", q: "code" },
  { category: "Testing & Security", q: "test" },
  { category: "Data & AI", q: "data" },
  { category: "DevOps", q: "deploy" },
  { category: "Documentation", q: "docs" },
  { category: "Content & Media", q: "content" },
  { category: "Research", q: "research" },
  { category: "Lifestyle", q: "life" },
  { category: "Databases", q: "database" },
  { category: "Blockchain", q: "blockchain" },
];

const PER_PAGE = 100; // marketplace max
// A typo'd env value (Number("garbage") → NaN) would make every loop bound
// false and silently fetch ZERO pages — warn and fall back instead.
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`skillsmp: ignoring invalid ${name}=${JSON.stringify(raw)}; using ${fallback}`);
    return fallback;
  }
  return n;
}
const MAX_PAGES_PER_SEED = envInt("OMAKASE_SKILLSMP_MAX_PAGES_PER_SEED", 2);
const DEFAULT_REQUEST_BUDGET = process.env["CLAUDE_OMAKASE_SKILLSMP_TOKEN"] ? 180 : 36;
const MAX_REQUESTS = envInt("OMAKASE_SKILLSMP_MAX_REQUESTS", DEFAULT_REQUEST_BUDGET);

// Spacing between requests to stay under the documented rate limit (authenticated
// 30/min → 1 per 2s; anonymous 10/min → 1 per 6s). Without this the adapter fires
// faster than the limit and gets 429'd even WITH a token, which is what made the
// token look useless. Tunable for tests / faster endpoints.
// Comfortable margin under the documented limits (authed 30/min, anon 10/min):
// 3s ≈ 20/min, 7s ≈ 8.5/min. Tighter spacing (e.g. 2.1s ≈ 28/min) sat right at
// the authed ceiling and drew intermittent 429s, so we trade a little speed for
// a clean run. Read at call time so tests can set OMAKASE_SKILLSMP_INTERVAL_MS=0.
function requestIntervalMs(): number {
  const override = process.env["OMAKASE_SKILLSMP_INTERVAL_MS"];
  if (override !== undefined) return Number(override);
  return process.env["CLAUDE_OMAKASE_SKILLSMP_TOKEN"] ? 3000 : 7000;
}

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

const INTENT_SEEDS = [
  "browser automation",
  "code review",
  "pull request",
  "debugging",
  "testing",
  "security audit",
  "documentation",
  "api integration",
  "database",
  "sql",
  "postgres",
  "data analysis",
  "data visualization",
  "machine learning",
  "llm",
  "prompt engineering",
  "research",
  "web scraping",
  "file management",
  "git workflow",
  "github",
  "deployment",
  "docker",
  "kubernetes",
  "aws",
  "terraform",
  "monitoring",
  "logs",
  "notion",
  "slack",
  "jira",
  "figma",
  "excel",
  "csv",
  "pdf",
  "image",
  "video",
  "writing",
  "translation",
  "summarization",
  "meeting notes",
  "email",
  "calendar",
  "finance",
  "blockchain",
  "smart contract",
  "mobile",
  "frontend",
  "backend",
  "devops",
];

interface SeedJob {
  q: string;
  category?: string;
  searchTerm?: string;
}

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
  const bySource = new Map<string, Entry>();
  let requests = 0;

  for (const seed of seedJobs()) {
    for (let page = 1; page <= MAX_PAGES_PER_SEED && requests < MAX_REQUESTS; page++) {
      let hits: SkillsmpHit[];
      try {
        if (requests > 0) await sleep(requestIntervalMs());
        requests++;
        hits = await searchOnce(seed.q, seed.category, page, headers);
      } catch (e) {
        console.error(
          `skillsmp: ${seed.category ?? "all"} p${page} ("${seed.q}") failed: ${
            (e as Error).message
          }`
        );
        break; // stop this seed; move on
      }
      if (hits.length === 0) break;

      for (const hit of hits) {
        const entry = normalize(hit, seed.category, seed.searchTerm);
        if (!entry) continue;
        keepBest(bySource, skillSourceKey(entry), entry);
      }

      if (hits.length < PER_PAGE) break; // last page for this category
    }
  }

  return [...bySource.values()];
}

// Keep the higher-starred entry per installable skill source.
function keepBest(map: Map<string, Entry>, key: string, entry: Entry): void {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, entry);
    return;
  }

  const primary = (entry.stars ?? 0) > (existing.stars ?? 0) ? entry : existing;
  const secondary = primary === entry ? existing : entry;
  map.set(key, mergeEntry(primary, secondary));
}

function skillSourceKey(entry: Entry): string {
  return entry.install.skill_files?.[0]?.source.toLowerCase() ?? entry.id;
}

function mergeEntry(primary: Entry, secondary: Entry): Entry {
  return {
    ...secondary,
    ...primary,
    tags: dedupe([...(primary.tags ?? []), ...(secondary.tags ?? [])]),
    search_terms: dedupe([...(primary.search_terms ?? []), ...(secondary.search_terms ?? [])]),
  };
}

function seedJobs(): SeedJob[] {
  const jobs: SeedJob[] = [
    ...CATEGORY_SEEDS.map((seed) => ({ ...seed })),
    ...INTENT_SEEDS.map((q) => ({ q, searchTerm: q })),
  ];
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.category ?? ""}\0${job.q}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchOnce(
  query: string,
  category: string | undefined,
  page: number,
  headers: Record<string, string>
): Promise<SkillsmpHit[]> {
  const url =
    `${BASE}?q=${encodeURIComponent(query)}` +
    (category ? `&category=${encodeURIComponent(category)}` : "") +
    `&sortBy=stars&page=${page}&limit=${PER_PAGE}`;
  const res = await globalThis.fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body = (await res.json()) as SkillsmpResponse;

  // Handle nested shape: { data: { skills: [...] } }  (current API as of 2026-06)
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
  // skillsmp authenticates via HTTP Bearer (openapi.json securityScheme
  // `bearerAuth`, scheme: bearer). Verified against the live spec 2026-06-10.
  const token = process.env["CLAUDE_OMAKASE_SKILLSMP_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Map a skillsmp hit to our Entry shape. `category` is the marketplace category
// we queried under (skillsmp does not echo it per hit), used for the tier-1
// hierarchy. Returns null when id, description, or a derivable SKILL.md URL is
// missing.
export function normalize(hit: SkillsmpHit, category?: string, searchTerm?: string): Entry | null {
  // The API response is untrusted: a null/non-object element in the skills
  // array must not throw mid-page (the throw would abort the whole adapter).
  if (!hit || typeof hit !== "object") return null;

  const rawName = typeof hit.name === "string" ? hit.name : "";
  let id = (typeof hit.id === "string" ? hit.id : slugify(rawName)).trim();
  // The id becomes the install directory under ~/.claude/skills/. The installer
  // rejects traversal at its own choke point, but a slash/odd-char id would
  // still install to a nested path Claude Code never loads — slugify it here so
  // the catalog only ever carries flat, loadable ids.
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) id = slugify(id);
  if (!id) return null;

  const name = (rawName || id).trim();
  const description = (typeof hit.description === "string" ? hit.description : "").trim();
  if (!description) return null;

  const skillMdUrl = deriveSkillMdUrl(hit);
  if (!skillMdUrl) return null;

  const homepage = typeof hit.skillUrl === "string" && hit.skillUrl ? hit.skillUrl : skillMdUrl;
  const catTag = category ? slugify(category) : null;

  const entry: Entry = {
    id,
    name,
    type: "claude_code_skill",
    description,
    tags: catTag ? ["skillsmp", catTag] : ["skillsmp"],
    verified: false,
    author: { name: typeof hit.author === "string" && hit.author ? hit.author : "skillsmp community" },
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

  if (category) entry.category = category;
  if (typeof hit.stars === "number" && Number.isFinite(hit.stars)) {
    entry.stars = hit.stars;
  }
  if (searchTerm) entry.search_terms = [searchTerm];

  return entry;
}

// Convert a GitHub tree URL to a raw SKILL.md URL.
// Input:  https://github.com/owner/repo/tree/branch/some/path
// Output: https://raw.githubusercontent.com/owner/repo/branch/some/path/SKILL.md
function deriveSkillMdUrl(hit: SkillsmpHit): string | null {
  const url = hit.githubUrl;
  if (!url || typeof url !== "string") return null;

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

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
