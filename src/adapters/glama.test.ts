import { test } from "node:test";
import assert from "node:assert/strict";
import { fetch as fetchGlama, normalize } from "./glama.js";

// A real-shaped Glama server record (fields per the 2026-06-04 API).
const SAMPLE = {
  id: "prv6iazize",
  name: "Aula MCP Server",
  slug: "aula-mcp-server",
  namespace: "ilenhart",
  description: "Enables Claude to access the Danish school communication platform.",
  repository: { url: "https://github.com/ilenhart/aula-mcp-server" },
  spdxLicense: { name: "MIT License", url: "https://spdx.org/licenses/MIT.json" },
  attributes: ["hosting:local-only"],
  url: "https://glama.ai/mcp/servers/prv6iazize",
};

test("normalize: real Glama server → Entry with derived SKILL.md", () => {
  const entry = normalize(SAMPLE);
  assert.ok(entry);
  assert.equal(entry!.id, "aula-mcp-server");
  assert.equal(entry!.name, "Aula MCP Server");
  assert.equal(entry!.type, "claude_code_skill");
  assert.equal(entry!.verified, false);
  assert.equal(entry!.source.adapter, "glama");
  assert.equal(entry!.author.name, "ilenhart");
  assert.equal(entry!.license, "MIT License");
  assert.equal(
    entry!.install.skill_files?.[0]?.source,
    "https://raw.githubusercontent.com/ilenhart/aula-mcp-server/main/SKILL.md"
  );
  assert.equal(entry!.install.skill_files?.[0]?.target, "SKILL.md");
  assert.ok(entry!.tags.includes("glama"));
  assert.ok(entry!.tags.includes("mcp"));
  // attribute "hosting:local-only" keeps the value half as a tag
  assert.ok(entry!.tags.includes("local-only"));
});

test("normalize: slug missing → slugifies the name", () => {
  const entry = normalize({ ...SAMPLE, slug: undefined, name: "Mixed CASE Name!" });
  assert.ok(entry);
  assert.equal(entry!.id, "mixed-case-name");
});

test("normalize: no GitHub repo → null (cannot derive/audit a SKILL.md)", () => {
  assert.equal(normalize({ ...SAMPLE, repository: { url: "https://gitlab.com/a/b" } }), null);
  assert.equal(normalize({ ...SAMPLE, repository: undefined }), null);
});

test("normalize: missing description → null", () => {
  assert.equal(normalize({ ...SAMPLE, description: "   " }), null);
});

test("normalize: repo URL with .git suffix is stripped", () => {
  const entry = normalize({ ...SAMPLE, repository: { url: "https://github.com/a/b.git" } });
  assert.ok(entry);
  assert.equal(
    entry!.install.skill_files?.[0]?.source,
    "https://raw.githubusercontent.com/a/b/main/SKILL.md"
  );
});

test("fetch: follows pagination across pages then stops", async () => {
  const originalFetch = globalThis.fetch;
  const pages = [
    {
      servers: [SAMPLE],
      pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
    },
    {
      servers: [{ ...SAMPLE, id: "two", slug: "second-server", name: "Second Server" }],
      pageInfo: { hasNextPage: false, endCursor: "cursor-2" },
    },
  ];
  let call = 0;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(pages[call++] ?? { servers: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const entries = await fetchGlama();
    assert.equal(call, 2, "should fetch exactly 2 pages then stop on hasNextPage:false");
    assert.deepEqual(
      entries.map((e) => e.id).sort(),
      ["aula-mcp-server", "second-server"]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetch: stops if the cursor does not advance (ignored `after` guard)", async () => {
  const originalFetch = globalThis.fetch;
  let call = 0;
  // Always claims hasNextPage with the SAME cursor — must not loop forever.
  globalThis.fetch = async () => {
    call++;
    return new Response(
      JSON.stringify({
        servers: [SAMPLE],
        pageInfo: { hasNextPage: true, endCursor: "stuck" },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  try {
    const entries = await fetchGlama();
    assert.equal(call, 2, "second page repeats cursor → stop");
    assert.equal(entries.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetch: HTTP error is non-fatal, returns what it has", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  globalThis.fetch = async () => new Response("nope", { status: 500 });
  console.error = () => {};
  try {
    const entries = await fetchGlama();
    assert.deepEqual(entries, []);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});
