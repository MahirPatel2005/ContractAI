"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveCitation } from "./DocumentViewer";
import { FormattedMessage } from "./FormattedMessage";
import {
  MessageSquareIcon,
  CpuIcon,
  SearchIcon,
  CheckIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  SquareIcon,
  ArrowRightIcon,
  PlusIcon,
  XIcon,
} from "./Icons";

interface ChatItem {
  id: string;
  title: string | null;
  createdAt: string;
}

interface MessageCitation {
  id: string;
  documentId: string;
  quote: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  verified: boolean;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  cancelled?: boolean;
  citations?: MessageCitation[];
  createdAt: string;
}

interface AgentStepEvent {
  type: "step";
  round: number;
  label?: string;
  action?: string;
  tool?: string;
  args?: Record<string, unknown>;
  resultSummary?: string;
  ok?: boolean;
}

interface ChatPanelProps {
  documentId: string;
  documentName: string;
  onSelectCitation: (citation: ActiveCitation) => void;
}

export function ChatPanel({ documentId, documentName, onSelectCitation }: ChatPanelProps) {
  const [mode, setMode] = useState<"chat" | "agent">("chat");

  // Chat Sessions
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Input & Streaming
  const [inputQuestion, setInputQuestion] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [liveStatus, setLiveStatus] = useState<string>("Scanning document & locating relevant clauses…");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Agentic Mode State
  const [agentSteps, setAgentSteps] = useState<AgentStepEvent[]>([]);
  const [agentAnswer, setAgentAnswer] = useState<string | null>(null);
  const [agentCitations, setAgentCitations] = useState<MessageCitation[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, agentSteps]);

  // Load chats for document
  const loadChats = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/chats`);
      const json = await res.json();
      if (json.success) {
        setChats(json.data.chats);
        if (json.data.chats.length > 0 && !activeChatId) {
          setActiveChatId(json.data.chats[0].id);
        } else if (json.data.chats.length === 0) {
          // Auto create first chat
          createChat();
        }
      }
    } catch {
      // Ignore
    }
  }, [documentId, activeChatId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;
    setLoadingHistory(true);

    async function loadChatMessages() {
      try {
        const res = await fetch(`/api/chats/${activeChatId}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setMessages(json.data.chat.messages || []);
        }
      } catch {
        // Ignore
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    loadChatMessages();
    return () => {
      cancelled = true;
    };
  }, [activeChatId]);

  async function createChat() {
    try {
      const res = await fetch(`/api/documents/${documentId}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Analysis - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` }),
      });
      const json = await res.json();
      if (json.success) {
        setChats((prev) => [json.data.chat, ...prev]);
        setActiveChatId(json.data.chat.id);
        setMessages([]);
      }
    } catch {
      setError("Failed to create new chat session.");
    }
  }

  // Cancel generation
  async function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (activeChatId) {
      fetch(`/api/chats/${activeChatId}/cancel`, { method: "POST" }).catch(() => {});
    }
    setIsGenerating(false);
  }

  // Send message in standard chat mode
  async function handleSendMessage(e?: React.FormEvent, overrideQuestion?: string) {
    if (e) e.preventDefault();
    const question = (overrideQuestion || inputQuestion).trim();
    if (!question || isGenerating || !activeChatId) return;

    setInputQuestion("");
    setError(null);
    setIsGenerating(true);
    setStreamingText("");

    // Optimistic user message
    const tempUserMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/chats/${activeChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Server returned an error.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No readable stream.");

      let partial = "";
      let incomingText = "";
      let finalCitations: MessageCitation[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        partial += decoder.decode(value, { stream: true });
        const lines = partial.split("\n\n");
        partial = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "token") {
                incomingText += event.text;
                setStreamingText(incomingText);
              } else if (event.type === "status") {
                setLiveStatus(event.message);
              } else if (event.type === "done") {
                finalCitations = event.citations || [];
                const assistantMsg: MessageItem = {
                  id: event.messageId || `asst-${Date.now()}`,
                  role: "assistant",
                  content: event.answer,
                  citations: finalCitations,
                  createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, assistantMsg]);
                setStreamingText("");
              } else if (event.type === "error") {
                setError(event.message);
              }
            } catch {
              // Ignore parse chunk errors
            }
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setError("Failed to complete request. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }

  // Run Agent Research (Part C Option 2)
  async function handleRunAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!inputQuestion.trim() || isGenerating) return;

    const question = inputQuestion.trim();
    setInputQuestion("");
    setError(null);
    setIsGenerating(true);
    setAgentSteps([]);
    setAgentAnswer(null);
    setAgentCitations([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: [documentId], question }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Agent request failed.");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No readable stream.");

      let partial = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        partial += decoder.decode(value, { stream: true });
        const lines = partial.split("\n\n");
        partial = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "step") {
                setAgentSteps((prev) => [...prev, event]);
              } else if (event.type === "final") {
                const finalAnswer = event.answer || event.result?.answer || "";
                const finalCitations = event.citations || event.result?.citations || [];
                setAgentAnswer(finalAnswer);
                setAgentCitations(finalCitations);
              } else if (event.type === "error") {
                setError(event.message);
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setError("Agent research failed or timed out.");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header & Mode Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-2.5 bg-slate-50/90 gap-2 shrink-0">
        <div className="inline-flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => setMode("chat")}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              mode === "chat" ? "bg-white text-slate-950 font-semibold shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquareIcon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>Q&A</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("agent")}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              mode === "agent"
                ? "bg-slate-900 text-white font-semibold shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CpuIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Agent</span>
            <span className="bg-slate-800 text-slate-300 text-[9px] px-1 py-0.5 rounded font-mono font-medium">Deep</span>
          </button>
        </div>

        {mode === "chat" && (
          <div className="flex items-center gap-1.5 min-w-0">
            {chats.length > 1 && (
              <select
                value={activeChatId || ""}
                onChange={(e) => setActiveChatId(e.target.value)}
                className="text-xs rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 font-medium max-w-[130px] truncate"
              >
                {chats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || `Inquiry ${c.id.slice(-4)}`}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={createChat}
              className="text-xs px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
              title="Start a new inquiry thread"
            >
              <PlusIcon className="w-3 h-3 text-slate-500" />
              <span>New</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Body */}
      {mode === "chat" ? (
        /* STANDARD CHAT VIEW */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingHistory && (
            <div className="text-center py-8 text-xs text-slate-500">Loading conversation history…</div>
          )}

          {!loadingHistory && messages.length === 0 && !streamingText && (
            <div className="text-center py-8 px-2 flex flex-col items-center justify-center my-auto">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-2xs mb-3">
                <ShieldCheckIcon className="w-5 h-5 text-slate-200" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">Contract Clause & Evidence Inquiry</h4>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Every assertion is cross-verified against indexed document clauses with zero-trust token matching. Click verified citations to inspect exact source clauses.
              </p>
              <div className="mt-5 w-full max-w-sm space-y-1.5 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                  Suggested inquiries:
                </span>
                {[
                  "What is the liability cap and financial limit?",
                  "What are the termination provisions and notice periods?",
                  "What are the governing law and jurisdiction terms?",
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => handleSendMessage(undefined, sample)}
                    className="w-full text-left text-xs bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-800 rounded-lg p-2.5 transition cursor-pointer border border-slate-200 flex items-center justify-between group shadow-2xs"
                  >
                    <span className="truncate">&quot;{sample}&quot;</span>
                    <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render past and current messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-2xs ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 border border-slate-200 text-slate-900"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <FormattedMessage content={msg.content} />
                )}

                {msg.cancelled && (
                  <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <AlertCircleIcon className="w-3 h-3 text-amber-700" />
                    <span>Analysis interrupted by user (partial content preserved)</span>
                  </span>
                )}
              </div>

              {/* Citations Container */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2.5 max-w-[90%] space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Verified Citations ({msg.citations.length})
                  </span>
                  {msg.citations.map((cit, idx) => (
                    <div
                      key={cit.id || idx}
                      onClick={() =>
                        onSelectCitation({
                          id: cit.id,
                          documentId: cit.documentId,
                          quote: cit.quote,
                          pageNumber: cit.pageNumber,
                          startOffset: cit.startOffset,
                          endOffset: cit.endOffset,
                          verified: cit.verified,
                        })
                      }
                      className="group flex flex-col p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-400 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Verified Clause</span>
                          <span className="text-slate-600 font-normal">• Page {cit.pageNumber}</span>
                        </span>
                        <span className="text-[11px] text-slate-700 group-hover:text-slate-950 font-medium inline-flex items-center gap-1">
                          <span>Inspect provision</span>
                          <ArrowRightIcon className="w-3 h-3 text-slate-400 group-hover:text-slate-700" />
                        </span>
                      </div>
                      <p className="mt-1 text-xs italic text-slate-700 line-clamp-2">
                        &quot;{cit.quote}&quot;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Active Generation / Loading Message (No Waiting Delay) */}
          {isGenerating && (
            <div className="flex flex-col items-start">
              <div className="max-w-[88%] min-w-[280px] rounded-xl px-4 py-3.5 text-sm leading-relaxed bg-slate-50 border border-slate-200 text-slate-900 shadow-2xs">
                {streamingText ? (
                  <>
                    <FormattedMessage content={streamingText} isStreaming={true} />
                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-800 animate-pulse"></span>
                        <span>{liveStatus || "Verifying citations against source document…"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="text-[11px] text-slate-400 hover:text-red-600 transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-red-50 flex items-center gap-1"
                      >
                        <SquareIcon className="w-3 h-3" />
                        <span>Stop</span>
                      </button>
                    </div>
                  </>
                ) : (
                  /* Immediate Loading Feedback */
                  <div className="space-y-3 py-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-800"></span>
                        </span>
                        <span className="text-xs font-semibold text-slate-950">
                          {liveStatus || "Reading contract & locating operative provisions…"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="text-[11px] text-slate-400 hover:text-red-600 transition cursor-pointer flex items-center gap-1"
                      >
                        <SquareIcon className="w-2.5 h-2.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                    {/* Animated thinking bars */}
                    <div className="space-y-2 pt-1">
                      <div className="h-2.5 bg-slate-200 rounded-full w-4/5 animate-pulse"></div>
                      <div className="h-2.5 bg-slate-200/60 rounded-full w-3/5 animate-pulse"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      ) : (
        /* AGENTIC RESEARCH VIEW (PART C OPTION 2) */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-lg bg-slate-900 text-white p-3.5 text-xs space-y-1">
            <div className="font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CpuIcon className="w-4 h-4 text-slate-300" />
                <span>Autonomous Legal Researcher</span>
              </span>
              <span className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono">
                Hard Limit: 5 Rounds
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              The agent dynamically invokes contract inspection tools (<code>search_document</code>, <code>get_section</code>, <code>list_clauses</code>) to synthesize multi-provision legal evidence.
            </p>
          </div>

          {agentSteps.length === 0 && !isGenerating && !agentAnswer && (
            <div className="text-center py-10">
              <p className="text-sm font-semibold text-slate-800">Launch an autonomous research run</p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Ask a complex query (e.g. &quot;What are all termination triggers and penalty clauses?&quot;). Watch the agent inspect clauses in real time.
              </p>
            </div>
          )}

          {/* Agent Steps Feed */}
          {agentSteps.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Execution Steps ({agentSteps.length}/5)
              </span>

              {agentSteps.map((st, i) => {
                const actionTitle = st.action || st.label || "Contract Research Step";
                const toolName = st.tool || "contract_tool";
                return (
                  <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-800 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="h-5 w-5 rounded bg-slate-200 text-slate-900 text-[11px] flex items-center justify-center font-mono font-bold">
                          R{st.round}
                        </span>
                        <span>{actionTitle}</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded">
                        tool: {toolName}
                      </span>
                    </div>

                    {st.args && Object.keys(st.args).length > 0 && (
                      <div className="text-[11px] text-slate-500 font-mono bg-white p-1.5 rounded border border-slate-200 truncate">
                        args: {JSON.stringify(st.args)}
                      </div>
                    )}

                    {st.resultSummary && (
                      <p className="text-[11px] text-slate-600 italic">
                        Result: {st.resultSummary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isGenerating && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="h-3 w-3 rounded-full bg-amber-500 animate-spin border-2 border-amber-700 border-t-transparent"></span>
              <span>Agent executing next step…</span>
            </div>
          )}

          {/* Final Agent Answer */}
          {agentAnswer && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <span className="text-xs font-bold text-slate-900 tracking-wider flex items-center gap-1.5 uppercase">
                <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
                <span>Final Verified Synthesis</span>
              </span>
              <div className="text-sm leading-relaxed text-slate-900 whitespace-pre-wrap">
                {agentAnswer}
              </div>

              {agentCitations.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase block">
                    Verified Citations ({agentCitations.length})
                  </span>
                  {agentCitations.map((cit, idx) => (
                    <div
                      key={idx}
                      onClick={() =>
                        onSelectCitation({
                          documentId: cit.documentId,
                          quote: cit.quote,
                          pageNumber: cit.pageNumber,
                          startOffset: cit.startOffset,
                          endOffset: cit.endOffset,
                          verified: true,
                        })
                      }
                      className="p-2 rounded bg-white border border-emerald-200 hover:border-emerald-400 cursor-pointer text-xs"
                    >
                      <div className="flex items-center justify-between text-emerald-800 font-semibold">
                        <span className="flex items-center gap-1">
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Verified • Page {cit.pageNumber}</span>
                        </span>
                        <span className="text-slate-600 font-normal inline-flex items-center gap-1">
                          <span>Inspect quote</span>
                          <ArrowRightIcon className="w-3 h-3" />
                        </span>
                      </div>
                      <p className="italic text-slate-700 mt-0.5 line-clamp-1">&quot;{cit.quote}&quot;</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertCircleIcon className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </span>
          <button type="button" onClick={() => setError(null)} className="font-bold text-xs text-red-900 cursor-pointer p-0.5 hover:bg-red-100 rounded">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={mode === "chat" ? (e) => handleSendMessage(e) : handleRunAgent}
        className="p-3 border-t border-slate-200 bg-slate-50/60 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          placeholder={
            mode === "chat"
              ? `Ask question about ${documentName}…`
              : `Prompt autonomous research agent on ${documentName}…`
          }
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          disabled={isGenerating}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-800 disabled:opacity-60 shadow-2xs"
        />

        {isGenerating ? (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 transition cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
          >
            <SquareIcon className="w-3 h-3" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!inputQuestion.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer shrink-0 shadow-2xs"
          >
            {mode === "chat" ? "Ask" : "Research"}
          </button>
        )}
      </form>
    </div>
  );
}
