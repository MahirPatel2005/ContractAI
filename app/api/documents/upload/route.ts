import { randomUUID } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { processDocument } from "@/lib/documents/pipeline";
import { saveDocumentFile } from "@/lib/documents/storage";
import { UploadError, validateUpload } from "@/lib/documents/validate";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return fail("UPLOAD_FAILED", "Choose a PDF or DOCX file to upload.", 400);

    const { type, buffer, name } = await validateUpload(file);
    const storageKey = randomUUID();
    await saveDocumentFile(storageKey, type, buffer);
    const doc = await prisma.document.create({ data: { name, type, storageKey } });

    // Respond immediately; the UI polls GET /api/documents for stage-by-stage status.
    after(() => processDocument(doc.id, buffer, type));
    return ok({ documentId: doc.id, status: "queued" }, 201);
  } catch (error) {
    if (error instanceof TypeError) return handleError(new UploadError("UPLOAD_FAILED", "The upload could not be read.", 400), "upload");
    return handleError(error, "upload");
  }
}
