"use client";

import { useRef, useState, type DragEvent } from "react";
import { UploadIcon, AlertCircleIcon } from "./Icons";

const ACCEPT = ".pdf,.docx";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export function DocumentUpload({ onUploaded }: { onUploaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large. Contracts must be 25 MB or smaller.");
      return;
    }

    setIsUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/documents/upload", { method: "POST", body });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Upload failed.");
      } else {
        onUploaded();
      }
    } catch {
      setError("The upload failed. Check your connection and try again.");
    } finally {
      setIsUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Choose a contract to upload"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex items-center gap-3 p-1 rounded-lg transition-all ${
          isDragging ? "bg-slate-100 border-slate-400" : ""
        }`}
      >
        <button
          type="button"
          disabled={isUploading}
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-60 transition cursor-pointer"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Uploading & Processing…</span>
            </>
          ) : (
            <>
              <UploadIcon className="h-4 w-4 text-slate-300" />
              <span>Upload Contract</span>
            </>
          )}
        </button>
        <span className="text-xs text-slate-500 hidden sm:inline font-medium">PDF or DOCX (max 25MB)</span>
      </div>

      {error && (
        <div role="alert" className="mt-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 flex items-center gap-1.5">
          <AlertCircleIcon className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
