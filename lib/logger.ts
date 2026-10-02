interface LogEntry {
  operation: string;
  documentId?: string;
  status?: string;
  errorCode?: string;
  durationMs?: number;
  error?: unknown;
}

// Metadata only. Contract text, prompts and credentials must never be logged.
function write(level: "info" | "error", entry: LogEntry) {
  const { error, ...rest } = entry;
  const detail = error instanceof Error ? { errorName: error.name, errorMessage: error.message.slice(0, 200) } : {};
  console[level](JSON.stringify({ level, ...rest, ...detail }));
}

export const logger = {
  info: (entry: LogEntry) => write("info", entry),
  error: (entry: LogEntry) => write("error", entry),
};
