// Catalog Entry — the unit federated adapters produce and the MCP serves.
// Kept intentionally small. Adapter-specific metadata goes in `source`.

export type EntryKind = "claude_skill" | "claude_code_skill";

export type UserParamType =
  | "directory_picker"
  | "file_picker"
  | "text"
  | "password"
  | "select";

export interface UserParam {
  key: string;
  label: string;
  type: UserParamType;
  required?: boolean;
  default?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface SkillFile {
  source: string; // https URL
  target: string; // relative path under ~/.claude/skills/<id>/
}

export interface Install {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  user_params?: UserParam[];
  skill_files?: SkillFile[];
}

export interface Source {
  adapter: string; // e.g. "handpicked", "anthropic-skills-repo"
  origin?: string; // e.g. GitHub raw URL the entry was derived from
  fetched_at?: string; // ISO 8601
}

export interface Entry {
  id: string;
  name: string;
  type: EntryKind;
  description: string;
  category?: string;
  tags: string[];
  verified: boolean;
  author: { name: string; url?: string };
  homepage?: string;
  version?: string;
  license?: string;
  i18n?: Record<string, { name?: string; description?: string }>;
  install: Install;
  requirements?: string[];
  source: Source;
}

export interface Catalog {
  version: number;
  generated_at: string;
  entries: Entry[];
}

export interface InstalledRecord {
  id: string;
  kind: EntryKind;
  installed_at: string;
  source_version?: string;
  skill_dir?: string;
  entry_snapshot: Entry;
}

export interface Profile {
  role?: string;
  occupation?: string;
  languages?: string[];
  ides?: string[];
  tools?: string[];
  usecases?: string[];
  updated_at?: string;
}

export interface Environment {
  platform: "darwin" | "win32" | "linux";
  claude_code_dir: string | null;
  claude_code_present: boolean;
}
