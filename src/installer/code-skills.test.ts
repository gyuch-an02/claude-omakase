import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { install, uninstall } from "./code-skills.js";
import type { Entry } from "../types.js";

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: "demo-skill",
  name: "Demo Skill",
  type: "claude_code_skill",
  description: "A skill used in installer tests.",
  tags: ["test"],
  verified: true,
  author: { name: "tester" },
  install: {
    skill_files: [
      {
        source: "https://example.com/SKILL.md",
        target: "SKILL.md",
      },
    ],
  },
  source: { adapter: "test" },
  ...overrides,
});

async function withSkillsDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "omakase-skills-"));
  const original = process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
  process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = dir;
  try {
    return await fn(dir);
  } finally {
    if (original === undefined) {
      delete process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
    } else {
      process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = original;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

function mockFetch(body = "skill body"): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  return () => {
    globalThis.fetch = original;
  };
}

test("install: rejects path traversal targets with a concrete error", async () => {
  await withSkillsDir(async () => {
    await assert.rejects(
      install(
        entry({
          install: {
            skill_files: [
              {
                source: "https://example.com/SKILL.md",
                target: "../etc/passwd",
              },
            ],
          },
        })
      ),
      /unsafe skill target path: \.\.\/etc\/passwd/
    );
  });
});

test("install: rejects a path-traversal entry id before touching the filesystem", async () => {
  await withSkillsDir(async (dir) => {
    const escapeTarget = join(dir, "..", "pwned");
    await assert.rejects(
      install(entry({ id: "../pwned" })),
      /unsafe skill id/
    );
    // The traversal target must NOT have been created or deleted.
    assert.equal(existsSync(escapeTarget), false, "must not create dirs outside the skills root");
  });
});

test("install: rejects non-https skill sources with a concrete error", async () => {
  await withSkillsDir(async () => {
    await assert.rejects(
      install(
        entry({
          install: {
            skill_files: [
              {
                source: "http://example.com/SKILL.md",
                target: "SKILL.md",
              },
            ],
          },
        })
      ),
      /skill source must be https:\/\/: http:\/\/example\.com\/SKILL\.md/
    );
  });
});

test("install: fails clearly when the skill directory already exists", async () => {
  await withSkillsDir(async (dir) => {
    const restoreFetch = mockFetch("first");
    try {
      await install(entry());
      await assert.rejects(
        install(entry()),
        new RegExp(
          `skill "demo-skill" already exists at ${escapeRegExp(
            join(dir, "demo-skill")
          )}; pass force: true to replace it`
        )
      );
    } finally {
      restoreFetch();
    }
  });
});

test("install: force replaces existing files and writes declared skill files", async () => {
  await withSkillsDir(async (dir) => {
    const restoreFetch = mockFetch("replacement body");
    try {
      const skillDir = join(dir, "demo-skill");
      await import("node:fs").then(({ mkdirSync, writeFileSync }) => {
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, "old.txt"), "old", "utf8");
      });

      const result = await install(entry(), { force: true });

      assert.equal(result.skillDir, skillDir);
      assert.equal(existsSync(join(skillDir, "old.txt")), false);
      assert.equal(readFileSync(join(skillDir, "SKILL.md"), "utf8"), "replacement body");
    } finally {
      restoreFetch();
    }
  });
});

test("install: successful forced reinstall leaves no backup or staging residue", async () => {
  await withSkillsDir(async (dir) => {
    const restoreFetch = mockFetch("replacement body");
    try {
      const skillDir = join(dir, "demo-skill");
      await import("node:fs").then(({ mkdirSync, writeFileSync }) => {
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, "old.txt"), "old", "utf8");
      });

      await install(entry(), { force: true });

      // Content swapped in atomically...
      assert.equal(readFileSync(join(skillDir, "SKILL.md"), "utf8"), "replacement body");
      assert.equal(existsSync(join(skillDir, "old.txt")), false);
      // ...and the backup-swap left nothing behind in the skills root.
      const leftovers = readdirSync(dir).filter((n) => n.startsWith(".bak-") || n.startsWith(".tmp-"));
      assert.deepEqual(leftovers, [], "no .bak-/.tmp- residue after a clean force reinstall");
    } finally {
      restoreFetch();
    }
  });
});

test("install: failed multi-file download leaves no partial skill directory", async () => {
  await withSkillsDir(async (dir) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/one.txt")) {
        return new Response("one", { status: 200 });
      }
      return new Response("missing", { status: 404 });
    };

    try {
      await assert.rejects(
        install(
          entry({
            install: {
              skill_files: [
                { source: "https://example.com/one.txt", target: "one.txt" },
                { source: "https://example.com/two.txt", target: "two.txt" },
              ],
            },
          })
        ),
        /fetch https:\/\/example\.com\/two\.txt failed: 404/
      );

      assert.equal(existsSync(join(dir, "demo-skill")), false, "partial install must not remain");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("install: failed forced reinstall preserves existing skill directory", async () => {
  await withSkillsDir(async (dir) => {
    const skillDir = join(dir, "demo-skill");
    await import("node:fs").then(({ mkdirSync, writeFileSync }) => {
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "existing", "utf8");
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("missing", { status: 404 });

    try {
      await assert.rejects(
        install(entry(), { force: true }),
        /fetch https:\/\/example\.com\/SKILL\.md failed: 404/
      );

      assert.equal(readFileSync(join(skillDir, "SKILL.md"), "utf8"), "existing");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("install: rejects a '.' id (which would target the skills root itself)", async () => {
  await withSkillsDir(async () => {
    await assert.rejects(install(entry({ id: "." })), /unsafe skill id/);
  });
});

test("uninstall: rejects a '.' id so it can't wipe the entire skills root", async () => {
  await withSkillsDir(async (dir) => {
    await import("node:fs").then(({ mkdirSync, writeFileSync }) => {
      mkdirSync(join(dir, "keep-me"), { recursive: true });
      writeFileSync(join(dir, "keep-me", "SKILL.md"), "x", "utf8");
    });
    assert.throws(() => uninstall("."), /unsafe skill id/);
    assert.equal(existsSync(join(dir, "keep-me")), true, "other skills must survive");
  });
});

test("install: rejects an empty path segment in the id", async () => {
  await withSkillsDir(async () => {
    await assert.rejects(install(entry({ id: "a//b" })), /unsafe skill id/);
  });
});

test("install: rejects a skill file whose declared size exceeds the cap", async () => {
  await withSkillsDir(async (dir) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("x", {
        status: 200,
        headers: { "content-length": String(6 * 1024 * 1024) },
      });
    try {
      await assert.rejects(install(entry()), /too large/);
      assert.equal(existsSync(join(dir, "demo-skill")), false, "no partial install");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("install: aborts a streamed download once it exceeds the cap", async () => {
  await withSkillsDir(async (dir) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      let sent = 0;
      const stream = new ReadableStream({
        pull(controller) {
          if (sent >= 6) {
            controller.close();
            return;
          }
          sent++;
          controller.enqueue(new Uint8Array(1024 * 1024)); // 1 MiB per chunk
        },
      });
      // No content-length → forces the streaming-cap path.
      return new Response(stream, { status: 200 });
    };
    try {
      await assert.rejects(install(entry()), /too large/);
      assert.equal(existsSync(join(dir, "demo-skill")), false, "no partial install");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
