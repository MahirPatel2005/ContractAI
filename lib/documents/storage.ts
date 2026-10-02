import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_DIR = path.join(process.cwd(), ".storage", "documents");

async function ensureStorageDir(): Promise<string> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  return STORAGE_DIR;
}

function getFilePath(storageKey: string, type: "pdf" | "docx"): string {
  // Sanitize key to prevent path traversal
  const safeKey = storageKey.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(STORAGE_DIR, `${safeKey}.${type}`);
}

export async function saveDocumentFile(storageKey: string, type: "pdf" | "docx", buffer: Buffer): Promise<string> {
  await ensureStorageDir();
  const filePath = getFilePath(storageKey, type);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function getDocumentFile(storageKey: string, type: "pdf" | "docx"): Promise<Buffer | null> {
  try {
    const filePath = getFilePath(storageKey, type);
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

export async function deleteDocumentFile(storageKey: string, type: "pdf" | "docx"): Promise<void> {
  try {
    const filePath = getFilePath(storageKey, type);
    await fs.unlink(filePath);
  } catch {
    // Ignore if file doesn't exist
  }
}
