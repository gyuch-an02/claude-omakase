import { useState } from "react";
import type { RecommendResult, Recommendation } from "../types";
import { getRecommendations, installSkill } from "../api";

function ModeLabel({ mode }: { mode: RecommendResult["mode"] }) {
  const map: Record<RecommendResult["mode"], { label: string; cls: string }> = {
    "starter-pack": { label: "Starter Pack", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    "starter-pack-gap": { label: "Starter Pack Gap", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    "verified-defaults": { label: "Verified Defaults", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    "profile-search": { label: "Profile Match", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  };
  const { label, cls } = map[mode];
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function RecommendCard({
  rec,
  onInstall,
  installing,
  installed,
}: {
  rec: Recommendation;
  onInstall: (id: string) => void;
  installing: boolean;
  installed: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{rec.name}</h3>
            {rec.verified && (
              <span className="text-xs text-green-600 font-medium">✓ verified</span>
            )}
          </div>
          {rec.match_score !== undefined && (
            <p className="text-xs text-indigo-600 mt-0.5">
              Score: {(rec.match_score * 100).toFixed(0)}%
              {rec.match_reasons && rec.match_reasons.length > 0 && (
                <span className="text-gray-400"> · {rec.match_reasons.join(", ")}</span>
              )}
            </p>
          )}
        </div>
        {installed ? (
          <span className="shrink-0 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-md">
            Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(rec.id)}
            disabled={installing}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {installing ? "Installing…" : "Install"}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{rec.description}</p>
      <div className="flex flex-wrap gap-1">
        {rec.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Recommend() {
  const [context, setContext] = useState("");
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await getRecommendations(context || undefined, 6);
      setResult(res);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleInstall(id: string) {
    setInstallingId(id);
    setToast(null);
    try {
      const r = await installSkill(id);
      setInstalledIds((prev) => new Set([...prev, id]));
      setToast({ msg: r.summary, ok: true });
    } catch (e: unknown) {
      setToast({ msg: String(e), ok: false });
    } finally {
      setInstallingId(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Get Recommendations
        </h2>
        <p className="text-sm text-gray-500">
          Describe what you're working on and we'll suggest the best skill for you.
          Leave blank for defaults based on your profile.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. I keep writing the same SQL queries to analyze logs, or I want help reviewing PRs faster…"
          rows={3}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="self-start px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Searching…" : "Get Recommendations"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

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

      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <ModeLabel mode={result.mode} />
            {result.onboarding_message && (
              <p className="text-sm text-gray-600">{result.onboarding_message}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {result.recommendations.map((rec) => (
              <RecommendCard
                key={rec.id}
                rec={rec}
                onInstall={handleInstall}
                installing={installingId === rec.id}
                installed={installedIds.has(rec.id)}
              />
            ))}
            {result.recommendations.length === 0 && (
              <p className="text-gray-400 col-span-2 text-sm">
                No recommendations found. Try updating your profile or searching the catalog.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
