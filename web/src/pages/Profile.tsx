import { useEffect, useState, KeyboardEvent } from "react";
import type { Profile } from "../types";
import { getProfile, saveProfile } from "../api";

function TagInput({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && input === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="border border-gray-300 rounded-lg px-3 py-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-indigo-400 min-h-[42px]">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="hover:text-indigo-900 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={add}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-24 text-sm outline-none bg-transparent"
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Press Enter to add</p>
    </div>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const saved = await saveProfile(profile);
      setProfile(saved);
      setToast({ msg: "Profile saved.", ok: true });
    } catch (e: unknown) {
      setToast({ msg: String(e), ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Profile</h2>
        <p className="text-sm text-gray-500">
          Stored locally. Used to personalise skill recommendations.
        </p>
      </div>

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

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <input
              type="text"
              value={profile.role ?? ""}
              onChange={(e) => set("role", e.target.value || undefined)}
              placeholder="e.g. software engineer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Occupation
            </label>
            <input
              type="text"
              value={profile.occupation ?? ""}
              onChange={(e) => set("occupation", e.target.value || undefined)}
              placeholder="e.g. backend developer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <TagInput
          label="Programming Languages"
          values={profile.languages ?? []}
          placeholder="e.g. TypeScript, Python…"
          onChange={(v) => set("languages", v.length ? v : undefined)}
        />

        <TagInput
          label="IDEs / Editors"
          values={profile.ides ?? []}
          placeholder="e.g. VS Code, Neovim…"
          onChange={(v) => set("ides", v.length ? v : undefined)}
        />

        <TagInput
          label="Tools & Frameworks"
          values={profile.tools ?? []}
          placeholder="e.g. React, Docker, Postgres…"
          onChange={(v) => set("tools", v.length ? v : undefined)}
        />

        <TagInput
          label="Use Cases"
          values={profile.usecases ?? []}
          placeholder="e.g. code review, documentation, debugging…"
          onChange={(v) => set("usecases", v.length ? v : undefined)}
        />

        {profile.updated_at && (
          <p className="text-xs text-gray-400">
            Last saved:{" "}
            {new Date(profile.updated_at).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
