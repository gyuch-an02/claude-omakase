// Install/uninstall claude_code_skill (and, for now, claude_skill) entries by
// writing files into ~/.claude/skills/<id>/. Claude Code picks these up at the
// next launch.

import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { claudeCodeSkillsDir } from "../paths.js";
import type { Entry } from "../types.js";

export async function install(
  entry: Entry,
  options: { force?: boolean } = {}
): Promise<{ skillDir: string }> {
  assertSafeId(entry.id);
  const root = claudeCodeSkillsDir();
  const dest = join(root, entry.id);
  if (existsSync(dest)) {
    if (!options.force) {
      throw new Error(
        `skill "${entry.id}" already exists at ${dest}; pass force: true to replace it`
      );
    }
  }
  mkdirSync(root, { recursive: true });
  const stage = mkdtempSync(join(root, `.tmp-${safeTempPrefix(entry.id)}-`));

  try {
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
      await writeFile(join(stage, "SKILL.md"), stub, "utf8");
      commitStage(stage, dest, Boolean(options.force));
      return { skillDir: dest };
    }

    for (const file of entry.install.skill_files) {
      if (!isSafeRelative(file.target)) {
        throw new Error(`unsafe skill target path: ${file.target}`);
      }
      if (!file.source.startsWith("https://")) {
        throw new Error(`skill source must be https://: ${file.source}`);
      }
      const target = join(stage, file.target);
      mkdirSync(dirname(target), { recursive: true });
      const res = await fetch(file.source);
      if (!res.ok) {
        throw new Error(`fetch ${file.source} failed: ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(target, buf);
    }

    commitStage(stage, dest, Boolean(options.force));
    return { skillDir: dest };
  } catch (e) {
    rmSync(stage, { recursive: true, force: true });
    throw e;
  }
}

export function uninstall(id: string): void {
  assertSafeId(id);
  const dir = join(claudeCodeSkillsDir(), id);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

// A skill id becomes a path segment under ~/.claude/skills/ and is fed to
// mkdir/rm. A scraped or remote-overridden catalog can carry a hostile id, so
// reject anything that could escape the skills root (absolute, backslash, or a
// ".." segment) before it reaches the filesystem. install-skill/update-skill
// don't validate the id themselves, so this is the single choke point.
function assertSafeId(id: string): void {
  if (
    id.length === 0 ||
    id.startsWith("/") ||
    id.includes("\\") ||
    id.split("/").includes("..")
  ) {
    throw new Error(`unsafe skill id: ${JSON.stringify(id)}`);
  }
}

function isSafeRelative(p: string): boolean {
  return (
    p.length > 0 &&
    !p.startsWith("/") &&
    !p.includes("\\") &&
    !p.split("/").includes("..")
  );
}

function commitStage(stage: string, dest: string, force: boolean): void {
  if (!force || !existsSync(dest)) {
    renameSync(stage, dest);
    return;
  }
  // Force-replace without a destructive window. The previous code did
  // `rmSync(dest); renameSync(stage, dest)`, which deletes the working install
  // BEFORE the new one is in place — if that rename then fails (permissions,
  // EXDEV, a crash in between) the user is left with no skill at all, defeating
  // the staged-install guarantee. Instead, move the old install aside first,
  // swap in the staged copy, then drop the backup; on failure, restore it. The
  // backup is dot-prefixed so the installed-skill listing ignores it.
  const backup = join(dirname(dest), `.bak-${basename(dest)}-${process.pid}-${Date.now()}`);
  renameSync(dest, backup);
  try {
    renameSync(stage, dest);
  } catch (e) {
    renameSync(backup, dest);
    throw e;
  }
  rmSync(backup, { recursive: true, force: true });
}

function safeTempPrefix(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 40) || "skill";
}
