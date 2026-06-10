#!/usr/bin/env node
// Screen the best K for the "Claude reranks the top-K" design. We don't build a
// reranker — find_skill returns K candidates and Claude Code (already in the
// loop) picks the best. So search only has to put the right skill SOMEWHERE in
// the top-K. This measures recall@K: sample skills, have the LLM write a natural
// query for each (without the skill's name), search, and record where the source
// skill lands. recall@K plateauing tells us the K to ship.
//
//   node scripts/eval-recall.mjs            # default sample
//   node scripts/eval-recall.mjs --sample 80
//
// Reuses the same chat endpoint as enrich (OMAKASE_LLM_URL/MODEL, or .env).

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv, chatUrl } from "./enrich-catalog.mjs";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(repoRoot, ".env");
if (existsSync(envPath)) {
  for (const [k, v] of Object.entries(loadDotEnv(readFileSync(envPath, "utf8")))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const url = process.env.OMAKASE_LLM_URL ?? process.env.BASE_URL;
const model = process.env.OMAKASE_LLM_MODEL ?? process.env.MODEL;
const key = process.env.OMAKASE_LLM_KEY ?? process.env.AUTH_TOKEN;
if (!url || !model) {
  console.error("eval-recall: need OMAKASE_LLM_URL/MODEL (or BASE_URL/MODEL) in env/.env");
  process.exit(1);
}
const cfg = { url: chatUrl(url), model, key };

const args = process.argv.slice(2);
const sIdx = args.indexOf("--sample");
const SAMPLE = sIdx >= 0 ? Number(args[sIdx + 1]) : 60;
const KS = [1, 3, 5, 8, 10, 15, 20];
const CONCURRENCY = 4;

const { search } = await import(join(repoRoot, "dist", "catalog", "search.js"));
const catalog = JSON.parse(readFileSync(join(repoRoot, "catalog.json"), "utf8"));
const entries = catalog.entries;

// Deterministic spread sample (every Nth by id order) so reruns are comparable.
const sorted = [...entries].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const step = Math.max(1, Math.floor(sorted.length / SAMPLE));
const sample = [];
for (let i = 0; i < sorted.length && sample.length < SAMPLE; i += step) sample.push(sorted[i]);

async function genQuery(entry) {
  const res = await fetch(cfg.url, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/json", ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}) },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: "Output ONLY the query text, no quotes, no prose." },
        {
          role: "user",
          content:
            `A user wants a tool that does this:\n"${entry.description}"\n\n` +
            `Write ONE short natural search query (5-10 words) they'd type to find it, ` +
            `in their OWN words. Do NOT use the tool's name ("${entry.name}"). Output only the query.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return String(body?.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
}

// Rank of the source skill in results, matched by NAME (so a fork with the same
// name still counts as "found"). Infinity if not in top-20.
function rankOf(results, sourceName) {
  const target = sourceName.toLowerCase();
  for (let i = 0; i < results.length; i++) {
    if (results[i].entry.name.toLowerCase() === target) return i + 1;
  }
  return Infinity;
}

const ranks = [];
let failed = 0;
for (let i = 0; i < sample.length; i += CONCURRENCY) {
  const chunk = sample.slice(i, i + CONCURRENCY);
  await Promise.all(
    chunk.map(async (entry) => {
      try {
        const q = await genQuery(entry);
        if (!q) { failed++; return; }
        const results = search(entries, q, 20);
        ranks.push({ q, name: entry.name, rank: rankOf(results, entry.name) });
      } catch {
        failed++;
      }
    })
  );
  process.stderr.write(`  ${Math.min(i + CONCURRENCY, sample.length)}/${sample.length}\r`);
}
process.stderr.write("\n");

const n = ranks.length;
console.log(`\nEvaluated ${n} queries (${failed} failed). recall@K = source skill within top-K:\n`);
console.log("   K   recall   (cumulative)");
for (const K of KS) {
  const hit = ranks.filter((r) => r.rank <= K).length;
  const pct = ((hit / n) * 100).toFixed(0);
  const bar = "█".repeat(Math.round((hit / n) * 30));
  console.log(`  ${String(K).padStart(2)}   ${pct.padStart(3)}%   ${bar}`);
}
const med = ranks.map((r) => r.rank).filter((r) => Number.isFinite(r)).sort((a, b) => a - b);
console.log(`\n  median rank (found ones): ${med.length ? med[Math.floor(med.length / 2)] : "n/a"}`);
console.log(`  not in top-20: ${ranks.filter((r) => !Number.isFinite(r.rank)).length}/${n}`);
console.log("\n  misses (not in top-5):");
for (const r of ranks.filter((r) => r.rank > 5).slice(0, 8)) {
  console.log(`    rank ${r.rank === Infinity ? ">20" : r.rank}: "${r.q}" → wanted ${r.name}`);
}
