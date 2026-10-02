"use client";

import {
  FolderIcon,
  FileTextIcon,
  ScaleIcon,
  EditIcon,
  LayersIcon,
  ShieldCheckIcon,
} from "./Icons";

export type ActiveTab = "library" | "workspace" | "compare" | "redline" | "multidoc";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeDocName: string | null;
}

export function Navbar({ activeTab, setActiveTab, activeDocName }: NavbarProps) {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-6">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setActiveTab("library")}
          >
            <div className="h-8 w-8 rounded-md bg-slate-900 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-xs">
              CA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-950 tracking-tight uppercase">
                  ContractAI
                </span>
                <span className="text-[10px] font-semibold tracking-wider text-slate-600 uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Legal Intelligence
                </span>
              </div>
            </div>
          </div>

          <nav className="flex items-center space-x-1" aria-label="Main Navigation">
            <button
              type="button"
              onClick={() => setActiveTab("library")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "library"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              <FolderIcon className="w-3.5 h-3.5" />
              <span>Document Library</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("workspace")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "workspace"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              <FileTextIcon className="w-3.5 h-3.5" />
              <span>Workspace</span>
              {activeDocName && (
                <span className="text-[11px] max-w-[130px] truncate text-slate-300 font-normal lowercase bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  {activeDocName}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "compare"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              <ScaleIcon className="w-3.5 h-3.5" />
              <span>Comparison</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("redline")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "redline"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              <EditIcon className="w-3.5 h-3.5" />
              <span>Redlining</span>
              <span className="bg-slate-700 text-slate-200 text-[9px] px-1 rounded font-bold">
                DOCX
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("multidoc")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                activeTab === "multidoc"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              <LayersIcon className="w-3.5 h-3.5" />
              <span>Cross-Contract</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero-Trust Verification Active</span>
          </span>
        </div>
      </div>
    </header>
  );
}
