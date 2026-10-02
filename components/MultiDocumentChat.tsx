"use client";

import { useEffect, useState } from "react";
import type { DocumentRow } from "./DocumentLibrary";
import type { AnswerResult } from "@/lib/ai/answer";
import type { VerifiedCitation } from "@/lib/citations/verifier";
import { FormattedMessage } from "./FormattedMessage";

interface MultiDocumentChatProps {
  documents: DocumentRow[];
  preselectedIds?: string[];
}

export function MultiDocumentChat({ documents, preselectedIds }: MultiDocumentChatProps) {
  const readyDocs = documents.filter((d) => d.status === "ready");

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(
    preselectedIds && preselectedIds.length > 0
      ? preselectedIds
      : readyDocs.slice(0, 2).map((d) => d.id)
  );

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);

  useEffect(() => {
    if (preselectedIds && preselectedIds.length > 0) {
      setSelectedDocIds(preselectedIds);
    }
  }, [preselectedIds]);

  function toggleDoc(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading || selectedDocIds.length < 2) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: selectedDocIds,
          question: question.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to analyze contracts.");
      setResult(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error analyzing multiple contracts.");
    } finally {
      setLoading(false);
    }
  }

  // Group verified citations by source document
  const citationsByDoc = new Map<string, VerifiedCitation[]>();
  if (result?.citations) {
    for (const cit of result.citations) {
      const list = citationsByDoc.get(cit.documentId) || [];
      list.push(cit);
      citationsByDoc.set(cit.documentId, list);
    }
  }

  return (
    <div className="space-y-6">
      {/* Selection Header */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Multi-Contract Cross-Analysis</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Ask comparative questions across several contracts simultaneously. Every quote is verified independently against its own source agreement.
          </p>
        </div>

        {/* Contract Selector Checkboxes */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="text-xs font-bold text-zinc-700 block">
            Select 2 to 5 contracts for comparative synthesis:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {readyDocs.map((doc) => {
              const isChecked = selectedDocIds.includes(doc.id);
              return (
                <label
                  key={doc.id}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                    isChecked
                      ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500/20"
                      : "border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleDoc(doc.id)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-zinc-900 truncate block">
                      {doc.name}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {doc.type.toUpperCase()} • {doc.pageCount} pages
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Question Form */}
        <form onSubmit={handleAsk} className="pt-2 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="e.g. How do the liability limits and governing laws differ between these agreements?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading || selectedDocIds.length < 2}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !question.trim() || selectedDocIds.length < 2}
            className="rounded-lg bg-indigo-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-800 disabled:opacity-50 transition cursor-pointer shrink-0"
          >
            {loading ? "Analyzing Across Contracts…" : "Analyze Contracts →"}
          </button>
        </form>

        {selectedDocIds.length < 2 && (
          <p className="text-xs text-amber-700">Please select at least 2 contracts to compare.</p>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Comparative Synthesis Result */}
      {result && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-base font-bold text-zinc-900">Comparative Answer & Evidence</h3>
            <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              ✓ {result.citations.length} verified citations
            </span>
          </div>

          {/* Insufficient Evidence Warning */}
          {result.insufficientEvidence && (
            <div className="rounded-lg bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-200">
              ⚠️ <strong>Notice:</strong> One or more contracts did not contain explicit clauses regarding this question. Unsupported global claims are avoided.
            </div>
          )}

          {/* Unverified Warning */}
          {result.unverified && (
            <div className="rounded-lg bg-red-50 p-3.5 text-xs text-red-800 border border-red-200">
              ⚠️ <strong>Warning:</strong> No claim in this answer could be backed by verified quotes from the documents.
            </div>
          )}

          {/* Synthesis Body */}
          <div className="bg-zinc-50/60 p-4 rounded-xl border border-zinc-200/80">
            <FormattedMessage content={result.answer} />
          </div>

          {/* Citations Grouped By Document */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Grounded Evidence by Contract
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from(citationsByDoc.entries()).map(([docId, cits]) => {
                const doc = documents.find((d) => d.id === docId);
                const docName = doc?.name || cits[0]?.documentName || "Contract";

                return (
                  <div key={docId} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-indigo-950 truncate max-w-[220px]">
                        📄 {docName}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                        {cits.length} {cits.length === 1 ? "quote" : "quotes"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {cits.map((cit, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-white border border-emerald-200 p-2.5 text-xs space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
                            <span>✓ Verified • Page {cit.pageStart}</span>
                            {cit.occurrences > 1 && (
                              <span className="text-zinc-500 font-normal">
                                ({cit.occurrences} matches in doc)
                              </span>
                            )}
                          </div>
                          <p className="italic text-zinc-800 font-serif leading-relaxed line-clamp-3">
                            &quot;{cit.quote}&quot;
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coverage Summary */}
          {result.coverage && (
            <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
              <span className="font-semibold text-zinc-600">Retrieval Coverage:</span>
              {result.coverage.map((cov) => {
                const doc = documents.find((d) => d.id === cov.documentId);
                return (
                  <span key={cov.documentId} className="bg-zinc-100 px-2 py-0.5 rounded">
                    {doc?.name || cov.documentId}: {cov.chunksRetrieved}/{cov.chunksTotal} chunks examined
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
