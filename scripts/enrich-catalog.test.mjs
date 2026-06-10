import { test } from "node:test";
import assert from "node:assert/strict";
import { chatUrl, parseTerms, mergeTerms, loadDotEnv } from "./enrich-catalog.mjs";

test("chatUrl: normalizes bare host, /v1 base, and full URL", () => {
  // Bare Ollama host → /v1/chat/completions
  assert.equal(
    chatUrl("http://neuron.uiyunkim.com:11434"),
    "http://neuron.uiyunkim.com:11434/v1/chat/completions"
  );
  // /v1 base → append /chat/completions
  assert.equal(chatUrl("http://localhost:11434/v1"), "http://localhost:11434/v1/chat/completions");
  assert.equal(chatUrl("http://localhost:11434/v1/"), "http://localhost:11434/v1/chat/completions");
  // Already a full chat URL → unchanged
  assert.equal(
    chatUrl("https://api.example.com/v1/chat/completions"),
    "https://api.example.com/v1/chat/completions"
  );
});

test("loadDotEnv: parses KEY=VALUE, strips quotes, ignores comments/blanks", () => {
  const env = loadDotEnv(
    ["# comment", "", "BASE_URL=http://h:11434", 'MODEL="gpt-oss-120b"', "AUTH_TOKEN='abc'", "bad line"].join("\n")
  );
  assert.deepEqual(env, {
    BASE_URL: "http://h:11434",
    MODEL: "gpt-oss-120b",
    AUTH_TOKEN: "abc",
  });
});

test("parseTerms: extracts a clean JSON array from fenced/prose output", () => {
  const content = 'Here you go:\n```json\n["Web Scraping", "crawl", "extract data"]\n```';
  assert.deepEqual(parseTerms(content), ["web scraping", "crawl", "extract data"]);
});

test("parseTerms: lowercases, trims, dedupes, drops too-short/too-long", () => {
  const content = JSON.stringify(["A", "good", "GOOD", "  spaced  out  ", "x".repeat(50)]);
  // "A" too short (1 char), duplicate GOOD collapses, 50-char dropped.
  assert.deepEqual(parseTerms(content), ["good", "spaced out"]);
});

test("parseTerms: caps at MAX_TERMS (14)", () => {
  const many = JSON.stringify(Array.from({ length: 30 }, (_, i) => `term${i}`));
  assert.equal(parseTerms(many).length, 14);
});

test("parseTerms: garbage / non-array / non-string returns []", () => {
  assert.deepEqual(parseTerms("no array here"), []);
  assert.deepEqual(parseTerms('{"a":1}'), []);
  assert.deepEqual(parseTerms(42), []);
  assert.deepEqual(parseTerms("[not, valid, json]"), []);
});

test("mergeTerms: drops terms that just echo the name or existing tags", () => {
  const entry = { name: "Web Scraper", tags: ["scrape", "data"] };
  const merged = mergeTerms(entry, ["scrape", "crawl", "web scraper", "extract"]);
  assert.deepEqual(merged, ["crawl", "extract"]);
});
