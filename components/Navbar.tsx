"use client";

export type ActiveTab = "library" | "workspace" | "compare" | "redline" | "multidoc";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeDocName: string | null;
}

export function Navbar({ activeTab, setActiveTab, activeDocName }: NavbarProps) {
  return (
    <header className="border-b border-zinc-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab("library")}>
            <div className="h-8 w-8 rounded-lg bg-indigo-900 flex items-center justify-center text-white font-bold text-base shadow-sm">
              C
            </div>
            <div>
              <span className="text-lg font-bold text-indigo-950 tracking-tight">ContractAI</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Legal Intelligence
              </span>
            </div>
          </div>

          <nav className="flex items-center space-x-1" aria-label="Main Navigation">
            <button
              type="button"
              onClick={() => setActiveTab("library")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "library"
                  ? "bg-zinc-100 text-zinc-900 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              📁 Library
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("workspace")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "workspace"
                  ? "bg-indigo-50 text-indigo-950 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              <span>📄 Workspace</span>
              {activeDocName && (
                <span className="text-xs max-w-[120px] truncate text-indigo-700 font-normal bg-indigo-100/60 px-1.5 py-0.5 rounded">
                  {activeDocName}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "compare"
                  ? "bg-indigo-50 text-indigo-950 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              ⚖️ Comparison
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("redline")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "redline"
                  ? "bg-indigo-50 text-indigo-950 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              <span>✏️ Redlining</span>
              <span className="bg-indigo-900 text-white text-[10px] px-1 rounded font-bold">Part C</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("multidoc")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "multidoc"
                  ? "bg-indigo-50 text-indigo-950 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              🌐 Multi-Doc
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            Independent Quote Verification Active
          </span>
        </div>
      </div>
    </header>
  );
}
