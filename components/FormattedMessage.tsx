"use client";

import React from "react";

interface FormattedMessageProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Parses inline markdown: **bold**, *italic*, `code`, and legal quotations.
 */
function renderInline(text: string): React.ReactNode[] {
  // Regex matches:
  // 1. **bold**
  // 2. *italic*
  // 3. `code`
  // 4. "quoted sentence or clause" (at least 12 chars)
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|"[^"]{12,}")/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono text-slate-800 font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('"') && part.endsWith('"') && part.length >= 14) {
      return (
        <span
          key={idx}
          className="font-medium text-slate-950 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/90 inline-block my-0.5"
        >
          &ldquo;{part.slice(1, -1)}&rdquo;
        </span>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Formal Legal Analysis & Markdown Formatter.
 * Delivers an authoritative, corporate legal layout with structured provisions,
 * numbered legal breakdowns, and crisp typography with 0 emojis.
 */
export function FormattedMessage({ content, isStreaming }: FormattedMessageProps) {
  if (!content) {
    return isStreaming ? (
      <span className="inline-block w-1.5 h-4 bg-slate-900 animate-pulse rounded-xs align-middle" />
    ) : null;
  }

  // Split by double newline or block patterns
  const rawBlocks = content.split(/\n\n+/);

  return (
    <div className="space-y-3.5 text-sm leading-relaxed text-slate-900 font-sans">
      {rawBlocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 1. Heading 3: ### Heading
        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={bIdx}
              className="text-xs font-bold text-slate-900 uppercase tracking-wider mt-5 mb-2 pb-1 border-b border-slate-200 flex items-center gap-2"
            >
              <span className="w-1 h-3 bg-slate-900 rounded-full inline-block"></span>
              <span>{renderInline(trimmed.slice(4))}</span>
            </h3>
          );
        }

        // 2. Heading 2: ## Heading
        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={bIdx}
              className="text-sm font-bold text-slate-950 uppercase tracking-wider mt-6 mb-2 text-slate-900 border-b border-slate-300 pb-1"
            >
              {renderInline(trimmed.slice(3))}
            </h2>
          );
        }

        // 3. Blockquote: > "..."
        if (trimmed.startsWith("> ")) {
          const quoteBody = trimmed.replace(/^>\s*/, "").replace(/^["“]|["”]$/g, "");
          return (
            <blockquote
              key={bIdx}
              className="my-3 pl-4 pr-3 py-2.5 border-l-2 border-slate-900 bg-slate-50/80 rounded-r-md text-sm italic text-slate-900 leading-relaxed font-normal"
            >
              &ldquo;{renderInline(quoteBody)}&rdquo;
            </blockquote>
          );
        }

        // 4. Numbered List or Bullet List Block
        const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const isNumberedList = lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l));
        const isBulletList = lines.length > 0 && lines.every((l) => /^[-*•]\s+/.test(l));

        if (isNumberedList) {
          return (
            <div key={bIdx} className="space-y-2.5 my-3 pl-1">
              {lines.map((line, lIdx) => {
                const numMatch = line.match(/^(\d+)\.\s+(.*)/);
                const num = numMatch ? numMatch[1] : `${lIdx + 1}`;
                const rest = numMatch ? numMatch[2] : line;

                return (
                  <div key={lIdx} className="flex items-start gap-3 text-slate-800">
                    <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md bg-slate-900 text-white text-[10px] font-bold mt-0.5 shadow-2xs">
                      {num}
                    </span>
                    <div className="flex-1 text-sm leading-relaxed">{renderInline(rest)}</div>
                  </div>
                );
              })}
            </div>
          );
        }

        if (isBulletList) {
          return (
            <div key={bIdx} className="space-y-2 my-2.5 pl-1">
              {lines.map((line, lIdx) => {
                const rest = line.replace(/^[-*•]\s+/, "");
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 text-slate-800">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-slate-900 mt-2"></span>
                    <div className="flex-1 text-sm leading-relaxed">{renderInline(rest)}</div>
                  </div>
                );
              })}
            </div>
          );
        }

        // 5. Special Lead Highlight: If this is the very first paragraph and defines the section/proposal/term
        const isLeadDefinition =
          bIdx === 0 &&
          (/(?:is defined as|defined under|according to section|under section|means and includes)\b/i.test(
            trimmed
          ) ||
            trimmed.includes('"When one person signifies') ||
            trimmed.includes("signifies to another his willingness"));

        if (isLeadDefinition) {
          return (
            <div
              key={bIdx}
              className="p-4 rounded-lg bg-slate-50 border-l-3 border-slate-900 border-y border-r border-slate-200 text-slate-950 my-2 shadow-2xs"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold tracking-wider text-slate-700 uppercase bg-slate-200/90 px-2 py-0.5 rounded">
                  Statutory Provision
                </span>
              </div>
              <div className="text-sm leading-relaxed text-slate-900 font-normal">
                {renderInline(trimmed)}
              </div>
            </div>
          );
        }

        // 6. Mixed paragraph with sub-numbered items
        const hasSubList = lines.some((l) => /^\d+\.\s+/.test(l));
        if (hasSubList) {
          const introLines: string[] = [];
          const listLines: string[] = [];
          let startedList = false;

          for (const l of lines) {
            if (/^\d+\.\s+/.test(l)) {
              startedList = true;
              listLines.push(l);
            } else if (!startedList) {
              introLines.push(l);
            } else {
              listLines.push(l);
            }
          }

          return (
            <div key={bIdx} className="space-y-2.5 my-2.5">
              {introLines.length > 0 && (
                <p className="font-semibold text-slate-950 text-sm">
                  {renderInline(introLines.join(" "))}
                </p>
              )}
              <div className="space-y-2.5 pl-1">
                {listLines.map((line, lIdx) => {
                  const numMatch = line.match(/^(\d+)\.\s+(.*)/);
                  const num = numMatch ? numMatch[1] : `${lIdx + 1}`;
                  const rest = numMatch ? numMatch[2] : line;

                  return (
                    <div key={lIdx} className="flex items-start gap-3 text-slate-800">
                      <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md bg-slate-900 text-white text-[10px] font-bold mt-0.5 shadow-2xs">
                        {num}
                      </span>
                      <div className="flex-1 text-sm leading-relaxed">{renderInline(rest)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // 7. Regular paragraph
        return (
          <p key={bIdx} className="my-1.5 text-slate-800 text-sm leading-relaxed">
            {renderInline(trimmed)}
            {bIdx === rawBlocks.length - 1 && isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-slate-900 animate-pulse rounded-xs align-middle" />
            )}
          </p>
        );
      })}
    </div>
  );
}
