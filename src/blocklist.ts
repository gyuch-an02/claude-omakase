// Skills the user explicitly told us to stop recommending ("never recommend
// again"). Persisted locally so the choice survives across sessions. Both
// find_skill and recommend_skills exclude these ids.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { omakaseStateDir } from "./paths.js";

function file(): string {
  return join(omakaseStateDir(), "declined.json");
}

/** Set of skill ids the user has permanently declined. */
export function load(): Set<string> {
  try {
    const data = JSON.parse(readFileSync(file(), "utf8"));
    return new Set(Array.isArray(data.declined) ? data.declined : []);
  } catch {
    return new Set();
  }
}

export function has(id: string): boolean {
  return load().has(id);
}

/** Add an id to the permanent declined list (idempotent). */
export function add(id: string): void {
  const set = load();
  if (set.has(id)) return;
  set.add(id);
  const dir = omakaseStateDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file(), JSON.stringify({ declined: [...set] }, null, 2) + "\n", "utf8");
}
