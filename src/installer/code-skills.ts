// Install/uninstall claude_code_skill (and, for now, claude_skill) entries by
// writing files into ~/.claude/skills/<id>/. Claude Code picks these up at the
// next launch.

import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { claudeCodeSkillsDir } from "../paths.js";
import type { Entry } from "../types.js";

// Bound each skill-file download so a slow or hostile source can't hang the
// install or exhaust memory.
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_SKILL_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB per file

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
      const buf = await downloadCapped(file.source);
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

// Download a skill file with a hard timeout and a size cap, so a hung endpoint
// can't stall the install and a hostile/huge body can't exhaust memory. Reads the
// body incrementally and aborts the moment it exceeds the cap.
async function downloadCapped(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status}`);
  }
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_SKILL_FILE_BYTES) {
    throw new Error(`skill file too large (${declared} bytes > ${MAX_SKILL_FILE_BYTES}): ${url}`);
  }
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_SKILL_FILE_BYTES) {
      throw new Error(`skill file too large (> ${MAX_SKILL_FILE_BYTES} bytes): ${url}`);
    }
    return buf;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_SKILL_FILE_BYTES) {
        await reader.cancel();
        throw new Error(`skill file too large (> ${MAX_SKILL_FILE_BYTES} bytes): ${url}`);
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

// A skill id becomes a path segment under ~/.claude/skills/ and is fed to
// mkdir/rm. A scraped or remote-overridden catalog can carry a hostile id, so
// reject anything that could escape the skills root before it reaches the
// filesystem: absolute paths, backslashes, and any empty / "." / ".." path
// segment. The "." case is the dangerous one — join(root, ".") === root, so an
// id of "." would make uninstall(".") delete the ENTIRE skills directory.
// install-skill/update-skill don't validate the id themselves, so this is the
// single choke point.
// True when `id` is safe to use as a path under the skills root. Rejects
// absolute paths, backslashes, and any empty / "." / ".." segment. Exported so
// every destructive entry point (install, uninstall, and the uninstall_skill
// MCP tool) shares ONE definition instead of drifting copies — the "." case
// once slipped through a duplicate validator and could delete the whole root.
export function isSafeId(id: string): boolean {
  const segments = id.split("/");
  return (
    id.length > 0 &&
    !id.startsWith("/") &&
    !id.includes("\\") &&
    !segments.some((s) => s === "" || s === "." || s === "..")
  );
}

function assertSafeId(id: string): void {
  if (!isSafeId(id)) {
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
