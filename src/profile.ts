// User profile — role, languages, usecases. Used by recommend_skills.
// Stored locally only. No telemetry.

import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { omakaseConfigDir, profilePath } from "./paths.js";
import type { Profile } from "./types.js";

export async function load(): Promise<Profile> {
  const path = profilePath();
  if (!existsSync(path)) return {};
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as Profile;
  } catch {
    return {};
  }
}

export async function save(profile: Profile): Promise<void> {
  const dir = omakaseConfigDir();
  mkdirSync(dir, { recursive: true });
  const next: Profile = { ...profile, updated_at: new Date().toISOString() };
  // Atomic write: a crash mid-write must not truncate profile.json (which load()
  // would silently swallow as {}, resetting the user's role/languages).
  const finalPath = profilePath();
  const tmp = join(dir, `.profile.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(tmp, JSON.stringify(next, null, 2) + "\n", "utf8");
    renameSync(tmp, finalPath);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
