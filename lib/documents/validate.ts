import path from "node:path";

export const MAX_FILE_SIZE = 25 * 1024 * 1024;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class UploadError extends Error {
  constructor(
    public code: "INVALID_FILE_TYPE" | "FILE_TOO_LARGE" | "UPLOAD_FAILED",
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type DocumentType = "pdf" | "docx";

export async function validateUpload(file: File): Promise<{ type: DocumentType; buffer: Buffer; name: string }> {
  if (file.size === 0) throw new UploadError("UPLOAD_FAILED", "The file is empty.", 400);
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError("FILE_TOO_LARGE", "Files must be 25 MB or smaller.", 413);
  }

  const ext = path.extname(file.name).toLowerCase();
  const type: DocumentType | null = ext === ".pdf" ? "pdf" : ext === ".docx" ? "docx" : null;
  const mime = file.type;
  const mimeOk =
    mime === "" || mime === "application/octet-stream" ||
    (type === "pdf" && mime === "application/pdf") || (type === "docx" && mime === DOCX_MIME);
  if (!type || !mimeOk) {
    throw new UploadError("INVALID_FILE_TYPE", "Only PDF and DOCX files are supported.", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // The extension and MIME type are client-controlled; the file signature is not.
  const signatureOk =
    type === "pdf"
      ? buffer.subarray(0, 5).toString("latin1") === "%PDF-"
      : buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (!signatureOk) {
    throw new UploadError("INVALID_FILE_TYPE", "This file does not look like a valid PDF or DOCX.", 400);
  }

  // The stored name is display-only; storage keys are generated, never taken from the user.
  const name = path.basename(file.name).replace(/[\u0000-\u001f]/g, "").slice(0, 200);
  return { type, buffer, name };
}
