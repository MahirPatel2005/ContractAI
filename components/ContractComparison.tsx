"use client";

import { useEffect, useRef, useState } from "react";
import type { ComparisonReport, MatchedSectionComparison, Significance, ChangeStatus } from "@/lib/comparison/compare";
import type { DocumentRow } from "./DocumentLibrary";
import type { VerifiedCitation } from "@/lib/citations/verifier";
import {
  ScaleIcon,
  MessageSquareIcon,
  AlertCircleIcon,
  CheckIcon,
  FileTextIcon,
  ArrowRightIcon,
} from "./Icons";

interface ContractComparisonProps {
  documents: DocumentRow[];
  initialLeftId?: string | null;
  initialRightId?: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: VerifiedCitation[];
}

export function ContractComparison({ documents, initialLeftId, initialRightId }: ContractComparisonProps) {
  const readyDocs = documents.filter((d) => d.status === "ready");

  const [leftDocId, setLeftDocId] = useState<string>(initialLeftId || readyDocs[0]?.id || "");
  const [rightDocId, setRightDocId] = useState<string>(initialRightId || readyDocs[1]?.id || "");

  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active highlighted section
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Synchronized scrolling state
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSignificance, setFilterSignificance] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Comparison Chat State
  const [showChat, setShowChat] = useState<boolean>(true);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLeftId) setLeftDocId(initialLeftId);
    if (initialRightId) setRightDocId(initialRightId);
  }, [initialLeftId, initialRightId]);

  async function runComparison() {
    if (!leftDocId || !rightDocId) {
      setError("Please select two documents to compare.");
      return;
    }
    if (leftDocId === rightDocId) {
      setError("Please select two different documents to compare.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftDocumentId: leftDocId, rightDocumentId: rightDocId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Comparison failed.");
      setReport(json.data);
      if (json.data.sections.length > 0) {
        setActiveSectionId(json.data.sections[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error comparing contracts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialLeftId && initialRightId && initialLeftId !== initialRightId) {
      runComparison();
    }
  }, [initialLeftId, initialRightId]);

  // Synchronized scrolling handler
  function handleScroll(source: "left" | "right") {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;

    const sourceEl = source === "left" ? leftPaneRef.current : rightPaneRef.current;
    const targetEl = source === "left" ? rightPaneRef.current : leftPaneRef.current;

    if (sourceEl && targetEl) {
      const scrollRatio = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
      targetEl.scrollTop = scrollRatio * (targetEl.scrollHeight - targetEl.clientHeight);
    }

    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }

  function scrollToSection(secId: string) {
    setActiveSectionId(secId);
    const leftEl = document.getElementById(`left-${secId}`);
    const rightEl = document.getElementById(`right-${secId}`);
    if (leftEl) leftEl.scrollIntoView({ behavior: "smooth", block: "center" });
    if (rightEl) rightEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Handle Comparison Chat Questions
  async function handleSendComparisonChat(qText?: string) {
    const query = qText || chatQuestion;
    if (!query.trim() || chatLoading || !leftDocId || !rightDocId) return;

    setChatLoading(true);
    setChatError(null);
    setChatQuestion("");

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: query };
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/compare/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftDocumentId: leftDocId,
          rightDocumentId: rightDocId,
          question: query,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to answer comparison question.");

      const asstMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: json.data.answer,
        citations: json.data.citations,
      };
      setChatMessages((prev) => [...prev, asstMsg]);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : "Error generating answer.");
    } finally {
      setChatLoading(false);
    }
  }

  // Filter sections
  const filteredSections =
    report?.sections.filter((s) => {
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (filterSignificance !== "all" && s.significance !== filterSignificance) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchExpl = s.explanation.toLowerCase().includes(q);
        const matchChanges = s.detectedChanges.some((c) => c.toLowerCase().includes(q));
        if (!matchTitle && !matchExpl && !matchChanges) return false;
      }
      return true;
    }) || [];

  return (
    <div className="space-y-6">
      {/* Top Document Selector Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
              <ScaleIcon className="w-5 h-5 text-slate-800" />
              <span>Side-by-Side Contract Comparison & Risk Analysis</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Clause-level matching with synchronized scrolling, accessible diffs, and interactive comparison analysis.
            </p>
          </div>

          {report && (
            <button
              type="button"
              onClick={() => setShowChat(!showChat)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 transition cursor-pointer self-start sm:self-center flex items-center gap-1.5"
            >
              <MessageSquareIcon className="w-3.5 h-3.5 text-slate-600" />
              <span>{showChat ? "Hide Comparison Inquiry" : "Show Comparison Inquiry"}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-2 border-t border-zinc-100">
          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-bold text-zinc-700 block">Version 1 (Left Pane)</label>
            <select
              value={leftDocId}
              onChange={(e) => setLeftDocId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">Select prior contract…</option>
              {readyDocs.map((doc) => (
                <option key={doc.id} value={doc.id} disabled={doc.id === rightDocId}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 text-center text-xs font-bold text-zinc-400 py-2">⇄ COMPARE TO</div>

          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-bold text-indigo-950 block">Version 2 (Right Pane - Revised)</label>
            <select
              value={rightDocId}
              onChange={(e) => setRightDocId(e.target.value)}
              className="w-full rounded-lg border border-indigo-300 bg-indigo-50/20 px-3 py-1.5 text-xs text-zinc-900 focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">Select revised contract…</option>
              {readyDocs.map((doc) => (
                <option key={doc.id} value={doc.id} disabled={doc.id === leftDocId}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-12 flex justify-end pt-1">
            <button
              type="button"
              disabled={loading || !leftDocId || !rightDocId || leftDocId === rightDocId}
              onClick={runComparison}
              className="rounded-lg bg-indigo-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-800 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? "Matching & Analyzing Clauses…" : "Run Side-by-Side Comparison →"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 flex items-center gap-1.5">
            <AlertCircleIcon className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {report && (
        <div className="space-y-5">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs">
              <span className="text-zinc-500 font-medium uppercase block text-[10px]">Total Clauses</span>
              <span className="text-xl font-bold text-zinc-900 mt-1 block">{report.summary.totalSections}</span>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
              <span className="text-amber-800 font-bold uppercase block text-[10px]">Substantive Changes</span>
              <span className="text-xl font-bold text-amber-900 mt-1 block">{report.summary.modifiedCount}</span>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 shadow-2xs">
              <span className="text-red-800 font-bold uppercase block text-[10px]">High Risk Impact</span>
              <span className="text-xl font-bold text-red-900 mt-1 block">{report.summary.highSignificanceCount}</span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
              <span className="text-emerald-800 font-bold uppercase block text-[10px]">Added Clauses</span>
              <span className="text-xl font-bold text-emerald-900 mt-1 block">+{report.summary.addedCount}</span>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 shadow-2xs">
              <span className="text-zinc-600 font-medium uppercase block text-[10px]">Deleted Clauses</span>
              <span className="text-xl font-bold text-zinc-800 mt-1 block">-{report.summary.deletedCount}</span>
            </div>
          </div>

          {/* Optional Comparison Chat Panel */}
          {showChat && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white text-xs">
                <span className="font-semibold flex items-center gap-2">
                  <MessageSquareIcon className="w-3.5 h-3.5 text-slate-300" />
                  <span>Comparison Assistant</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono font-medium">
                    Dual-Contract Quote Verification
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Ask about differences or risks between these versions
                </span>
              </div>

              {/* Sample Prompts */}
              {chatMessages.length === 0 && (
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium self-center">Try asking:</span>
                  {[
                    "What are the biggest financial and liability differences?",
                    "How does this revised contract affect me?",
                    "What changed in the termination notice period?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSendComparisonChat(prompt)}
                      className="px-2.5 py-1 rounded-full bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 transition text-[11px] cursor-pointer"
                    >
                      &quot;{prompt}&quot;
                    </button>
                  ))}
                </div>
              )}

              {/* Messages Feed */}
              {chatMessages.length > 0 && (
                <div className="p-4 max-h-60 overflow-y-auto space-y-3 text-xs">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                          msg.role === "user"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-50 border border-slate-200 text-slate-900"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>

                      {/* Verified Citations from Both Documents */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-1.5 max-w-[85%] space-y-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                            Verified Source Evidence ({msg.citations.length})
                          </span>
                          {msg.citations.map((c, i) => (
                            <div
                              key={i}
                              className="p-1.5 rounded bg-emerald-50/60 border border-emerald-200 text-[11px] text-emerald-950 cursor-pointer hover:bg-emerald-100/60"
                              onClick={() => {
                                // Find matching section and scroll to it
                                const matchingSec = report.sections.find(
                                  (s) => (s.leftText && s.leftText.includes(c.quote)) || (s.rightText && s.rightText.includes(c.quote))
                                );
                                if (matchingSec) scrollToSection(matchingSec.id);
                              }}
                            >
                              <span className="font-semibold text-emerald-800 inline-flex items-center gap-1">
                                <CheckIcon className="w-3 h-3 text-emerald-600" />
                                <span>Verified Authority • {c.documentName} • Page {c.pageStart}</span>
                              </span>
                              <p className="italic text-slate-700 truncate mt-0.5">&quot;{c.quote}&quot;</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="text-xs text-slate-700 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-800 animate-pulse"></span>
                      <span>Comparing contract provisions and verifying quotes…</span>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendComparisonChat();
                }}
                className="p-2.5 border-t border-slate-200 bg-slate-50/80 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask a question about the differences between these two versions…"
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  disabled={chatLoading}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-800"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatQuestion.trim()}
                  className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
                >
                  Ask
                </button>
              </form>

              {chatError && (
                <div className="px-3 py-1.5 bg-red-50 text-[11px] text-red-700 border-t border-red-200 flex items-center gap-1.5">
                  <AlertCircleIcon className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{chatError}</span>
                </div>
              )}
            </div>
          )}

          {/* Main Comparison Area: Sidebar + Synchronized Side-by-Side Panes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Sidebar: Change Navigator */}
            <div className="lg:col-span-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-xs space-y-3 h-[680px] flex flex-col">
              <div className="pb-2 border-b border-zinc-100 flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-900">Change Navigator</span>
                <span className="text-[10px] text-zinc-500 font-mono">{filteredSections.length} clauses</span>
              </div>

              {/* Quick Filters */}
              <div className="space-y-1.5 text-[11px]">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700"
                >
                  <option value="all">All Changes ({report.sections.length})</option>
                  <option value="modified">Modified ({report.summary.modifiedCount})</option>
                  <option value="added">Added ({report.summary.addedCount})</option>
                  <option value="deleted">Deleted ({report.summary.deletedCount})</option>
                  <option value="unchanged">Unchanged ({report.summary.unchangedCount})</option>
                </select>

                <select
                  value={filterSignificance}
                  onChange={(e) => setFilterSignificance(e.target.value)}
                  className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700"
                >
                  <option value="all">All Significance</option>
                  <option value="high">High Risk ({report.summary.highSignificanceCount})</option>
                  <option value="medium">Medium Risk ({report.summary.mediumSignificanceCount})</option>
                  <option value="low">Low Risk ({report.summary.lowSignificanceCount})</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter clauses…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700"
                />
              </div>

              {/* List of Clauses in Sidebar */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredSections.map((sec) => {
                  const isActive = activeSectionId === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full text-left p-2 rounded-lg text-xs transition cursor-pointer border ${
                        isActive
                          ? "bg-indigo-50 border-indigo-300 font-semibold text-indigo-950 shadow-2xs"
                          : "border-transparent hover:bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono uppercase font-bold text-zinc-500">
                          {sec.status === "modified" && "MODIFIED"}
                          {sec.status === "added" && "+ ADDED"}
                          {sec.status === "deleted" && "- DELETED"}
                          {sec.status === "unchanged" && "UNCHANGED"}
                        </span>
                        {sec.significance === "high" && (
                          <span className="text-red-700 bg-red-50 px-1 rounded font-bold">HIGH</span>
                        )}
                      </div>
                      <p className="truncate text-[11px] mt-0.5">{sec.title}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 9 cols: Side-by-Side Synchronized Panes */}
            <div className="lg:col-span-9 rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden flex flex-col h-[680px]">
              {/* Panes Header Bar */}
              <div className="grid grid-cols-2 bg-zinc-50 border-b border-zinc-200 text-xs font-bold divide-x divide-zinc-200">
                <div className="px-4 py-2.5 flex items-center justify-between text-zinc-800">
                  <span className="truncate max-w-[240px] flex items-center gap-1.5">
                    <FileTextIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>{report.leftDocumentName}</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono uppercase bg-zinc-200/60 px-1.5 py-0.5 rounded">
                    Version 1 (Original)
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-indigo-950 bg-indigo-50/40">
                  <span className="truncate max-w-[240px] flex items-center gap-1.5">
                    <FileTextIcon className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                    <span>{report.rightDocumentName}</span>
                  </span>
                  <span className="text-[10px] text-indigo-800 font-mono uppercase bg-indigo-100 px-1.5 py-0.5 rounded">
                    Version 2 (Revised)
                  </span>
                </div>
              </div>

              {/* Synchronized Side-by-Side Scrolling Panes */}
              <div className="flex-1 grid grid-cols-2 divide-x divide-zinc-200 overflow-hidden">
                {/* Left Pane (Version 1) */}
                <div
                  ref={leftPaneRef}
                  onScroll={() => handleScroll("left")}
                  className="h-full overflow-y-auto p-4 space-y-4"
                >
                  {filteredSections.map((sec) => (
                    <SideBySideClauseCard
                      key={sec.id}
                      side="left"
                      sec={sec}
                      isActive={activeSectionId === sec.id}
                      onClick={() => setActiveSectionId(sec.id)}
                    />
                  ))}
                </div>

                {/* Right Pane (Version 2) */}
                <div
                  ref={rightPaneRef}
                  onScroll={() => handleScroll("right")}
                  className="h-full overflow-y-auto p-4 space-y-4 bg-zinc-50/20"
                >
                  {filteredSections.map((sec) => (
                    <SideBySideClauseCard
                      key={sec.id}
                      side="right"
                      sec={sec}
                      isActive={activeSectionId === sec.id}
                      onClick={() => setActiveSectionId(sec.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SideBySideClauseCard({
  side,
  sec,
  isActive,
  onClick,
}: {
  side: "left" | "right";
  sec: MatchedSectionComparison;
  isActive: boolean;
  onClick: () => void;
}) {
  const text = side === "left" ? sec.leftText : sec.rightText;

  const isDeleted = side === "left" && sec.status === "deleted";
  const isAdded = side === "right" && sec.status === "added";
  const isModified = sec.status === "modified";

  return (
    <div
      id={`${side}-${sec.id}`}
      onClick={onClick}
      className={`rounded-lg border p-3.5 transition-all text-xs font-serif leading-relaxed ${
        isActive
          ? "ring-2 ring-indigo-500/40 border-indigo-400 bg-white shadow-sm"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      {/* Clause Title & Accessible Badges */}
      <div className="font-sans flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 flex-wrap gap-1">
        <span className="font-bold text-zinc-900 text-xs">{sec.title}</span>

        <div className="flex items-center gap-1">
          {/* Accessible Diff Indicators: Not by color alone */}
          {isDeleted && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
              [-] DELETED
            </span>
          )}
          {isAdded && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
              [+] INSERTED
            </span>
          )}
          {isModified && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              [Δ] MODIFIED
            </span>
          )}

          {sec.significance === "high" && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
              HIGH RISK
            </span>
          )}
        </div>
      </div>

      {/* Impact Assessment Banner (on modified clauses) */}
      {isModified && side === "right" && (
        <div className="font-sans mb-3 rounded-md bg-amber-50/70 border border-amber-200 p-2 text-[11px] text-amber-950 space-y-1">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1 text-amber-900">
              <ScaleIcon className="w-3.5 h-3.5 text-amber-700" />
              <span>Favors: {sec.favorsParty}</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-normal">Risk: {sec.riskLevel}</span>
          </div>
          <p className="text-zinc-700">{sec.explanation}</p>
          {sec.detectedChanges.length > 0 && (
            <div className="text-[10px] font-mono text-indigo-900 pt-0.5">
              {sec.detectedChanges.join(" • ")}
            </div>
          )}
          <span className="text-[9px] text-zinc-500 italic block pt-0.5">
            Legal Notice: {sec.disclaimer}
          </span>
        </div>
      )}

      {/* Clause Text Content with Accessible Styling */}
      {text ? (
        <div
          className={`whitespace-pre-wrap ${
            isDeleted
              ? "line-through decoration-red-500/70 text-zinc-500 bg-red-50/30 p-2 rounded"
              : isAdded
              ? "underline decoration-emerald-500/70 text-zinc-900 bg-emerald-50/30 p-2 rounded"
              : "text-zinc-800"
          }`}
        >
          {text}
        </div>
      ) : (
        <div className="italic text-zinc-400 py-4 text-center">
          {side === "left"
            ? "— Not present in Version 1 (Newly added in Version 2) —"
            : "— Deleted from Version 2 (Omitted in revision) —"}
        </div>
      )}
    </div>
  );
}
