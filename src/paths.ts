// Claude Code skills always live at ~/.claude/skills/ on all platforms.

import { homedir, platform } from "node:os";
import { join } from "node:path";

export type Platform = "darwin" | "win32" | "linux";

export function currentPlatform(): Platform {
  const p = platform();
  if (p === "darwin" || p === "win32" || p === "linux") return p;
  throw new Error(`unsupported platform: ${p}`);
}

export function claudeCodeSkillsDir(): string {
  if (process.env["CLAUDE_OMAKASE_SKILLS_DIR"]) {
    return process.env["CLAUDE_OMAKASE_SKILLS_DIR"];
  }
  return join(homedir(), ".claude", "skills");
}

export function omakaseStateDir(): string {
  const base =
    process.env["XDG_DATA_HOME"] ?? join(homedir(), ".local", "share");
  return join(base, "claude-omakase");
}

export function omakaseConfigDir(): string {
  const base =
    process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config");
  return join(base, "claude-omakase");
}

export function omakaseCacheDir(): string {
  const base = process.env["XDG_CACHE_HOME"] ?? join(homedir(), ".cache");
  return join(base, "claude-omakase");
}

export function installedRecordsDir(): string {
  return join(omakaseStateDir(), "installed");
}

export function profilePath(): string {
  return join(omakaseConfigDir(), "profile.json");
}

export function observationsPath(): string {
  // Patterns Claude detects via the omakase-chef SKILL.md. Rolling window.
  return join(omakaseStateDir(), "observations.jsonl");
}

export function bundledCatalogPath(): string {
  // catalog.json bundled into the npm package, used as offline fallback.
  // Built by scripts/build-catalog.mjs into the package root.
  return new URL("../catalog.json", import.meta.url).pathname;
}

export function packageTemplatesDir(): string {
  return new URL("../templates", import.meta.url).pathname;
}
