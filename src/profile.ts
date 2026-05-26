// User profile — role, languages, usecases. Used by recommend_skills.
// Stored locally only. No telemetry.

import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
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
  mkdirSync(omakaseConfigDir(), { recursive: true });
  const next: Profile = { ...profile, updated_at: new Date().toISOString() };
  await writeFile(profilePath(), JSON.stringify(next, null, 2) + "\n", "utf8");
}
