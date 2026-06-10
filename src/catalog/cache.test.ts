import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { load } from "./cache.js";

test("load: malformed remote catalog (no entries array) falls back instead of crashing", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "omakase-cache-"));
  const originalCache = process.env["XDG_CACHE_HOME"];
  const originalRemote = process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (message?: unknown) => {
    logged.push(String(message));
  };
  // Valid JSON, but structurally bogus: no `entries` array. This used to crash
  // downstream on `entries.map` in sanitizeCatalog.
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ version: 1, generated_at: "x" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  process.env["XDG_CACHE_HOME"] = cacheDir;
  process.env["CLAUDE_OMAKASE_CATALOG_URL"] = "https://example.invalid/catalog.json";

  try {
    const catalog = await load();
    assert.ok(Array.isArray(catalog.entries), "load() must return a usable catalog, not throw");
    assert.ok(logged.some((line) => /falling back/.test(line)), "the malformed remote is logged");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (originalCache === undefined) delete process.env["XDG_CACHE_HOME"];
    else process.env["XDG_CACHE_HOME"] = originalCache;
    if (originalRemote === undefined) delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];
    else process.env["CLAUDE_OMAKASE_CATALOG_URL"] = originalRemote;
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("load: remote catalog failure falls back to bundled catalog", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "omakase-cache-"));
  const originalCache = process.env["XDG_CACHE_HOME"];
  const originalRemote = process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (message?: unknown) => {
    logged.push(String(message));
  };
  globalThis.fetch = async () => {
    throw new TypeError("network failure");
  };
  process.env["XDG_CACHE_HOME"] = cacheDir;
  process.env["CLAUDE_OMAKASE_CATALOG_URL"] = "https://example.invalid/catalog.json";

  try {
    const catalog = await load();

    assert.equal(catalog.version, 1);
    assert.ok(Array.isArray(catalog.entries));
    assert.ok(logged.some((line) => /remote fetch failed, falling back/.test(line)));
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (originalCache === undefined) {
      delete process.env["XDG_CACHE_HOME"];
    } else {
      process.env["XDG_CACHE_HOME"] = originalCache;
    }
    if (originalRemote === undefined) {
      delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];
    } else {
      process.env["CLAUDE_OMAKASE_CATALOG_URL"] = originalRemote;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("load: serving from the bundled catalog seeds the XDG cache copy for the hooks", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "omakase-cache-"));
  const originalCache = process.env["XDG_CACHE_HOME"];
  const originalRemote = process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  process.env["XDG_CACHE_HOME"] = cacheDir;
  delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];

  try {
    const catalog = await load();
    assert.ok(Array.isArray(catalog.entries));
    // The proactive hooks can only read the XDG cache copy (or a path relative
    // to their own install dir) — never this package's bundled file. Serving
    // from bundled must therefore refresh the cache copy.
    const cached = JSON.parse(
      await readFile(join(cacheDir, "claude-omakase", "catalog.json"), "utf8")
    );
    assert.ok(Array.isArray(cached.entries), "cache copy seeded from the bundled catalog");
  } finally {
    if (originalCache === undefined) delete process.env["XDG_CACHE_HOME"];
    else process.env["XDG_CACHE_HOME"] = originalCache;
    if (originalRemote === undefined) delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];
    else process.env["CLAUDE_OMAKASE_CATALOG_URL"] = originalRemote;
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("load: valid remote catalog writes cache atomically without leaving temp files", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "omakase-cache-"));
  const originalCache = process.env["XDG_CACHE_HOME"];
  const originalRemote = process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        version: 1,
        generated_at: "2026-06-04T00:00:00.000Z",
        entries: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  process.env["XDG_CACHE_HOME"] = cacheDir;
  process.env["CLAUDE_OMAKASE_CATALOG_URL"] = "https://example.invalid/catalog.json";

  try {
    const catalog = await load();

    assert.equal(catalog.generated_at, "2026-06-04T00:00:00.000Z");
    const dir = join(cacheDir, "claude-omakase");
    assert.deepEqual((await readdir(dir)).sort(), ["catalog.json"]);
    assert.equal(
      JSON.parse(await readFile(join(dir, "catalog.json"), "utf8")).generated_at,
      "2026-06-04T00:00:00.000Z"
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCache === undefined) delete process.env["XDG_CACHE_HOME"];
    else process.env["XDG_CACHE_HOME"] = originalCache;
    if (originalRemote === undefined) delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];
    else process.env["CLAUDE_OMAKASE_CATALOG_URL"] = originalRemote;
    await rm(cacheDir, { recursive: true, force: true });
  }
});
