// Install/uninstall claude_code_skill (and, for now, claude_skill) entries by
// writing files into ~/.claude/skills/<id>/. Claude Code picks these up at the
// next launch.

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { claudeCodeSkillsDir } from "../paths.js";
import type { Entry } from "../types.js";

export async function install(
  entry: Entry,
  options: { force?: boolean } = {}
): Promise<{ skillDir: string }> {
  const root = claudeCodeSkillsDir();
  const dest = join(root, entry.id);
  if (existsSync(dest)) {
    if (!options.force) {
      throw new Error(
        `skill "${entry.id}" already exists at ${dest}; pass force: true to replace it`
      );
    }
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(dest, { recursive: true });

  if (!entry.install.skill_files || entry.install.skill_files.length === 0) {
    // Adapter didn't ship file URLs. Write a minimal SKILL.md stub so the
    // user knows where the skill landed and can replace it.
    const stub = `---
name: ${entry.id}
description: ${entry.description}
---

# ${entry.name}

This skill was registered by Claude Omakase but the catalog entry did not
include explicit \`install.skill_files\`. Replace this file with the real
SKILL.md content from the upstream source:

  ${entry.homepage ?? "(no homepage on record)"}

— source adapter: ${entry.source.adapter}
`;
    await writeFile(join(dest, "SKILL.md"), stub, "utf8");
    return { skillDir: dest };
  }

  for (const file of entry.install.skill_files) {
    if (!isSafeRelative(file.target)) {
      throw new Error(`unsafe skill target path: ${file.target}`);
    }
    if (!file.source.startsWith("https://")) {
      throw new Error(`skill source must be https://: ${file.source}`);
    }
    const target = join(dest, file.target);
    mkdirSync(dirname(target), { recursive: true });
    const res = await fetch(file.source);
    if (!res.ok) {
      throw new Error(`fetch ${file.source} failed: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(target, buf);
  }

  return { skillDir: dest };
}

export function uninstall(id: string): void {
  const dir = join(claudeCodeSkillsDir(), id);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function isSafeRelative(p: string): boolean {
  return (
    p.length > 0 &&
    !p.startsWith("/") &&
    !p.includes("\\") &&
    !p.split("/").includes("..")
  );
}
