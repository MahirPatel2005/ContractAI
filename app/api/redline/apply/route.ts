import type { NextRequest } from "next/server";
import { z } from "zod";
import { loadDocuments } from "@/lib/documents/store";
import { getDocumentFile } from "@/lib/documents/storage";
import { fail, handleError } from "@/lib/http";
import { clientKey, isRateLimited } from "@/lib/rateLimit";
import { applyTrackedChangesToDocx, createDocxWithTrackedChanges } from "@/lib/redline/docxXml";

export const runtime = "nodejs";
export const maxDuration = 60;

const EditSchema = z.object({
  targetText: z.string().min(1),
  revisedText: z.string().min(1),
});

const Body = z.object({
  documentId: z.string().min(1).max(64),
  edits: z.array(EditSchema).min(1).max(20),
});

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`redline-apply:${clientKey(req)}`, 10)) {
      return fail("RATE_LIMITED", "Too many redline download requests. Wait a moment.", 429);
    }

    const { documentId, edits } = Body.parse(await req.json());
    const docs = await loadDocuments([documentId]);
    const doc = docs[0];

    let outputDocxBuffer: Buffer;

    // Check if original was DOCX
    const originalBuffer = await getDocumentFile(documentId, "docx");
    if (originalBuffer) {
      outputDocxBuffer = await applyTrackedChangesToDocx(originalBuffer, edits);
    } else {
      // Build clean DOCX package from stored document text
      outputDocxBuffer = await createDocxWithTrackedChanges(doc.fullText, edits);
    }

    const cleanBaseName = doc.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    const downloadFilename = `redlined-${cleanBaseName}.docx`;
    const encodedFilename = encodeURIComponent(downloadFilename);

    return new Response(new Uint8Array(outputDocxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${downloadFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": outputDocxBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error, "apply_redline");
  }
}
