#!/usr/bin/env node
// Build-time semantic enrichment. For each catalog entry, ask an LLM for synonyms
// / alternate phrasings / related keywords and store them in `entry.search_terms`.
// The shared retrieval engine (hooks/retrieval.mjs) then matches a query against
// those terms — so "crawl a website" can hit a skill described as "web scraping"
// WITHOUT any model at serving time. The terms ship inside catalog.json.
//
// This is a MAINTAINER build step, like build-catalog. It is provider-agnostic:
// it POSTs to any OpenAI-compatible /chat/completions endpoint, so a free local
// LLM (Ollama / vLLM / LM Studio) works — the model is NEVER distributed, only
// the generated terms are committed.
//
//   OMAKASE_LLM_URL=http://localhost:11434/v1 \
//   OMAKASE_LLM_MODEL=qwen2.5:7b \
//   node scripts/enrich-catalog.mjs
//
//   node scripts/enrich-catalog.mjs --force        # re-enrich entries that already have terms
//   node scripts/enrich-catalog.mjs --limit 20     # only the first 20 (smoke test)
//   node scripts/enrich-catalog.mjs --dry-run      # don't write catalog.json
//
// Env:
//   OMAKASE_LLM_URL   required — base URL ending in /v1 OR a full chat-completions URL
//   OMAKASE_LLM_MODEL required — model name the endpoint serves
//   OMAKASE_LLM_KEY   optional — bearer token (local servers usually need none)

import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_TERMS = 14; // room for both English and Korean terms
const CONCURRENCY = 4;
const TIMEOUT_MS = 30_000;

export function chatUrl(base) {
  const b = String(base).replace(/\/+$/, "");
  if (b.endsWith("/chat/completions")) return b;
  // Ollama / vLLM expose the OpenAI-compatible API under /v1. Accept a bare host
  // (http://host:11434) or a /v1 base and normalize both to the chat endpoint.
  if (/\/v\d+$/.test(b)) return `${b}/chat/completions`;
  return `${b}/v1/chat/completions`;
}

// Optional zero-dep .env loader. Reads ./.env (if present) and fills any var not
// already set in the environment. Lets the maintainer keep AUTH_TOKEN out of the
// shell history / repo (.env is gitignored). Real env vars always win.
export function loadDotEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

// Pull a JSON string array out of a model response that may be fenced or prefixed
// with prose. Returns a cleaned, deduped, capped list of lowercase terms.
export function parseTerms(content) {
  if (typeof content !== "string") return [];
  const match = content.match(/\[[\s\S]*?\]/);
  if (!match) return [];
  let arr;
  try {
    arr = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (t.length < 2 || t.length > 40) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TERMS) break;
  }
  return out;
}

// Don't store terms that just echo the name/existing tags — they add no recall.
export function mergeTerms(entry, terms) {
  const have = new Set([
    ...(entry.tags ?? []).map((t) => String(t).toLowerCase()),
    String(entry.name ?? "").toLowerCase(),
  ]);
  return terms.filter((t) => !have.has(t));
}

function buildPrompt(entry) {
  return (
    `A user is searching a catalog of Claude Code skills. Given one skill, list the ` +
    `search keywords, synonyms, and alternate phrasings a user might TYPE to find it.\n` +
    `Provide them in BOTH English AND Korean (한국어) — roughly half each — because ` +
    `users search in either language (e.g. for a web-scraping skill: "crawl", ` +
    `"extract data", "scrape site", "크롤링", "웹 스크래핑", "데이터 추출", "웹사이트 긁기"). ` +
    `Return ONLY a JSON array of ${MAX_TERMS} or fewer short lowercase strings. ` +
    `Each array element is ONE standalone keyword in ONE language — do NOT combine ` +
    `English and Korean in the same string, do NOT use dashes/slashes to join them. ` +
    `Include both languages as SEPARATE elements. No prose.\n\n` +
    `Skill name: ${entry.name}\n` +
    `Description: ${entry.description}`
  );
}

async function enrichOne(entry, cfg) {
  const res = await fetch(cfg.url, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You output only a JSON array of strings. No prose, no markdown." },
        { role: "user", content: buildPrompt(entry) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content;
  return mergeTerms(entry, parseTerms(content));
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

  // Pull .env (gitignored) into the environment for any key not already set.
  const envPath = join(repoRoot, ".env");
  if (existsSync(envPath)) {
    const fromFile = loadDotEnv(readFileSync(envPath, "utf8"));
    for (const [k, v] of Object.entries(fromFile)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }

  // Canonical OMAKASE_* names win; also accept the generic BASE_URL/MODEL/
  // AUTH_TOKEN names so a shared lab .env drops in without renaming.
  const url = process.env.OMAKASE_LLM_URL ?? process.env.BASE_URL;
  const model = process.env.OMAKASE_LLM_MODEL ?? process.env.MODEL;
  const key = process.env.OMAKASE_LLM_KEY ?? process.env.AUTH_TOKEN;
  if (!url || !model) {
    // LOUD failure — never silently skip enrichment and pretend the catalog is enriched.
    console.error(
      "enrich-catalog: a chat endpoint URL and model are required.\n" +
        "  Set OMAKASE_LLM_URL + OMAKASE_LLM_MODEL (or BASE_URL + MODEL), e.g. in .env:\n" +
        "    BASE_URL=http://neuron.uiyunkim.com:11434\n" +
        "    MODEL=gpt-oss-120b\n" +
        "    AUTH_TOKEN=...        # optional, for an authenticated endpoint"
    );
    process.exit(1);
  }
  const cfg = { url: chatUrl(url), model, key };

  const catalogPath = join(repoRoot, "catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];

  const todo = entries.filter((e) => force || !Array.isArray(e.search_terms) || e.search_terms.length === 0);
  const slice = Number.isFinite(limit) ? todo.slice(0, limit) : todo;
  console.log(
    `Enriching ${slice.length} entr${slice.length === 1 ? "y" : "ies"} ` +
      `(of ${entries.length}; ${todo.length} need it) via ${cfg.model} …`
  );

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < slice.length; i += CONCURRENCY) {
    const chunk = slice.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (entry) => {
        try {
          const terms = await enrichOne(entry, cfg);
          if (terms.length > 0) {
            entry.search_terms = terms;
            ok++;
          } else {
            failed++;
            console.error(`  no usable terms: ${entry.id}`);
          }
        } catch (e) {
          failed++;
          console.error(`  failed ${entry.id}: ${e.message}`);
        }
      })
    );
    process.stderr.write(`  ${Math.min(i + CONCURRENCY, slice.length)}/${slice.length}\r`);
  }
  process.stderr.write("\n");
  console.log(`\n  ✅ enriched: ${ok}\n  ❌ failed/empty: ${failed}`);

  if (dryRun) {
    console.log("\n--dry-run: catalog.json not modified.");
    return;
  }
  if (ok > 0) {
    await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
    console.log(`\nWrote search_terms for ${ok} entries to ${catalogPath}`);
  } else {
    console.log("\nNo entries enriched — catalog.json unchanged.");
  }
}

// Only run when invoked directly, so the pure helpers can be unit-tested.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
