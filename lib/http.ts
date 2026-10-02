import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiOutputError } from "@/lib/ai/answer";
import { AiProviderError } from "@/lib/ai/gemini";
import { DocumentScopeError } from "@/lib/documents/store";
import { UploadError } from "@/lib/documents/validate";
import { logger } from "@/lib/logger";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** Maps known failures to safe messages. Stack traces and provider details never reach the client. */
export function handleError(error: unknown, operation: string) {
  if (error instanceof UploadError) return fail(error.code, error.message, error.status);
  if (error instanceof DocumentScopeError) return fail(error.code, error.message, error.status);
  if (error instanceof ZodError) return fail("INVALID_INPUT", "The request was not valid.", 400);
  if (error instanceof AiProviderError) {
    logger.error({ operation, errorCode: "AI_PROVIDER", error });
    return fail("AI_PROVIDER_ERROR", error.message, error.status);
  }
  if (error instanceof AiOutputError) {
    logger.error({ operation, errorCode: "AI_OUTPUT", error });
    return fail("AI_OUTPUT_ERROR", error.message, 502);
  }
  logger.error({ operation, errorCode: "INTERNAL", error });
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}
