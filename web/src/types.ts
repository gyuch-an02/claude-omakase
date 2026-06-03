export type EntryKind = "claude_skill" | "claude_code_skill";

export interface SkillFile {
  source: string;
  target: string;
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
  install: { skill_files?: SkillFile[] };
  source: { adapter: string };
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

export interface InstalledRecord {
  id: string;
  kind: EntryKind;
  installed_at: string;
  source_version?: string;
  skill_dir?: string;
  entry_snapshot: Entry;
}

export interface InstalledResult {
  receipts: InstalledRecord[];
  raw_skills_dir: string[];
  installed_count: number;
}

export interface SkillHealth {
  id: string;
  skill_dir: string;
  skill_md_exists: boolean;
  receipt_exists: boolean;
  in_catalog: boolean;
  catalog_version?: string;
  installed_version?: string;
}

export interface DoctorResult {
  total: number;
  healthy: number;
  issues: number;
  skills: SkillHealth[];
  summary: string;
}

export interface Recommendation {
  id: string;
  name: string;
  type: EntryKind;
  description: string;
  tags: string[];
  verified: boolean;
  match_score?: number;
  match_reasons?: string[];
}

export interface RecommendResult {
  mode: "starter-pack" | "starter-pack-gap" | "verified-defaults" | "profile-search";
  present_as?: "checklist";
  recommendations: Recommendation[];
  profile_summary?: Profile;
  onboarding_message?: string;
  next_step?: string;
}
