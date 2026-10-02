"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveCitation } from "./DocumentViewer";
import { FormattedMessage } from "./FormattedMessage";

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
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputQuestion.trim() || isGenerating || !activeChatId) return;

    const question = inputQuestion.trim();
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
    <div className="flex flex-col h-full bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header & Mode Switcher */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 bg-zinc-50/70">
        <div className="flex items-center gap-1 bg-zinc-200/70 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("chat")}
            className={`px-3 py-1 rounded-md transition cursor-pointer ${
              mode === "chat" ? "bg-white text-zinc-950 font-semibold shadow-2xs" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            💬 Chat & Citations
          </button>
          <button
            type="button"
            onClick={() => setMode("agent")}
            className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              mode === "agent"
                ? "bg-indigo-900 text-white font-semibold shadow-2xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <span>🤖 Agent Research</span>
            <span className="bg-indigo-100 text-indigo-900 text-[10px] px-1.5 py-0.5 rounded font-bold">Bonus</span>
          </button>
        </div>

        {mode === "chat" && (
          <div className="flex items-center gap-2">
            {chats.length > 1 && (
              <select
                value={activeChatId || ""}
                onChange={(e) => setActiveChatId(e.target.value)}
                className="text-xs rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-700"
              >
                {chats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || `Chat ${c.id.slice(-4)}`}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={createChat}
              className="text-xs px-2.5 py-1 rounded-md bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer"
              title="Start a new chat session"
            >
              + New Chat
            </button>
          </div>
        )}
      </div>

      {/* Main Body */}
      {mode === "chat" ? (
        /* STANDARD CHAT VIEW */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingHistory && (
            <div className="text-center py-8 text-xs text-zinc-500">Loading conversation history…</div>
          )}

          {!loadingHistory && messages.length === 0 && !streamingText && (
            <div className="text-center py-12 px-4">
              <div className="inline-block p-3 rounded-full bg-indigo-50 text-indigo-900 text-2xl mb-2">💡</div>
              <h4 className="text-sm font-semibold text-zinc-900">Ask any question about this contract</h4>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
                Every claim is verified against the stored text. Verified citations can be clicked to locate and highlight them in the viewer.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  "What is the liability cap?",
                  "What are the termination provisions?",
                  "What are the governing law and jurisdiction terms?",
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setInputQuestion(sample)}
                    className="text-xs bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 rounded-full px-3 py-1 transition cursor-pointer"
                  >
                    &quot;{sample}&quot;
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
                    ? "bg-indigo-950 text-white"
                    : "bg-zinc-50 border border-zinc-200/90 text-zinc-900"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <FormattedMessage content={msg.content} />
                )}

                {msg.cancelled && (
                  <span className="inline-block mt-2 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    ⚠️ Generation stopped by user (partial content preserved)
                  </span>
                )}
              </div>

              {/* Citations Container */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2.5 max-w-[90%] space-y-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
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
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                          <span>✓ Verified</span>
                          <span className="text-zinc-600 font-normal">• Page {cit.pageNumber}</span>
                        </span>
                        <span className="text-[11px] text-indigo-700 group-hover:underline">
                          View in contract →
                        </span>
                      </div>
                      <p className="mt-1 text-xs italic text-zinc-700 line-clamp-2">
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
              <div className="max-w-[88%] min-w-[280px] rounded-xl px-4 py-3.5 text-sm leading-relaxed bg-zinc-50 border border-zinc-200/90 text-zinc-900 shadow-2xs">
                {streamingText ? (
                  <>
                    <FormattedMessage content={streamingText} isStreaming={true} />
                    <div className="mt-3 pt-2 border-t border-zinc-200/60 flex items-center justify-between text-xs text-indigo-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
                        <span>{liveStatus || "Verifying citations against source document…"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="text-[11px] text-zinc-400 hover:text-red-600 transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-red-50"
                      >
                        ⏹ Stop
                      </button>
                    </div>
                  </>
                ) : (
                  /* Immediate Loading Feedback (No Waiting Feel) */
                  <div className="space-y-3 py-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                        </span>
                        <span className="text-xs font-semibold text-indigo-950">
                          {liveStatus || "Reading contract & locating operative provisions…"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="text-[11px] text-zinc-400 hover:text-red-600 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    {/* Animated thinking bars */}
                    <div className="space-y-2 pt-1">
                      <div className="h-2.5 bg-zinc-200/80 rounded-full w-4/5 animate-pulse"></div>
                      <div className="h-2.5 bg-zinc-200/60 rounded-full w-3/5 animate-pulse"></div>
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
          <div className="rounded-lg bg-indigo-950 text-white p-3.5 text-xs space-y-1">
            <div className="font-bold flex items-center justify-between">
              <span>🤖 Autonomous Legal Researcher</span>
              <span className="bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded text-[10px]">
                Hard Limit: 5 Rounds
              </span>
            </div>
            <p className="text-indigo-200 text-[11px]">
              The agent dynamically invokes contract tools (<code>search_document</code>, <code>get_section</code>, <code>list_clauses</code>) to gather cross-clause evidence before formulating an answer.
            </p>
          </div>

          {agentSteps.length === 0 && !isGenerating && !agentAnswer && (
            <div className="text-center py-10">
              <p className="text-sm font-semibold text-zinc-800">Launch an autonomous research run</p>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
                Ask a complex query (e.g. &quot;What are all termination triggers and penalty clauses?&quot;). Watch the agent inspect clauses in real time.
              </p>
            </div>
          )}

          {/* Agent Steps Feed */}
          {agentSteps.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                Execution Steps ({agentSteps.length}/5)
              </span>

              {agentSteps.map((st, i) => {
                const actionTitle = st.action || st.label || "Contract Research Step";
                const toolName = st.tool || "contract_tool";
                return (
                  <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-zinc-800 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="h-5 w-5 rounded bg-indigo-100 text-indigo-900 text-[11px] flex items-center justify-center font-mono font-bold">
                          R{st.round}
                        </span>
                        <span>{actionTitle}</span>
                      </span>
                      <span className="font-mono text-[10px] text-zinc-600 bg-zinc-200/70 px-1.5 py-0.5 rounded">
                        tool: {toolName}
                      </span>
                    </div>

                    {st.args && Object.keys(st.args).length > 0 && (
                      <div className="text-[11px] text-zinc-500 font-mono bg-white p-1.5 rounded border border-zinc-200 truncate">
                        args: {JSON.stringify(st.args)}
                      </div>
                    )}

                    {st.resultSummary && (
                      <p className="text-[11px] text-zinc-600 italic">
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
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider block">
                🏁 Final Verified Synthesis
              </span>
              <div className="text-sm leading-relaxed text-zinc-900 whitespace-pre-wrap">
                {agentAnswer}
              </div>

              {agentCitations.length > 0 && (
                <div className="pt-2 border-t border-indigo-100 space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase block">
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
                      <div className="flex items-center justify-between text-emerald-800 font-bold">
                        <span>✓ Verified • Page {cit.pageNumber}</span>
                        <span className="text-indigo-600 font-normal">Scroll to quote →</span>
                      </div>
                      <p className="italic text-zinc-700 mt-0.5 line-clamp-1">&quot;{cit.quote}&quot;</p>
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
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold text-xs text-red-900">
            ×
          </button>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={mode === "chat" ? handleSendMessage : handleRunAgent}
        className="p-3 border-t border-zinc-200 bg-white flex items-center gap-2"
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
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 disabled:opacity-60"
        />

        {isGenerating ? (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition cursor-pointer shrink-0"
          >
            ■ Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!inputQuestion.trim()}
            className="rounded-lg bg-indigo-900 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-40 transition cursor-pointer shrink-0"
          >
            {mode === "chat" ? "Ask" : "Research"}
          </button>
        )}
      </form>
    </div>
  );
}
