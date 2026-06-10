// Adapter for glama.ai — a public MCP server directory with a documented JSON
// API and per-server upstream repo links.
//
// Endpoint (Relay-style cursor pagination):
//   GET https://glama.ai/api/mcp/v1/servers?first=<n>&after=<cursor>
//
// Response shape (verified 2026-06-04):
//   {
//     pageInfo: { hasNextPage, endCursor, ... },
//     servers: [{
//       id, name, slug, namespace, description,
//       repository: { url },           // upstream GitHub repo
//       spdxLicense: { name, url },     // optional
//       attributes: ["hosting:local-only", ...],
//       url                             // glama.ai server page
//     }]
//   }
//
// We only emit servers backed by a GitHub repo, since that's the only source we
// can derive a SKILL.md URL from and audit against (mirrors awesome-mcp). All
// entries are verified:false — community directory, not personally audited.
// Pagination is bounded so the build stays polite and fast.

import type { Entry } from "../types.js";
import { sanitizeTags } from "../catalog/sanitize.js";

const BASE = "https://glama.ai/api/mcp/v1/servers";
const PAGE_SIZE = 100;
const MAX_PAGES = 5; // bound: up to 500 servers per build

interface GlamaServer {
  id?: string;
  name?: string;
  slug?: string;
  namespace?: string;
  description?: string;
  repository?: { url?: string };
  spdxLicense?: { name?: string; url?: string };
  attributes?: string[];
  url?: string;
}

interface GlamaResponse {
  servers?: GlamaServer[];
  pageInfo?: { hasNextPage?: boolean; endCursor?: string };
}

export async function fetch(): Promise<Entry[]> {
  const byId = new Map<string, Entry>();
  let after: string | undefined;
  let seenCursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    let body: GlamaResponse;
    try {
      body = await fetchPage(after);
    } catch (e) {
      console.error(`glama: page ${page} failed: ${(e as Error).message}`);
      break;
    }

    for (const server of body.servers ?? []) {
      const entry = normalize(server);
      if (entry && !byId.has(entry.id)) byId.set(entry.id, entry);
    }

    const next = body.pageInfo?.endCursor;
    // Stop on the last page, a missing cursor, or a cursor that didn't advance
    // (guards against an ignored `after` param looping forever).
    if (!body.pageInfo?.hasNextPage || !next || next === seenCursor) break;
    seenCursor = next;
    after = next;
  }

  return [...byId.values()];
}

async function fetchPage(after?: string): Promise<GlamaResponse> {
  const url = new URL(BASE);
  url.searchParams.set("first", String(PAGE_SIZE));
  if (after) url.searchParams.set("after", after);

  const res = await globalThis.fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "application/json",
      "User-Agent":
        "claude-omakase-adapter (+https://github.com/gyuch-an02/claude-omakase)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as GlamaResponse;
}

// Map a Glama server to our Entry shape. Returns null when there is no GitHub
// repo to derive a SKILL.md from, or no description.
export function normalize(server: GlamaServer): Entry | null {
  const description = (server.description ?? "").replace(/\s+/g, " ").trim();
  if (!description) return null;

  const gh = parseGithub(server.repository?.url);
  if (!gh) return null;

  const id = slugify(server.slug ?? server.name ?? "");
  if (!id) return null;

  const name = (server.name ?? id).trim();
  const homepage = server.url ?? `https://github.com/${gh.owner}/${gh.repo}`;
  const skillMdUrl = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/main/SKILL.md`;

  const entry: Entry = {
    id,
    name,
    type: "claude_code_skill",
    description,
    tags: buildTags(name, server.attributes),
    verified: false,
    author: {
      name: server.namespace ?? gh.owner,
      url: `https://github.com/${gh.owner}/${gh.repo}`,
    },
    homepage,
    install: {
      skill_files: [{ source: skillMdUrl, target: "SKILL.md" }],
    },
    source: {
      adapter: "glama",
      origin: homepage,
      fetched_at: new Date().toISOString(),
    },
  };

  const license = server.spdxLicense?.name?.trim();
  if (license) entry.license = license;

  return entry;
}

function parseGithub(url?: string): { owner: string; repo: string } | null {
  if (!url) return null;
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]!.replace(/\.git$/, "") };
}

function buildTags(name: string, attributes?: string[]): string[] {
  // Glama attributes look like "hosting:local-only" — keep the value half only.
  const attrTokens = (attributes ?? []).map((a) => a.split(":").pop() ?? a);
  return sanitizeTags(["mcp", "glama", ...attrTokens, ...tokenize(name)]);
}

function tokenize(s: string): string[] {
  return s.split(/[\s\-_/]+/).filter((w) => w.length > 1);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
