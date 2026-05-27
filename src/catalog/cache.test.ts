import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { load } from "./cache.js";

test("load: remote catalog failure falls back to bundled catalog", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "omakase-cache-"));
  const originalCache = process.env["XDG_CACHE_HOME"];
  const originalRemote = process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  const originalError = console.error;
  const logged: string[] = [];
  console.error = (message?: unknown) => {
    logged.push(String(message));
  };
  process.env["XDG_CACHE_HOME"] = cacheDir;
  process.env["CLAUDE_OMAKASE_CATALOG_URL"] = "http://127.0.0.1:9/catalog.json";

  try {
    const catalog = await load();

    assert.equal(catalog.version, 1);
    assert.ok(Array.isArray(catalog.entries));
    assert.ok(logged.some((line) => /remote fetch failed, falling back/.test(line)));
  } finally {
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
