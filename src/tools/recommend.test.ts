import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recommendInput, handle } from "./recommend.js";
import type { Entry } from "../types.js";

test("recommend_skills: first-time starter pack returns the full checklist, context-ranked", async (t) => {
  await withIsolatedOmakaseState(t, [
    starterEntry({
      id: "jupyter-notebook",
      name: "Jupyter Notebook",
      description: "Work with notebooks and data analysis.",
      tags: ["starter-pack", "python", "data"],
    }),
    starterEntry({
      id: "playwright",
      name: "Playwright",
      description: "Browser automation and frontend testing.",
      tags: ["starter-pack", "browser", "testing", "frontend"],
    }),
    starterEntry({
      id: "openai-docs",
      name: "OpenAI Docs",
      description: "Use current OpenAI API documentation.",
      tags: ["starter-pack", "openai", "docs"],
    }),
  ]);

  const result = await handle(
    recommendInput.parse({
      context: "I mostly do browser testing work",
    })
  );

  // Onboarding exception: present every staple as a checklist, not one pick.
  assert.equal(result.mode, "starter-pack");
  assert.equal(result.present_as, "checklist");
  assert.equal(result.recommendations.length, 3, "all staples returned for the checklist");
  assert.equal(result.recommendations[0]?.id, "playwright", "most relevant ranked first");
});

test("recommend_skills: first-time checklist ignores limit and returns all staples", async (t) => {
  await withIsolatedOmakaseState(t, [
    starterEntry({
      id: "alpha",
      name: "Alpha",
      description: "First default.",
      tags: ["starter-pack", "alpha", "one"],
    }),
    starterEntry({
      id: "beta",
      name: "Beta",
      description: "Second default.",
      tags: ["starter-pack", "beta", "two"],
    }),
    starterEntry({
      id: "gamma",
      name: "Gamma",
      description: "Third default.",
      tags: ["starter-pack", "gamma", "three"],
    }),
  ]);

  // limit is irrelevant in checklist mode — the whole pack is always returned.
  const result = await handle(recommendInput.parse({ limit: 1 }));

  assert.equal(result.mode, "starter-pack");
  assert.equal(result.present_as, "checklist");
  assert.equal(result.recommendations.length, 3);
});

test("recommend_skills: incomplete starter pack returns ALL missing staples as a checklist", async (t) => {
  await withIsolatedOmakaseState(
    t,
    [
      starterEntry({
        id: "grill-me",
        name: "Grill Me",
        description: "Stress-test your plans.",
        tags: ["starter-pack", "planning"],
      }),
      starterEntry({
        id: "quick-review",
        name: "Quick Review",
        description: "Severity-tagged code review.",
        tags: ["starter-pack", "review"],
      }),
      starterEntry({
        id: "write-a-skill",
        name: "Write a Skill",
        description: "Turn a workflow into a skill.",
        tags: ["starter-pack", "meta"],
      }),
    ],
    ["grill-me"]
  );

  const result = await handle(recommendInput.parse({}));

  // Onboarding exception: surface every missing staple, not just the best one.
  assert.equal(result.mode, "starter-pack-gap");
  assert.equal(result.present_as, "checklist");
  assert.equal(result.recommendations.length, 2);
  const ids = result.recommendations.map((r) => r.id).sort();
  assert.deepEqual(ids, ["quick-review", "write-a-skill"]);
  assert.deepEqual([...result.missing_starter_pack].sort(), ["quick-review", "write-a-skill"]);
});

test("recommend_skills: complete starter pack falls through to verified-defaults", async (t) => {
  await withIsolatedOmakaseState(
    t,
    [
      starterEntry({
        id: "grill-me",
        name: "Grill Me",
        description: "Stress-test your plans.",
        tags: ["starter-pack", "planning"],
      }),
      starterEntry({
        id: "extra-skill",
        name: "Extra Skill",
        description: "Some other verified skill.",
        tags: ["misc"],
      }),
    ],
    ["grill-me"]
  );

  const result = await handle(recommendInput.parse({}));

  assert.equal(result.mode, "verified-defaults");
  assert.ok(result.recommendations.every((r) => r.id !== "grill-me"));
});

test("recommend_skills: whitespace-only context does not suppress the gap nudge", async (t) => {
  await withIsolatedOmakaseState(
    t,
    [
      starterEntry({ id: "grill-me", name: "Grill Me", description: "Plans.", tags: ["starter-pack", "planning"] }),
      starterEntry({ id: "quick-review", name: "Quick Review", description: "Review.", tags: ["starter-pack", "review"] }),
    ],
    ["grill-me"]
  );

  const result = await handle(recommendInput.parse({ context: "   " }));

  assert.equal(result.mode, "starter-pack-gap", "blank context is not a real ask");
  assert.equal(result.recommendations[0]?.id, "quick-review");
});

test("recommend_skills: explicit context suppresses the gap and searches the catalog", async (t) => {
  await withIsolatedOmakaseState(
    t,
    [
      starterEntry({ id: "grill-me", name: "Grill Me", description: "Plans.", tags: ["starter-pack", "planning"] }),
      starterEntry({
        id: "quick-review",
        name: "Quick Review",
        description: "Severity-tagged code review.",
        tags: ["starter-pack", "review"],
      }),
    ],
    ["grill-me"]
  );

  const result = await handle(recommendInput.parse({ context: "I need code review help" }));

  assert.equal(result.mode, "profile-search", "an explicit ask beats onboarding");
  assert.equal(result.recommendations[0]?.id, "quick-review");
});

test("recommend_skills: profile ranks which missing starter to surface", async (t) => {
  await withIsolatedOmakaseState(
    t,
    [
      starterEntry({ id: "grill-me", name: "Grill Me", description: "Plans.", tags: ["starter-pack", "planning"] }),
      starterEntry({
        id: "playwright",
        name: "Playwright",
        description: "Browser automation.",
        tags: ["starter-pack", "frontend", "browser"],
      }),
      starterEntry({
        id: "jupyter",
        name: "Jupyter",
        description: "Data notebooks.",
        tags: ["starter-pack", "python", "data"],
      }),
    ],
    ["grill-me"],
    { role: "frontend developer" }
  );

  // No explicit ask, but a profile is saved → gap still fires, and the profile
  // ranks the frontend-flavored missing staple ahead of the data one.
  const result = await handle(recommendInput.parse({}));

  assert.equal(result.mode, "starter-pack-gap");
  assert.equal(result.recommendations[0]?.id, "playwright", "profile steers the gap pick");
});

test("recommend_skills: explicit context outranks a strong profile match", async (t) => {
  await withIsolatedOmakaseState(
    t,
    [
      starterEntry({
        id: "playwright",
        name: "Playwright",
        description: "Browser automation and frontend testing.",
        tags: ["frontend", "browser", "testing"],
      }),
      starterEntry({
        id: "quick-review",
        name: "Quick Review",
        description: "Severity-tagged code review of any diff.",
        tags: ["code-review", "review", "diff"],
      }),
    ],
    ["seed-skill"], // returning user (non-empty install) so we reach profile-search
    { role: "frontend developer" }
  );

  // Profile (frontend) would pull Playwright; the explicit ask is about reviews.
  const result = await handle(recommendInput.parse({ context: "I keep doing code review by hand" }));

  assert.equal(result.mode, "profile-search");
  assert.equal(
    result.recommendations[0]?.id,
    "quick-review",
    "the explicit ask must beat the profile's frontend bias"
  );
});

async function withIsolatedOmakaseState(
  t: Parameters<typeof test>[1],
  entries: Entry[],
  installedSkillDirs: string[] = [],
  profile?: Record<string, unknown>
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "omakase-recommend-"));
  const originalCache = process.env["XDG_CACHE_HOME"];
  const originalConfig = process.env["XDG_CONFIG_HOME"];
  const originalData = process.env["XDG_DATA_HOME"];
  const originalSkills = process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
  const originalRemote = process.env["CLAUDE_OMAKASE_CATALOG_URL"];

  process.env["XDG_CACHE_HOME"] = join(root, "cache");
  process.env["XDG_CONFIG_HOME"] = join(root, "config");
  process.env["XDG_DATA_HOME"] = join(root, "data");
  process.env["CLAUDE_OMAKASE_SKILLS_DIR"] = join(root, "skills");
  delete process.env["CLAUDE_OMAKASE_CATALOG_URL"];

  for (const id of installedSkillDirs) {
    await mkdir(join(root, "skills", id), { recursive: true });
  }

  if (profile) {
    const profileDir = join(root, "config", "claude-omakase");
    await mkdir(profileDir, { recursive: true });
    await writeFile(join(profileDir, "profile.json"), JSON.stringify(profile), "utf8");
  }

  const catalogDir = join(root, "cache", "claude-omakase");
  await mkdir(catalogDir, { recursive: true });
  await writeFile(
    join(catalogDir, "catalog.json"),
    JSON.stringify(
      {
        version: 1,
        generated_at: "2026-05-31T00:00:00.000Z",
        entries,
      },
      null,
      2
    ),
    "utf8"
  );

  t.after(async () => {
    restoreEnv("XDG_CACHE_HOME", originalCache);
    restoreEnv("XDG_CONFIG_HOME", originalConfig);
    restoreEnv("XDG_DATA_HOME", originalData);
    restoreEnv("CLAUDE_OMAKASE_SKILLS_DIR", originalSkills);
    restoreEnv("CLAUDE_OMAKASE_CATALOG_URL", originalRemote);
    await rm(root, { recursive: true, force: true });
  });
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function starterEntry(params: {
  id: string;
  name: string;
  description: string;
  tags: string[];
}): Entry {
  return {
    id: params.id,
    name: params.name,
    type: "claude_code_skill",
    description: params.description,
    tags: params.tags,
    verified: true,
    author: { name: "Test" },
    install: {
      skill_files: [
        {
          source: `https://example.com/${params.id}/SKILL.md`,
          target: "SKILL.md",
        },
      ],
    },
    source: { adapter: "test" },
  };
}
