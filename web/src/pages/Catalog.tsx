import { useEffect, useState, useMemo } from "react";
import type { Entry } from "../types";
import { getCatalog, getInstalled, installSkill } from "../api";

const PAGE_SIZE = 24;

function Badge({
  children,
  color = "gray",
}: {
  children: React.ReactNode;
  color?: "gray" | "green" | "amber" | "indigo" | "blue";
}) {
  const cls = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-indigo-50 text-indigo-700",
    blue: "bg-blue-50 text-blue-700",
  }[color];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {children}
    </span>
  );
}

function SkillCard({
  entry,
  installed,
  onInstall,
  installing,
}: {
  entry: Entry;
  installed: boolean;
  onInstall: (id: string) => void;
  installing: boolean;
}) {
  const isStarterPack = entry.tags.includes("starter-pack");
  const visibleTags = entry.tags.filter((t) => t !== "starter-pack").slice(0, 3);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{entry.name}</h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {entry.verified && <Badge color="green">✓ verified</Badge>}
            {isStarterPack && <Badge color="amber">starter-pack</Badge>}
            {entry.category && <Badge color="blue">{entry.category}</Badge>}
          </div>
        </div>
        {installed ? (
          <span className="shrink-0 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-md">
            Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(entry.id)}
            disabled={installing}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {installing ? "Installing…" : "Install"}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
        {entry.description}
      </p>
      <div className="flex flex-wrap gap-1">
        {visibleTags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-auto">
        by {entry.author.name} · {entry.source.adapter}
      </p>
    </div>
  );
}

export default function Catalog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    Promise.all([getCatalog(), getInstalled()])
      .then(([cat, inst]) => {
        setEntries(cat.entries);
        const ids = new Set([
          ...inst.receipts.map((r) => r.id),
          ...inst.raw_skills_dir,
        ]);
        setInstalledIds(ids);
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.category ?? "").filter(Boolean))].sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (verifiedOnly && !e.verified) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        e.id.toLowerCase().includes(q)
      );
    });
  }, [entries, search, categoryFilter, verifiedOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  async function handleInstall(id: string) {
    setInstallingId(id);
    setToast(null);
    try {
      const result = await installSkill(id);
      setInstalledIds((prev) => new Set([...prev, id]));
      setToast({ msg: result.summary, ok: true });
    } catch (e: unknown) {
      setToast({ msg: String(e), ok: false });
    } finally {
      setInstallingId(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading catalog…
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

      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search skills…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => { setVerifiedOnly(e.target.checked); setPage(1); }}
            className="accent-indigo-600"
          />
          Verified only
        </label>
        <span className="text-sm text-gray-400 ml-auto">
          {filtered.length} skill{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((entry) => (
          <SkillCard
            key={entry.id}
            entry={entry}
            installed={installedIds.has(entry.id)}
            onInstall={handleInstall}
            installing={installingId === entry.id}
          />
        ))}
        {visible.length === 0 && (
          <div className="col-span-3 text-center text-gray-400 py-16">
            No skills match your search.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
