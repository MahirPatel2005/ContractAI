"use client";

import React from "react";

interface FormattedMessageProps {
  content: string;
  isStreaming?: boolean;
}

type MarkdownBlock =
  | { type: "h1" | "h2" | "h3" | "h4"; text: string }
  | { type: "hr" }
  | { type: "blockquote"; text: string }
  | { type: "bullet-list"; items: string[] }
  | { type: "numbered-list"; items: { num: string; text: string }[] }
  | { type: "paragraph"; text: string };

/**
 * Parses markdown text into discrete block elements.
 * Prevents headings from swallowing subsequent paragraphs or enforcing unwanted all-caps/bold styling.
 */
function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let currentBlock: MarkdownBlock | null = null;

  const flush = () => {
    if (currentBlock) {
      blocks.push(currentBlock);
      currentBlock = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Blank line terminates current block
    if (!trimmed) {
      flush();
      continue;
    }

    // 2. Horizontal divider
    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }

    // 3. Headings (Single-line only)
    if (trimmed.startsWith("# ")) {
      flush();
      blocks.push({ type: "h1", text: trimmed.slice(2).trim() });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flush();
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flush();
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() });
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      flush();
      blocks.push({ type: "h4", text: trimmed.slice(5).trim() });
      continue;
    }

    // 4. Blockquotes
    if (trimmed.startsWith("> ")) {
      const bqText = trimmed.replace(/^>\s*/, "");
      if (currentBlock && currentBlock.type === "blockquote") {
        currentBlock.text += " " + bqText;
      } else {
        flush();
        currentBlock = { type: "blockquote", text: bqText };
      }
      continue;
    }

    // 5. Bullet list items: * item, - item, • item (not bolding **)
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);
    if (bulletMatch && !trimmed.startsWith("***")) {
      const itemText = bulletMatch[1].trim();
      if (currentBlock && currentBlock.type === "bullet-list") {
        currentBlock.items.push(itemText);
      } else {
        flush();
        currentBlock = { type: "bullet-list", items: [itemText] };
      }
      continue;
    }

    // 6. Numbered list items: 1. item, 2. item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const itemText = numMatch[2].trim();
      if (currentBlock && currentBlock.type === "numbered-list") {
        currentBlock.items.push({ num, text: itemText });
      } else {
        flush();
        currentBlock = { type: "numbered-list", items: [{ num, text: itemText }] };
      }
      continue;
    }

    // 7. Indented continuation of list items
    if (
      (rawLine.startsWith("  ") || rawLine.startsWith("\t")) &&
      currentBlock &&
      (currentBlock.type === "bullet-list" || currentBlock.type === "numbered-list")
    ) {
      if (currentBlock.type === "bullet-list") {
        const lastIdx = currentBlock.items.length - 1;
        currentBlock.items[lastIdx] += " " + trimmed;
      } else {
        const lastIdx = currentBlock.items.length - 1;
        currentBlock.items[lastIdx].text += " " + trimmed;
      }
      continue;
    }

    // 8. Regular paragraph
    if (currentBlock && currentBlock.type === "paragraph") {
      currentBlock.text += " " + trimmed;
    } else {
      flush();
      currentBlock = { type: "paragraph", text: trimmed };
    }
  }

  flush();
  return blocks;
}

/**
 * Parses inline markdown: **bold**, *italic*, `code`.
 * Renders bold selectively with high contrast while keeping prose in normal weight.
 */
function renderInline(text: string): React.ReactNode[] {
  const regex = /(\*\*\*[^\n]+?\*\*\*|\*\*[^\n]+?\*\*|\*[^\n]+?\*|`[^\n]+?`)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith("***") && part.endsWith("***") && part.length >= 6) {
      return (
        <strong key={idx} className="font-semibold italic text-slate-950">
          {part.slice(3, -3)}
        </strong>
      );
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-700">
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

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Formats AI chat responses with modern, clean ChatGPT/Claude-style typography.
 * Natural font-weight narrative prose with selective surgical bolding on key terms.
 */
export function FormattedMessage({ content, isStreaming }: FormattedMessageProps) {
  if (!content) {
    return isStreaming ? (
      <span className="inline-block w-1.5 h-4 bg-slate-900 animate-pulse rounded-xs align-middle" />
    ) : null;
  }

  const blocks = parseMarkdownBlocks(content);

  const streamingCursor = isStreaming ? (
    <span className="inline-block w-1.5 h-4 ml-1 bg-slate-900 animate-pulse rounded-xs align-middle" />
  ) : null;

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-800 font-normal font-sans">
      {blocks.map((block, bIdx) => {
        const isLastBlock = bIdx === blocks.length - 1;

        // Headings (Clean natural casing, never uppercase, no left bar)
        if (block.type === "h1") {
          return (
            <h1 key={bIdx} className="text-base font-semibold text-slate-950 mt-4 mb-2">
              {renderInline(block.text)}
              {isLastBlock && streamingCursor}
            </h1>
          );
        }

        if (block.type === "h2") {
          return (
            <h2 key={bIdx} className="text-sm font-semibold text-slate-950 mt-3.5 mb-1.5">
              {renderInline(block.text)}
              {isLastBlock && streamingCursor}
            </h2>
          );
        }

        if (block.type === "h3") {
          return (
            <h3 key={bIdx} className="text-xs font-semibold text-slate-950 mt-3 mb-1">
              {renderInline(block.text)}
              {isLastBlock && streamingCursor}
            </h3>
          );
        }

        if (block.type === "h4") {
          return (
            <h4 key={bIdx} className="text-xs font-semibold text-slate-900 mt-2 mb-1">
              {renderInline(block.text)}
              {isLastBlock && streamingCursor}
            </h4>
          );
        }

        if (block.type === "hr") {
          return <hr key={bIdx} className="my-3 border-slate-200" />;
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={bIdx}
              className="my-2.5 pl-3.5 border-l-2 border-slate-300 text-slate-700 italic text-sm leading-relaxed"
            >
              {renderInline(block.text)}
              {isLastBlock && streamingCursor}
            </blockquote>
          );
        }

        if (block.type === "bullet-list") {
          return (
            <div key={bIdx} className="space-y-2 my-2 pl-0.5">
              {block.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-slate-800 text-sm leading-relaxed font-normal">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-slate-400 mt-2" />
                  <div className="flex-1">
                    {renderInline(item)}
                    {isLastBlock && idx === block.items.length - 1 && streamingCursor}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "numbered-list") {
          return (
            <div key={bIdx} className="space-y-2 my-2 pl-0.5">
              {block.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-800 text-sm leading-relaxed font-normal">
                  <span className="shrink-0 font-medium text-slate-500 text-xs mt-0.5 min-w-[1.25rem]">
                    {item.num}.
                  </span>
                  <div className="flex-1">
                    {renderInline(item.text)}
                    {isLastBlock && idx === block.items.length - 1 && streamingCursor}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        // Paragraph
        return (
          <p key={bIdx} className="text-slate-800 text-sm leading-relaxed font-normal">
            {renderInline(block.text)}
            {isLastBlock && streamingCursor}
          </p>
        );
      })}
    </div>
  );
}

