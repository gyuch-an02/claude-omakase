// Adapter for github.com/modelcontextprotocol/servers — the Anthropic-maintained
// reference server list. Fetches the root README.md and parses entries from it.
//
// Parsing strategy:
//   1. Table rows: `| [Name](url) | description |`
//   2. List items: `- **[Name](url)** - description` or `- [Name](url) - description`
//
// Entries are marked `source_trust: "official"` (first-party provenance) but
// `verified: false` — `verified` is reserved for human-audited handpicked
// entries, not an automated scrape (see ADR 0003). skill_files point to a
// speculative SKILL.md URL derived from the source link — installs fall back to
// a stub if the file doesn't exist.
//
// Rate limits: uses GITHUB_TOKEN env var when available (5000 req/hr),
// otherwise unauthenticated (60 req/hr). A single README fetch keeps us
// well under both limits.

import type { Entry } from "../types.js";

const README_URL =
  "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md";

const REPO_BASE = "https://github.com/modelcontextprotocol/servers/tree/main/src";
const RAW_BASE =
  "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/src";

export async function fetch(): Promise<Entry[]> {
  const headers = buildHeaders();
  const res = await globalThis.fetch(README_URL, {
    signal: AbortSignal.timeout(20_000),
    headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching README`);
  const text = await res.text();
  return parseReadme(text);
}

export function parseReadme(text: string): Entry[] {
  const byId = new Map<string, Entry>();
  let currentSection = "";

  for (const line of text.split("\n")) {
    // Track H2/H3 headers for section context.
    const hdr = /^#{2,3}\s+(.+)/.exec(line);
    if (hdr) {
      currentSection = hdr[1]!.replace(/^[\u{1F300}-\u{1FAFF} ]+/u, "").trim().toLowerCase();
      continue;
    }

    // Skip table separator lines.
    if (/^\s*\|[-| ]+\|/.test(line)) continue;

    // Table row: | [Name](url) | description |
    const tableMatch = /^\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|([^|]+)\|/.exec(line);
    if (tableMatch) {
      const entry = normalizeMatch(
        tableMatch[1]!,
        tableMatch[2]!,
        tableMatch[3]!.trim(),
        currentSection
      );
      if (entry && !byId.has(entry.id)) byId.set(entry.id, entry);
      continue;
    }

    // List item: - **[Name](url)** - description  or  - [Name](url) - description
    const listMatch =
      /^\s*-\s+(?:\*\*)?(?:<a[^>]*>)?\[([^\]]+)\]\(([^)]+)\)(?:<\/a>)?(?:\*\*)?\s*[-–—:]\s*(.+)/.exec(
        line
      );
    if (listMatch) {
      const entry = normalizeMatch(
        listMatch[1]!,
        listMatch[2]!,
        listMatch[3]!.trim(),
        currentSection
      );
      if (entry && !byId.has(entry.id)) byId.set(entry.id, entry);
    }
  }

  return [...byId.values()];
}

export function normalizeMatch(
  rawName: string,
  rawUrl: string,
  rawDesc: string,
  section: string
): Entry | null {
  const name = rawName.trim();
  const description = rawDesc.replace(/\s+/g, " ").trim();
  if (!name || !description) return null;

  // Derive a stable id and source URL from the link.
  const { id, homepage, skillMdUrl } = resolveLink(rawUrl.trim(), name);
  if (!id) return null;

  const tags = buildTags(name, section);

  return {
    id,
    name,
    type: "claude_code_skill",
    description,
    tags,
    // NOT verified: `verified` means a human audited the entry. This is an
    // automated scrape of an official source, so it carries `source_trust:
    // "official"` (a first-party-provenance signal) instead. A human must add it
    // to the handpicked overlay to earn `verified: true`. See ADR 0003.
    verified: false,
    source_trust: "official",
    author: { name: "Anthropic", url: "https://github.com/modelcontextprotocol" },
    homepage,
    install: {
      skill_files: skillMdUrl
        ? [{ source: skillMdUrl, target: "SKILL.md" }]
        : [],
    },
    source: {
      adapter: "mcp-servers-repo",
      origin: homepage,
      fetched_at: new Date().toISOString(),
    },
  };
}

function resolveLink(
  url: string,
  name: string
): { id: string; homepage: string; skillMdUrl: string | null } {
  // Relative path in the same repo: src/filesystem → derive from REPO_BASE.
  if (!url.startsWith("http")) {
    const slug = url.replace(/^\.?\/?/, "").replace(/^src\//, "");
    const id = slugify(slug || name);
    return {
      id,
      homepage: `${REPO_BASE}/${slug}`,
      skillMdUrl: `${RAW_BASE}/${slug}/SKILL.md`,
    };
  }

  // External GitHub repo URL.
  const ghMatch = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  if (ghMatch) {
    const owner = ghMatch[1]!;
    const repo = ghMatch[2]!;
    const id = slugify(repo);
    return {
      id,
      homepage: `https://github.com/${owner}/${repo}`,
      skillMdUrl: `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`,
    };
  }

  // Non-GitHub links — keep as metadata only.
  return { id: slugify(name), homepage: url, skillMdUrl: null };
}

function buildTags(name: string, section: string): string[] {
  const raw = [
    "mcp",
    "mcp-servers-repo",
    ...tokenize(name),
    ...tokenize(section),
  ];
  return dedupe(raw.map((t) => t.toLowerCase()).filter((t) => t.length > 1));
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

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "text/plain",
    "User-Agent": "claude-omakase-adapter (+https://github.com/gyuch-an02/claude-omakase)",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}
