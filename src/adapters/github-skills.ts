// github-skills adapter.
// Source assumptions:
// - Source endpoint: GitHub code search API
//   GET https://api.github.com/search/code?q=filename:SKILL.md+in:path&type=code&per_page=20&page=1
// - Each search result points at a repository blob URL for a SKILL.md file.
//   We derive the raw.githubusercontent.com URL from that blob URL.
// - Entry name/description/tags come from SKILL.md frontmatter when present.
// - Results without a derivable HTTPS raw SKILL.md URL or frontmatter
//   description are skipped.
// - GitHub code search requires GITHUB_TOKEN in some environments. Without
//   a token, the adapter returns no entries so catalog builds stay green.

import type { Entry } from "../types.js";

const SEARCH_URL =
  "https://api.github.com/search/code?q=filename%3ASKILL.md+in%3Apath&type=code&per_page=20&page=1";

interface GitHubSearchResponse {
  items?: GitHubCodeSearchItem[];
}

interface GitHubCodeSearchItem {
  name?: string;
  path?: string;
  html_url?: string;
  repository?: {
    full_name?: string;
    html_url?: string;
    owner?: { login?: string };
  };
}

interface GithubSkillsSkill {
  id: string;
  name: string;
  description: string;
  author?: string;
  skill_md_url?: string;
  homepage?: string;
  tags?: string[];
}

export async function fetch(): Promise<Entry[]> {
  if (!process.env["GITHUB_TOKEN"]) return [];

  const res = await globalThis.fetch(SEARCH_URL, { headers: buildHeaders() });
  if (!res.ok) throw new Error(`GitHub code search failed: HTTP ${res.status}`);

  const body = (await res.json()) as GitHubSearchResponse;
  const items = Array.isArray(body.items) ? body.items : [];
  const entries: Entry[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const skill = await skillFromSearchItem(item);
    if (!skill) continue;
    const entry = normalizeGithubSkills(skill);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }

  return entries;
}

export function normalizeGithubSkills(skill: GithubSkillsSkill): Entry | null {
  if (!skill.id || !skill.name || !skill.description || !skill.skill_md_url) {
    return null;
  }
  if (!skill.skill_md_url.startsWith("https://")) return null;

  return {
    id: skill.id,
    name: skill.name,
    type: "claude_code_skill",
    description: skill.description,
    tags: dedupe(skill.tags?.length ? skill.tags : ["github-skills"]),
    verified: false,
    author: { name: skill.author ?? "Unknown" },
    homepage: skill.homepage,
    install: {
      skill_files: [
        {
          source: skill.skill_md_url,
          target: "SKILL.md",
        },
      ],
    },
    source: {
      adapter: "github-skills",
      origin: skill.homepage ?? skill.skill_md_url,
      fetched_at: new Date().toISOString(),
    },
  };
}

async function skillFromSearchItem(item: GitHubCodeSearchItem): Promise<GithubSkillsSkill | null> {
  const rawUrl = rawSkillMdUrl(item.html_url);
  if (!rawUrl) return null;

  const res = await globalThis.fetch(rawUrl, { headers: buildHeaders() });
  if (!res.ok) return null;

  const body = await res.text();
  const frontmatter = parseFrontmatter(body);
  const description = readFrontmatterScalar(frontmatter, "description");
  if (!description) return null;

  const name = readFrontmatterScalar(frontmatter, "name") ?? fallbackName(item);
  const triggers = readFrontmatterList(frontmatter, "triggers");
  const owner = item.repository?.owner?.login ?? item.repository?.full_name?.split("/")[0];

  return {
    id: entryId(item),
    name,
    description,
    author: owner ?? "GitHub community",
    skill_md_url: rawUrl,
    homepage: item.html_url,
    tags: dedupe(["github-skills", ...triggers.map((trigger) => slugify(trigger)).filter(Boolean)]),
  };
}

function rawSkillMdUrl(htmlUrl: string | undefined): string | null {
  if (!htmlUrl) return null;
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+\/)?SKILL\.md$/.exec(htmlUrl);
  if (!match) return null;
  const [, owner, repo, branch, dir = ""] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dir}SKILL.md`;
}

function entryId(item: GitHubCodeSearchItem): string {
  const repo = item.repository?.full_name ?? "github/skill";
  const pathBase = (item.path ?? "SKILL.md").replace(/\/?SKILL\.md$/, "");
  return slugify(`${repo}-${pathBase || "root"}`);
}

function fallbackName(item: GitHubCodeSearchItem): string {
  const path = (item.path ?? "").replace(/\/?SKILL\.md$/, "");
  if (path) return path.split("/").pop() ?? path;
  return item.repository?.full_name?.split("/")[1] ?? "GitHub Skill";
}

function parseFrontmatter(body: string): string {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1] ?? "";
}

function readFrontmatterScalar(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"));
  if (!match?.[1]) return null;
  return stripYamlQuotes(match[1].trim());
}

function readFrontmatterList(frontmatter: string, key: string): string[] {
  const inline = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"));
  if (inline?.[1]) {
    return inline[1]
      .split(",")
      .map((item) => stripYamlQuotes(item.trim()))
      .filter(Boolean);
  }

  const block = frontmatter.match(new RegExp(`^${escapeRegExp(key)}:\\s*\\r?\\n((?:\\s+-\\s+.+\\r?\\n?)+)`, "m"));
  if (!block?.[1]) return [];

  return block[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^\s+-\s+(.+?)\s*$/)?.[1])
    .filter((item): item is string => Boolean(item))
    .map((item) => stripYamlQuotes(item));
}

function stripYamlQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "claude-omakase-adapter (+https://github.com/gyuch-an02/claude-omakase)",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
