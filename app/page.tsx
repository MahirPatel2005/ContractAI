"use client";

import { useEffect, useState } from "react";
import { Navbar, type ActiveTab } from "@/components/Navbar";
import { DocumentLibrary, type DocumentRow } from "@/components/DocumentLibrary";
import { DocumentViewer, type ActiveCitation } from "@/components/DocumentViewer";
import { ChatPanel } from "@/components/ChatPanel";
import { ContractComparison } from "@/components/ContractComparison";
import { MultiDocumentChat } from "@/components/MultiDocumentChat";
import { RedlinePanel } from "@/components/RedlinePanel";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("library");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentRow | null>(null);
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | null>(null);

  // Comparison preselection
  const [compareDocA, setCompareDocA] = useState<string | null>(null);
  const [compareDocB, setCompareDocB] = useState<string | null>(null);

  // Multi-doc preselection
  const [multiDocIds, setMultiDocIds] = useState<string[]>([]);

  // Fetch document list periodically or when switching tabs
  const refreshDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data.documents);
        // If active document was set, update it from fresh list
        if (activeDoc) {
          const fresh = json.data.documents.find((d: DocumentRow) => d.id === activeDoc.id);
          if (fresh) setActiveDoc(fresh);
        }
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    refreshDocuments();
  }, [activeTab]);

  function handleOpenWorkspace(doc: DocumentRow) {
    setActiveDoc(doc);
    setActiveCitation(null);
    setActiveTab("workspace");
  }

  function handleCompareDocs(docAId: string, docBId: string) {
    setCompareDocA(docAId);
    setCompareDocB(docBId);
    setActiveTab("compare");
  }

  function handleMultiDocQ(docIds: string[]) {
    setMultiDocIds(docIds);
    setActiveTab("multidoc");
  }

  function handleRedlineDoc(doc: DocumentRow) {
    setActiveDoc(doc);
    setActiveTab("redline");
  }

  const readyDocuments = documents.filter((d) => d.status === "ready");

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100/70 text-zinc-900 font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDocName={activeDoc?.name || null}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* TAB 1: DOCUMENT LIBRARY */}
        {activeTab === "library" && (
          <DocumentLibrary
            onOpenWorkspace={handleOpenWorkspace}
            onCompareDocs={handleCompareDocs}
            onMultiDocQ={handleMultiDocQ}
            onRedlineDoc={handleRedlineDoc}
          />
        )}

        {/* TAB 2: DOCUMENT WORKSPACE (SPLIT VIEW: VIEWER + CHAT / AGENT) */}
        {activeTab === "workspace" && (
          <div className="h-[calc(100vh-130px)] min-h-[600px] flex flex-col space-y-3">
            {/* Active Document Selector Bar */}
            <div className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-zinc-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Active Document:
                </span>
                {readyDocuments.length > 0 ? (
                  <select
                    value={activeDoc?.id || ""}
                    onChange={(e) => {
                      const selected = readyDocuments.find((d) => d.id === e.target.value);
                      if (selected) {
                        setActiveDoc(selected);
                        setActiveCitation(null);
                      }
                    }}
                    className="text-xs font-semibold rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                  >
                    {!activeDoc && <option value="">Select a contract to review…</option>}
                    {readyDocuments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.pageCount} pages)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-amber-700">No ready documents. Please upload one first.</span>
                )}
              </div>

              {activeDoc && (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="uppercase font-mono bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                    {activeDoc.type}
                  </span>
                  <span>{activeDoc.pageCount} pages</span>
                </div>
              )}
            </div>

            {/* Split Screen Panes */}
            {activeDoc ? (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
                {/* Left Pane: Interactive Document Viewer with Coordinate Highlighting */}
                <div className="lg:col-span-7 h-full overflow-hidden">
                  <DocumentViewer
                    documentId={activeDoc.id}
                    activeCitation={activeCitation}
                    onClearCitation={() => setActiveCitation(null)}
                  />
                </div>

                {/* Right Pane: AI Chat, Verification Cards & Part C Agent Research */}
                <div className="lg:col-span-5 h-full overflow-hidden">
                  <ChatPanel
                    documentId={activeDoc.id}
                    documentName={activeDoc.name}
                    onSelectCitation={(cit) => setActiveCitation(cit)}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-white p-12 text-center">
                <span className="text-4xl mb-3">📄</span>
                <h3 className="text-base font-semibold text-zinc-900">Select a contract to open in workspace</h3>
                <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                  Choose a contract from your library to inspect pages, ask questions with verified citations, and launch agentic research.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("library")}
                  className="mt-4 rounded-lg bg-indigo-900 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 transition cursor-pointer"
                >
                  Go to Document Library
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONTRACT COMPARISON */}
        {activeTab === "compare" && (
          <ContractComparison
            documents={documents}
            initialLeftId={compareDocA}
            initialRightId={compareDocB}
          />
        )}

        {/* TAB 4: TRACKED-CHANGE REDLINING (PART C OPTION 1) */}
        {activeTab === "redline" && (
          <RedlinePanel
            documents={documents}
            initialDocumentId={activeDoc?.id || null}
          />
        )}

        {/* TAB 5: MULTI-DOCUMENT ANALYSIS */}
        {activeTab === "multidoc" && (
          <MultiDocumentChat
            documents={documents}
            preselectedIds={multiDocIds}
          />
        )}
      </main>
    </div>
  );
}
