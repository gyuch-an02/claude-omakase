import { useEffect, useState } from "react";
import type { InstalledResult, DoctorResult, SkillHealth } from "../types";
import { getInstalled, getDoctorResults, uninstallSkill, updateSkill } from "../api";

function HealthBadge({ health }: { health: SkillHealth }) {
  const ok = health.skill_md_exists && health.receipt_exists && health.in_catalog;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {ok ? "healthy" : "issues"}
    </span>
  );
}

export default function Installed() {
  const [installed, setInstalled] = useState<InstalledResult | null>(null);
  const [doctor, setDoctor] = useState<DoctorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showDoctor, setShowDoctor] = useState(false);

  async function load() {
    try {
      const [inst, doc] = await Promise.all([getInstalled(), getDoctorResults()]);
      setInstalled(inst);
      setDoctor(doc);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleUninstall(id: string) {
    setActionId(id);
    try {
      await uninstallSkill(id);
      showToast(`Uninstalled ${id}`, true);
      await load();
    } catch (e: unknown) {
      showToast(String(e), false);
    } finally {
      setActionId(null);
    }
  }

  async function handleUpdate(id: string) {
    setActionId(id);
    try {
      const r = await updateSkill(id);
      showToast(r.message, true);
    } catch (e: unknown) {
      showToast(String(e), false);
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  const receipts = installed?.receipts ?? [];
  const rawOnly = (installed?.raw_skills_dir ?? []).filter(
    (id) => !receipts.find((r) => r.id === id)
  );

  const healthMap = new Map(doctor?.skills.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            toast.ok
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Installed Skills
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({installed?.installed_count ?? 0})
          </span>
        </h2>
        {doctor && (
          <button
            onClick={() => setShowDoctor((v) => !v)}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
              doctor.issues > 0
                ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                : "border-green-200 text-green-700 hover:bg-green-50"
            }`}
          >
            {doctor.issues > 0 ? `⚠ ${doctor.issues} issue(s)` : "✓ All healthy"}{" "}
            {showDoctor ? "▲" : "▼"}
          </button>
        )}
      </div>

      {showDoctor && doctor && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-gray-700 mb-3">{doctor.summary}</p>
          <div className="space-y-2">
            {doctor.skills.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-gray-600">
                <HealthBadge health={s} />
                <span className="font-mono text-xs">{s.id}</span>
                {!s.skill_md_exists && (
                  <span className="text-amber-600 text-xs">missing SKILL.md</span>
                )}
                {!s.receipt_exists && (
                  <span className="text-amber-600 text-xs">missing receipt</span>
                )}
                {!s.in_catalog && (
                  <span className="text-gray-400 text-xs">not in catalog</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {receipts.length === 0 && rawOnly.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          No skills installed yet. Browse the Catalog to install some.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {receipts.map((r) => {
            const health = healthMap.get(r.id);
            const busy = actionId === r.id;
            return (
              <div
                key={r.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">
                      {r.entry_snapshot.name}
                    </h3>
                    {health && <HealthBadge health={health} />}
                    {r.entry_snapshot.verified && (
                      <span className="text-xs text-green-600 font-medium">✓ verified</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                    {r.entry_snapshot.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Installed{" "}
                    {new Date(r.installed_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {r.skill_dir && (
                      <span className="ml-2 font-mono">{r.skill_dir}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.entry_snapshot.install.skill_files && (
                    <button
                      onClick={() => handleUpdate(r.id)}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
                    >
                      {busy ? "…" : "Update"}
                    </button>
                  )}
                  <button
                    onClick={() => handleUninstall(r.id)}
                    disabled={busy}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-40"
                  >
                    {busy ? "…" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}

          {rawOnly.map((id) => (
            <div
              key={id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 font-mono text-sm">{id}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Installed externally (no receipt)
                </p>
              </div>
              <button
                onClick={() => handleUninstall(id)}
                disabled={actionId === id}
                className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-40 shrink-0"
              >
                {actionId === id ? "…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
