"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentUpload } from "./DocumentUpload";

export type Status = "queued" | "extracting" | "ocr" | "chunking" | "indexing" | "ready" | "failed";

export interface DocumentRow {
  id: string;
  name: string;
  type: string;
  status: Status;
  statusMessage: string | null;
  pageCount: number | null;
  createdAt: string;
}

const IN_PROGRESS: Status[] = ["queued", "extracting", "ocr", "chunking", "indexing"];

const PROGRESS_TEXT: Record<Exclude<Status, "ready" | "failed">, string> = {
  queued: "Waiting to start…",
  extracting: "Extracting document text…",
  ocr: "Checking whether the scan can be read…",
  chunking: "Preparing document for citation search…",
  indexing: "Indexing clauses…",
};

interface DocumentLibraryProps {
  onOpenWorkspace: (doc: DocumentRow) => void;
  onCompareDocs: (doc1Id: string, doc2Id: string) => void;
  onMultiDocQ: (docIds: string[]) => void;
  onRedlineDoc?: (doc: DocumentRow) => void;
}

export function DocumentLibrary({ onOpenWorkspace, onCompareDocs, onMultiDocQ, onRedlineDoc }: DocumentLibraryProps) {
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error();
      setDocuments(json.data.documents);
      setError(null);
    } catch {
      setError("We could not load your documents. Check your connection and refresh.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll only while something is still processing.
  const hasActive = documents?.some((d) => IN_PROGRESS.includes(d.status)) ?? false;
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [hasActive, load]);

  async function remove(doc: DocumentRow) {
    if (!window.confirm(`Delete "${doc.name}" and all associated chats and citations? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSelectedIds((prev) => prev.filter((id) => id !== doc.id));
      await load();
    } catch {
      setError("We could not delete that document. Try again.");
    }
  }

  async function retryProcessing(docId: string) {
    setRetryingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/process`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Reprocessing failed.");
      } else {
        await load();
      }
    } catch {
      setError("Failed to trigger reprocessing.");
    } finally {
      setRetryingId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  const readyDocuments = documents?.filter((d) => d.status === "ready") ?? [];

  return (
    <section aria-labelledby="library-title" className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-200">
        <div>
          <h2 id="library-title" className="text-2xl font-bold text-zinc-900 tracking-tight">
            Contract Repository
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Upload legal agreements to extract text, chat with verified citations, and compare versions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DocumentUpload onUploaded={load} />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900 text-xs font-semibold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Bulk actions banner if multiple selected */}
      {selectedIds.length > 0 && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center justify-between transition-all">
          <div className="flex items-center gap-2 text-sm text-indigo-950 font-medium">
            <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
              {selectedIds.length}
            </span>
            <span>contracts selected</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length === 2 && (
              <button
                type="button"
                onClick={() => onCompareDocs(selectedIds[0], selectedIds[1])}
                className="rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 transition cursor-pointer"
              >
                ⚖️ Compare These 2 Contracts
              </button>
            )}
            <button
              type="button"
              onClick={() => onMultiDocQ(selectedIds)}
              className="rounded-md bg-white border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100/60 transition cursor-pointer"
            >
              🌐 Ask Across Selected ({selectedIds.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {documents === null && !error && (
        <div className="py-12 text-center text-zinc-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-indigo-900 border-t-transparent"></div>
          <p className="mt-3 text-sm font-medium">Loading your document repository…</p>
        </div>
      )}

      {/* Empty state */}
      {documents?.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-900 text-2xl mb-3">
            📑
          </div>
          <h3 className="text-base font-semibold text-zinc-900">No contracts uploaded yet</h3>
          <p className="mt-1 text-sm text-zinc-600 max-w-md mx-auto">
            Upload any text-based PDF or DOCX contract. ContractAI will extract page text, index clauses, and enable grounded Q&A with verified quotes.
          </p>
        </div>
      )}

      {/* Documents List */}
      <div className="grid gap-3">
        {documents?.map((doc) => {
          const isSelected = selectedIds.includes(doc.id);
          const isReady = doc.status === "ready";
          const isProcessing = IN_PROGRESS.includes(doc.status);

          return (
            <div
              key={doc.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4.5 bg-white transition shadow-xs hover:border-zinc-300 ${
                isSelected ? "border-indigo-500 ring-1 ring-indigo-500/20 bg-indigo-50/20" : "border-zinc-200"
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {isReady && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(doc.id)}
                    aria-label={`Select ${doc.name}`}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate font-semibold text-zinc-950 text-base">{doc.name}</span>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 uppercase">
                      {doc.type}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                    <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    {doc.pageCount !== null && (
                      <span>
                        {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                      </span>
                    )}
                  </div>

                  {/* Status Indicator */}
                  <div className="mt-2 text-xs font-medium">
                    {isReady && (
                      <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                        Ready — {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"} indexed
                      </span>
                    )}
                    {doc.status === "failed" && (
                      <span className="inline-flex items-center gap-1.5 text-red-800 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>
                        {doc.statusMessage || "Processing failed."}
                      </span>
                    )}
                    {isProcessing && (
                      <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                        {PROGRESS_TEXT[doc.status as Exclude<Status, "ready" | "failed">]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {isReady && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenWorkspace(doc)}
                      className="rounded-lg bg-indigo-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-800 transition cursor-pointer"
                    >
                      Open in Workspace →
                    </button>

                    {onRedlineDoc && (
                      <button
                        type="button"
                        onClick={() => onRedlineDoc(doc)}
                        className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 transition cursor-pointer"
                        title="Redline Contract (Part C Option 1)"
                      >
                        ✏️ Redline
                      </button>
                    )}

                    {readyDocuments.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const other = readyDocuments.find((d) => d.id !== doc.id);
                          if (other) onCompareDocs(doc.id, other.id);
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
                      >
                        ⚖️ Compare
                      </button>
                    )}
                  </>
                )}

                {doc.status === "failed" && (
                  <button
                    type="button"
                    disabled={retryingId === doc.id}
                    onClick={() => retryProcessing(doc.id)}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {retryingId === doc.id ? "Retrying…" : "Retry Processing"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => remove(doc)}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition cursor-pointer"
                  title="Delete Document"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
