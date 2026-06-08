// Catalog Entry — the unit federated adapters produce and the MCP serves.
// Kept intentionally small. Adapter-specific metadata goes in `source`.

export type EntryKind = "claude_skill" | "claude_code_skill";

// Provenance trust of the source an entry came from. Distinct from `verified`,
// which means a HUMAN audited the entry (handpicked overlay). `source_trust:
// "official"` means the entry came from an official/first-party source (e.g. the
// Anthropic MCP reference repo) but was NOT human-audited. Undefined = community.
// See docs/adr/0003-source-trust-vs-verified.md.
export type SourceTrust = "official" | "community";

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
  // Legacy field kept for adapters that still emit it. Skills are installed
  // entirely from `skill_files`; the MCP server does not execute `command`.
  command?: string;
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

export interface Audit {
  audited_by?: string;
  audited_at?: string;
  checks?: string[];
}

export interface Entry {
  id: string;
  name: string;
  type: EntryKind;
  description: string;
  category?: string;
  tags: string[];
  verified: boolean;
  source_trust?: SourceTrust;
  author: { name: string; url?: string };
  homepage?: string;
  version?: string;
  license?: string;
  i18n?: Record<string, { name?: string; description?: string }>;
  install: Install;
  requirements?: string[];
  source: Source;
  audit?: Audit;
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
