import type {
  Entry,
  InstalledResult,
  DoctorResult,
  RecommendResult,
  Profile,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json() as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export async function getCatalog(): Promise<{ entries: Entry[] }> {
  return request("/api/catalog");
}

export async function getInstalled(): Promise<InstalledResult> {
  return request("/api/skills/installed");
}

export async function installSkill(
  id: string,
  force = false
): Promise<{ ok: boolean; summary: string; id: string }> {
  return request("/api/skills/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, force }),
  });
}

export async function uninstallSkill(
  id: string
): Promise<{ ok: boolean; id: string }> {
  return request(`/api/skills/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateSkill(
  id: string
): Promise<{ ok: boolean; message: string }> {
  return request(`/api/skills/${encodeURIComponent(id)}/update`, { method: "POST" });
}

export async function getDoctorResults(): Promise<DoctorResult> {
  return request("/api/skills/doctor");
}

export async function getRecommendations(
  context?: string,
  limit?: number
): Promise<RecommendResult> {
  const params = new URLSearchParams();
  if (context) params.set("context", context);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return request(`/api/recommend${qs ? `?${qs}` : ""}`);
}

export async function getProfile(): Promise<Profile> {
  return request("/api/profile");
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  return request("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}
