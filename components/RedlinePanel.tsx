"use client";

import { useState } from "react";
import type { DocumentRow } from "./DocumentLibrary";
import type { ProposedRedline } from "@/lib/redline/propose";
import {
  AlertCircleIcon,
  DownloadIcon,
  CheckIcon,
  EditIcon,
} from "./Icons";

interface RedlinePanelProps {
  documents: DocumentRow[];
  initialDocumentId?: string | null;
}

export function RedlinePanel({ documents, initialDocumentId }: RedlinePanelProps) {
  const readyDocs = documents.filter((d) => d.status === "ready");

  const [selectedDocId, setSelectedDocId] = useState<string>(
    initialDocumentId || readyDocs[0]?.id || ""
  );

  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposedRedline | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function handlePropose(e?: React.FormEvent, customInstruction?: string) {
    if (e) e.preventDefault();
    const inst = customInstruction || instruction;
    if (!inst.trim() || loading || !selectedDocId) return;

    setLoading(true);
    setError(null);
    setProposal(null);

    try {
      const res = await fetch("/api/redline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocId,
          instruction: inst.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to generate redline proposal.");
      setProposal(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error proposing redline.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyAndDownload() {
    if (!proposal || !selectedDocId || downloading) return;

    setDownloading(true);
    setError(null);

    try {
      const res = await fetch("/api/redline/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocId,
          edits: [
            {
              targetText: proposal.targetText,
              revisedText: proposal.revisedText,
            },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate redlined DOCX.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redlined-${proposal.clauseTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error downloading redlined file.");
    } finally {
      setDownloading(false);
    }
  }

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-950">Tracked-Change Redlining</h2>
            <span className="bg-indigo-900 text-white text-xs font-bold px-2 py-0.5 rounded">Part C: Option 1</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Submit plain-language drafting requests. ContractAI surgically generates revisions directly as native Word OpenXML tracked changes (<code className="text-indigo-900 font-mono text-xs">&lt;w:del&gt;</code> and <code className="text-indigo-900 font-mono text-xs">&lt;w:ins&gt;</code>) that open cleanly in Microsoft Word and LibreOffice with standard Accept / Reject review.
          </p>
        </div>

        {/* Document Selection */}
        <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-bold text-zinc-700 shrink-0">Contract to Redline:</label>
          <select
            value={selectedDocId}
            onChange={(e) => {
              setSelectedDocId(e.target.value);
              setProposal(null);
            }}
            className="flex-1 max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
          >
            {readyDocs.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name} ({doc.type.toUpperCase()})
              </option>
            ))}
          </select>
          {selectedDoc && (
            <span className="text-xs text-zinc-500 font-mono">
              {selectedDoc.pageCount} pages • ID: {selectedDoc.id.slice(-6)}
            </span>
          )}
        </div>

        {/* Edit Request Form */}
        <form onSubmit={(e) => handlePropose(e)} className="space-y-3 pt-2">
          <label className="text-xs font-bold text-zinc-700 block">
            Plain-Language Edit Request:
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="e.g. Make the liability cap mutual, or increase termination notice from 30 to 60 days…"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={loading}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
            />
            <button
              type="submit"
              disabled={loading || !instruction.trim() || !selectedDocId}
              className="rounded-lg bg-indigo-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-800 disabled:opacity-50 transition cursor-pointer shrink-0"
            >
              {loading ? "Analyzing & Formulating Redline…" : "Propose Redline →"}
            </button>
          </div>

          {/* Sample Prompts */}
          <div className="flex flex-wrap gap-2 text-xs pt-1">
            <span className="text-zinc-500 font-medium self-center text-[11px]">Quick examples:</span>
            {[
              "Make the liability cap mutual for both parties",
              "Increase termination notice from 30 days to 60 days",
              "Change governing law to the State of Delaware",
              "Extend payment terms to sixty (60) days",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setInstruction(example);
                  handlePropose(undefined, example);
                }}
                className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-[11px] transition cursor-pointer"
              >
                &quot;{example}&quot;
              </button>
            ))}
          </div>
        </form>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-center gap-1.5">
            <AlertCircleIcon className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Proposed Redline Preview Card */}
      {proposal && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Targeted Clause: {proposal.clauseTitle}
              </span>
              <p className="mt-0.5 text-xs text-slate-600 font-medium">
                {proposal.explanation}
              </p>
            </div>

            <button
              type="button"
              disabled={downloading}
              onClick={handleApplyAndDownload}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer shrink-0"
            >
              <DownloadIcon className="w-4 h-4" />
              <span>{downloading ? "Building DOCX Archive…" : "Download Redlined DOCX"}</span>
            </button>
          </div>

          {/* Diff Preview with Word Tracked Changes Appearance */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Word Tracked Change Preview</span>
              <span className="font-mono text-[10px] text-slate-400">Author: ContractAI</span>
            </div>

            <div className="bg-white p-5 rounded-md border border-slate-200 font-serif leading-relaxed text-sm text-slate-900 space-y-3">
              <div className="space-y-2">
                <span className="text-[10px] font-sans font-bold uppercase text-red-700 block tracking-wider">
                  [-] Tracked Deletion (&lt;w:del&gt;)
                </span>
                <div className="line-through decoration-red-600 bg-red-50 text-red-950 p-3 rounded border border-red-200 font-medium">
                  {proposal.targetText}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-sans font-bold uppercase text-emerald-700 block tracking-wider">
                  [+] Tracked Insertion (&lt;w:ins&gt;)
                </span>
                <div className="underline decoration-emerald-600 bg-emerald-50 text-emerald-950 p-3 rounded border border-emerald-200 font-medium">
                  {proposal.revisedText}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>All original fonts, formatting, margins, and document styles preserved.</span>
              </span>
              <span className="font-medium text-slate-900">
                Word Tracked Revisions Enabled
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
