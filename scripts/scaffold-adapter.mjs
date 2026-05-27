#!/usr/bin/env node
// Scaffold the two files a first-time adapter PR must create.
//
// Usage:
//   npm run scaffold:adapter -- <source-name>

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot =
  process.env.OMAKASE_REPO_ROOT ??
  dirname(dirname(fileURLToPath(import.meta.url)));
const sourceName = process.argv[2];

if (!sourceName || sourceName === "--help" || sourceName === "-h") {
  usage(sourceName ? 0 : 1);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceName)) {
  fail(
    `Adapter name must be kebab-case using lowercase letters, numbers, and hyphens: ${sourceName}`
  );
}

const adaptersDir = join(repoRoot, "src", "adapters");
const adapterPath = join(adaptersDir, `${sourceName}.ts`);
const testPath = join(adaptersDir, `${sourceName}.test.ts`);
const symbolName = toCamel(sourceName);

await mkdir(adaptersDir, { recursive: true });
await writeNewFile(adapterPath, adapterTemplate(sourceName, symbolName));
await writeNewFile(testPath, testTemplate(sourceName, symbolName));

console.log(`Created ${relative(adapterPath)}`);
console.log(`Created ${relative(testPath)}`);
console.log("");
console.log("Next steps:");
console.log(`1. Replace the placeholder fixture in ${relative(adapterPath)}.`);
console.log("2. Register the adapter in src/adapters/index.ts.");
console.log("3. Run npm test && npm run build && npm run build:catalog.");

async function writeNewFile(path, contents) {
  try {
    await writeFile(path, contents, { flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") {
      fail(`Refusing to overwrite existing file: ${relative(path)}`);
    }
    throw error;
  }
}

function adapterTemplate(name, symbol) {
  return `// ${name} adapter.
// Source assumptions:
// - TODO: paste the public source URL or API endpoint.
// - TODO: describe how skill ids, descriptions, authors, and SKILL.md URLs are derived.
// - TODO: note any entries intentionally skipped by normalize${symbol}.

import type { Entry } from "../types.js";

interface ${capitalize(symbol)}Skill {
  id: string;
  name: string;
  description: string;
  author?: string;
  skill_md_url?: string;
  homepage?: string;
  tags?: string[];
}

export async function fetch(): Promise<Entry[]> {
  // TODO: fetch and parse upstream data, then return normalized entries.
  return [];
}

export function normalize${symbol}(skill: ${capitalize(symbol)}Skill): Entry | null {
  if (!skill.id || !skill.name || !skill.description || !skill.skill_md_url) {
    return null;
  }
  if (!skill.skill_md_url.startsWith("https://")) return null;

  return {
    id: skill.id,
    name: skill.name,
    type: "claude_code_skill",
    description: skill.description,
    tags: dedupe(skill.tags?.length ? skill.tags : ["${name}"]),
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
      adapter: "${name}",
      origin: skill.homepage ?? skill.skill_md_url,
    },
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
`;
}

function testTemplate(name, symbol) {
  return `import { test } from "node:test";
import assert from "node:assert/strict";

import { normalize${symbol} } from "./${name}.js";

test("normalize${symbol}: creates an installable entry", () => {
  const entry = normalize${symbol}({
    id: "example-skill",
    name: "Example Skill",
    description: "Example fixture from ${name}.",
    author: "Example Publisher",
    skill_md_url: "https://raw.githubusercontent.com/example/skills/main/example-skill/SKILL.md",
    homepage: "https://github.com/example/skills/tree/main/example-skill",
    tags: ["example", "example"],
  });

  assert.ok(entry);
  assert.equal(entry.id, "example-skill");
  assert.equal(entry.verified, false);
  assert.equal(entry.source.adapter, "${name}");
  assert.deepEqual(entry.tags, ["example"]);
  assert.equal(entry.install.skill_files?.[0]?.target, "SKILL.md");
});

test("normalize${symbol}: skips entries without an HTTPS SKILL.md URL", () => {
  assert.equal(
    normalize${symbol}({
      id: "bad-skill",
      name: "Bad Skill",
      description: "Missing a safe source URL.",
      skill_md_url: "http://example.com/SKILL.md",
    }),
    null
  );
});
`;
}

function toCamel(value) {
  return value.replace(/(^|-)([a-z0-9])/g, (_, __, char) => char.toUpperCase());
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function relative(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path;
}

function usage(code) {
  console.log(`Usage: npm run scaffold:adapter -- <source-name>

Creates:
  src/adapters/<source-name>.ts
  src/adapters/<source-name>.test.ts

Example:
  npm run scaffold:adapter -- awesome-skills`);
  process.exit(code);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
