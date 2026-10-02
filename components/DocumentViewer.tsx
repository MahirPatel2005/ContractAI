"use client";

import { useEffect, useRef, useState } from "react";
import type { PageTextItem } from "@/lib/documents/pdf";
import {
  AlertCircleIcon,
  DownloadIcon,
  CheckIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from "./Icons";

export interface ActiveCitation {
  id?: string;
  documentId: string;
  quote: string;
  pageNumber: number;
  pageStart?: number;
  pageEnd?: number;
  startOffset: number;
  endOffset: number;
  occurrences?: number;
  verified?: boolean;
}

interface PageData {
  pageNumber: number;
  text: string;
  startOffset: number;
  items?: PageTextItem[] | null;
}

interface DocumentContent {
  document: {
    id: string;
    name: string;
    type: string;
    pageCount: number | null;
  };
  pages: PageData[];
}

interface DocumentViewerProps {
  documentId: string;
  activeCitation: ActiveCitation | null;
  onClearCitation?: () => void;
}

export function DocumentViewer({ documentId, activeCitation, onClearCitation }: DocumentViewerProps) {
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Load document content
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function fetchContent() {
      try {
        const res = await fetch(`/api/documents/${documentId}/content`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) throw new Error(json.error?.message || "Failed to load document content.");
        setContent(json.data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error loading document.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchContent();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Handle active citation jump and highlight scroll
  useEffect(() => {
    if (!activeCitation || !content) return;

    const targetPage = activeCitation.pageNumber || activeCitation.pageStart || 1;
    setCurrentPage(targetPage);

    // Give DOM a frame to update
    const timeout = setTimeout(() => {
      const highlightElem = document.getElementById("citation-highlight-target");
      if (highlightElem) {
        highlightElem.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        const pageElem = pageRefs.current.get(targetPage);
        if (pageElem) {
          pageElem.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [activeCitation, content]);

  function jumpToPage(n: number) {
    if (!content) return;
    const bounded = Math.max(1, Math.min(content.pages.length, n));
    setCurrentPage(bounded);
    const elem = pageRefs.current.get(bounded);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[480px] bg-zinc-50 border border-zinc-200 rounded-xl p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-900 border-t-transparent mb-3"></div>
        <p className="text-sm font-medium text-zinc-600">Rendering document pages & coordinate maps…</p>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[480px] bg-red-50/50 border border-red-200 rounded-xl p-8 text-center">
        <AlertCircleIcon className="w-8 h-8 text-red-600 mb-2" />
        <h4 className="text-sm font-bold text-red-900">Could not load document preview</h4>
        <p className="mt-1 text-xs text-red-700 max-w-sm">{error || "Document not found or still processing."}</p>
      </div>
    );
  }

  const totalPages = content.pages.length;

  return (
    <div className="flex flex-col h-full bg-slate-100/80 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={content.document.name}>
            {content.document.name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-mono text-[10px]">
            {content.document.type}
          </span>
        </div>

        {/* Page Nav */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => jumpToPage(currentPage - 1)}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 disabled:opacity-30 cursor-pointer"
            title="Previous Page"
          >
            ◀
          </button>
          <span className="text-slate-700 font-medium px-1">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => jumpToPage(currentPage + 1)}
            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 disabled:opacity-30 cursor-pointer"
            title="Next Page"
          >
            ▶
          </button>
        </div>

        {/* Zoom and Search */}
        <div className="flex items-center gap-2">
          {/* Search inside doc */}
          <div className="relative">
            <input
              type="text"
              placeholder="Find in doc…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-28 sm:w-36 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(70, z - 10))}
              className="p-0.5 text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
              title="Zoom out"
            >
              <MinusIcon className="w-3 h-3" />
            </button>
            <span className="text-[11px] font-mono text-slate-600 w-8 text-center">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="p-0.5 text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
              title="Zoom in"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
          </div>

          {/* Download Original File */}
          <a
            href={`/api/documents/${documentId}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs inline-flex items-center"
            title="Download Original File"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Active Citation Notification Bar */}
      {activeCitation && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-950 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-emerald-800 flex items-center gap-1 shrink-0">
              <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Citation</span>
            </span>
            <span className="text-amber-800 font-medium">• Page {activeCitation.pageNumber}</span>
            <span className="truncate italic text-slate-700 max-w-sm hidden sm:inline" title={activeCitation.quote}>
              &quot;{activeCitation.quote}&quot;
            </span>
          </div>
          {onClearCitation && (
            <button
              type="button"
              onClick={onClearCitation}
              className="text-amber-800 hover:text-amber-950 font-bold p-1 cursor-pointer rounded hover:bg-amber-100"
              title="Dismiss highlight"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Document Pages Container */}
      <div
        ref={viewerContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
        style={{ fontSize: `${(zoom / 100) * 14}px` }}
      >
        {content.pages.map((page) => {
          const isPageWithCitation =
            activeCitation &&
            page.pageNumber >= (activeCitation.pageStart || activeCitation.pageNumber) &&
            page.pageNumber <= (activeCitation.pageEnd || activeCitation.pageNumber);

          return (
            <div
              key={page.pageNumber}
              ref={(el) => {
                if (el) pageRefs.current.set(page.pageNumber, el);
              }}
              className={`relative mx-auto max-w-3xl bg-white rounded-lg shadow-sm border p-6 sm:p-10 transition-all ${
                isPageWithCitation ? "border-amber-400 ring-2 ring-amber-400/30" : "border-zinc-200"
              }`}
            >
              {/* Page Number Watermark / Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-4 text-xs text-zinc-400 select-none">
                <span className="uppercase tracking-wider font-mono text-[10px]">
                  {content.document.name}
                </span>
                <span className="font-semibold text-zinc-500">Page {page.pageNumber}</span>
              </div>

              {/* Page Body Text with Citation & Query Highlighting */}
              <div className="whitespace-pre-wrap leading-relaxed font-serif text-zinc-800 break-words">
                <RenderPageContent
                  page={page}
                  activeCitation={isPageWithCitation ? activeCitation : null}
                  searchQuery={searchQuery}
                />
              </div>

              {/* Page Footer */}
              <div className="mt-8 pt-2 border-t border-zinc-100 text-center text-[10px] text-zinc-400 select-none">
                — {page.pageNumber} of {totalPages} —
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Renders page content with verified citation highlights and optional search term highlights.
 */
function RenderPageContent({
  page,
  activeCitation,
  searchQuery,
}: {
  page: PageData;
  activeCitation: ActiveCitation | null;
  searchQuery: string;
}) {
  const text = page.text;

  // 1. Check if active citation falls inside this page
  if (activeCitation) {
    const pageStart = page.startOffset;
    const pageEnd = pageStart + text.length;

    const citStart = activeCitation.startOffset;
    const citEnd = activeCitation.endOffset;

    // Intersects with page
    if (citStart < pageEnd && citEnd > pageStart) {
      const relStart = Math.max(0, citStart - pageStart);
      const relEnd = Math.min(text.length, citEnd - pageStart);

      const before = text.slice(0, relStart);
      const highlighted = text.slice(relStart, relEnd);
      const after = text.slice(relEnd);

      return (
        <>
          {renderSearchHighlights(before, searchQuery)}
          <mark
            id="citation-highlight-target"
            className="citation-highlight-active inline bg-amber-200/90 text-zinc-950 font-medium rounded-sm px-1 py-0.5 border-b-2 border-amber-600 shadow-xs cursor-default"
            title={`Verified Citation: "${activeCitation.quote}"`}
          >
            {highlighted}
          </mark>
          {renderSearchHighlights(after, searchQuery)}
        </>
      );
    }
  }

  // 2. Just search query highlighting
  return renderSearchHighlights(text, searchQuery);
}

function renderSearchHighlights(str: string, query: string) {
  if (!query || query.trim().length < 2) {
    return <span>{str}</span>;
  }

  const parts = str.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-yellow-200 text-zinc-900 rounded-xs px-0.5">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
