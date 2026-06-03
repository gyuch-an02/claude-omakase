import { useState } from "react";
import Catalog from "./pages/Catalog";
import Installed from "./pages/Installed";
import Recommend from "./pages/Recommend";
import Profile from "./pages/Profile";

type Tab = "catalog" | "installed" | "recommend" | "profile";

const tabs: { id: Tab; label: string }[] = [
  { id: "catalog", label: "Catalog" },
  { id: "installed", label: "Installed" },
  { id: "recommend", label: "Recommend" },
  { id: "profile", label: "Profile" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("catalog");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-8">
          <span className="font-bold text-gray-900 text-lg whitespace-nowrap">
            🍱 Claude Omakase
          </span>
          <nav className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "catalog" && <Catalog />}
        {tab === "installed" && <Installed />}
        {tab === "recommend" && <Recommend />}
        {tab === "profile" && <Profile />}
      </main>
    </div>
  );
}
