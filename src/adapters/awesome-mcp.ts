// Adapter for github.com/punkpeye/awesome-mcp-servers — the community-curated
// list of MCP servers and Claude skills. Fetches the README.md, parses list
// items grouped under H2/H3 category headers, and emits catalog entries.
//
// Parsing strategy:
//   H2/H3 headers → category tag
//   `- [Name](github-url) - description` → one Entry per line
//
// Entries are marked `verified: false` (community, not audited).
// skill_files point to a speculative SKILL.md URL; the installer writes a
// stub automatically if the file doesn't exist upstream.

import type { Entry } from "../types.js";

const README_URL =
  "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md";

export async function fetch(): Promise<Entry[]> {
  const res = await globalThis.fetch(README_URL, {
    headers: {
      Accept: "text/plain",
      "User-Agent":
        "claude-omakase-adapter (+https://github.com/gyuch-an02/claude-omakase)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching README`);
  const text = await res.text();
  return parseReadme(text);
}

export function parseReadme(text: string): Entry[] {
  const byId = new Map<string, Entry>();
  let currentCategory = "";

  for (const line of text.split("\n")) {
    const hdr = /^#{2,3}\s+(.+)/.exec(line);
    if (hdr) {
      // Strip emoji prefixes from category names.
      currentCategory = hdr[1]!
        .replace(/^[\u{1F300}-\u{1FAFF} 📁🔧🌍✅🔒🌐]+/u, "")
        .trim()
        .toLowerCase();
      continue;
    }

    // Skip table separators and headers.
    if (/^\s*\|[-| ]+\|/.test(line) || /^\s*\|\s*Name/.test(line)) continue;

    // List item: - [Name](url) - description
    const m =
      /^\s*-\s+(?:\*\*)?(?:<a[^>]*>)?\[([^\]]+)\]\(([^)]+)\)(?:<\/a>)?(?:\*\*)?\s*[-–—:]\s*(.+)/.exec(
        line
      );
    if (!m) continue;

    const entry = normalizeHit(
      m[1]!.trim(),
      m[2]!.trim(),
      m[3]!.trim(),
      currentCategory
    );
    if (entry && !byId.has(entry.id)) byId.set(entry.id, entry);
  }

  return [...byId.values()];
}

export function normalizeHit(
  rawName: string,
  url: string,
  rawDesc: string,
  category: string
): Entry | null {
  const name = rawName.trim();
  const description = rawDesc.replace(/\s+/g, " ").trim();
  if (!name || !description) return null;

  // Only accept GitHub URLs — other links lack a reliable SKILL.md derivation.
  const ghMatch = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  if (!ghMatch) return null;

  const owner = ghMatch[1]!;
  const repo = ghMatch[2]!;
  const id = slugify(repo);
  const homepage = `https://github.com/${owner}/${repo}`;
  const skillMdUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`;

  const tags = buildTags(name, category);

  return {
    id,
    name,
    type: "claude_code_skill",
    description,
    tags,
    verified: false,
    author: { name: `${owner}`, url: `https://github.com/${owner}` },
    homepage,
    install: {
      skill_files: [{ source: skillMdUrl, target: "SKILL.md" }],
    },
    source: {
      adapter: "awesome-mcp",
      origin: homepage,
      fetched_at: new Date().toISOString(),
    },
  };
}

function buildTags(name: string, category: string): string[] {
  const raw = [
    "mcp",
    "awesome-mcp",
    ...tokenize(category),
    ...tokenize(name),
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
