const INTERNAL_SKILL_IDS = new Set(["omakase-chef"]);

export function isInternalSkillId(id: string): boolean {
  return INTERNAL_SKILL_IDS.has(id);
}
