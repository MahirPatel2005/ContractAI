import type { NextRequest } from "next/server";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { PageTextItem } from "@/lib/documents/pdf";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const citation = await prisma.citation.findUnique({
      where: { id },
      include: {
        document: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!citation) return fail("NOT_FOUND", "Citation not found.", 404);

    // Fetch the page to compute coordinates if available
    const page = await prisma.page.findUnique({
      where: {
        documentId_pageNumber: {
          documentId: citation.documentId,
          pageNumber: citation.pageNumber,
        },
      },
    });

    const rectangles: HighlightRect[] = [];
    if (page?.items && Array.isArray(page.items)) {
      const items = page.items as unknown as PageTextItem[];
      const pageRelStart = Math.max(0, citation.startOffset - page.startOffset);
      const pageRelEnd = citation.endOffset - page.startOffset;

      for (const item of items) {
        if (typeof item.start === "number" && typeof item.end === "number") {
          if (item.end > pageRelStart && item.start < pageRelEnd) {
            rectangles.push({
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
            });
          }
        }
      }
    }

    return ok({
      citationId: citation.id,
      documentId: citation.documentId,
      documentName: citation.document.name,
      pageNumber: citation.pageNumber,
      startOffset: citation.startOffset,
      endOffset: citation.endOffset,
      quote: citation.quote,
      verified: citation.verified,
      rectangles,
    });
  } catch (error) {
    return handleError(error, "get_citation");
  }
}
