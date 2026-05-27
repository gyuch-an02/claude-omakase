import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handle } from "./find-skill.js";

test("find_skill: empty catalog returns zero matches without throwing", async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), "omakase-cache-"));
  const originalCache = process.env["XDG_CACHE_HOME"];
  const originalRemote = process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  t.after(() => {
    if (originalRemote === undefined) {
      delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];
    } else {
      process.env["CLAUDE_OMAKASE_CATALOG_URL"] = originalRemote;
    }
  });

  process.env["XDG_CACHE_HOME"] = cacheDir;
  delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];
  await writeFile(
    join(cacheDir, "claude-omakase", "catalog.json"),
    JSON.stringify({
      version: 1,
      generated_at: "2026-05-27T00:00:00.000Z",
      entries: [],
    }),
    "utf8"
  ).catch(async (e) => {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    await import("node:fs").then(({ mkdirSync }) =>
      mkdirSync(join(cacheDir, "claude-omakase"), { recursive: true })
    );
    await writeFile(
      join(cacheDir, "claude-omakase", "catalog.json"),
      JSON.stringify({
        version: 1,
        generated_at: "2026-05-27T00:00:00.000Z",
        entries: [],
      }),
      "utf8"
    );
  });

  try {
    const result = await handle({ task_description: "anything", limit: 5 });

    assert.deepEqual(result.matches, []);
    assert.equal(result.total_in_catalog, 0);
  } finally {
    if (originalCache === undefined) {
      delete process.env["XDG_CACHE_HOME"];
    } else {
      process.env["XDG_CACHE_HOME"] = originalCache;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});
