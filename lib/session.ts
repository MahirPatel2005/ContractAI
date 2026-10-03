import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "contractai_session";

/**
 * Returns the current anonymous browser session ID or generates a fresh one.
 * Frictionless: no login, no accounts, 100% private to the user's browser.
 */
export async function getSessionId(req?: NextRequest | Request): Promise<{ sessionId: string; isNew: boolean }> {
  // 1. Check custom header (useful for client-side API requests or curl)
  const headerId = req?.headers.get("x-session-id");
  if (headerId && /^sess_[a-zA-Z0-9_-]{8,64}$/.test(headerId)) {
    return { sessionId: headerId, isNew: false };
  }

  // 2. Check Next.js server cookie store
  try {
    const cookieStore = await cookies();
    const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (existing && /^sess_[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return { sessionId: existing, isNew: false };
    }
  } catch {
    // Outside server action / request context
  }

  // 3. Fallback: Parse Cookie header directly from request
  const cookieHeader = req?.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      if (/^sess_[a-zA-Z0-9_-]{8,64}$/.test(decoded)) {
        return { sessionId: decoded, isNew: false };
      }
    }
  }

  // 4. Generate a new secure anonymous session ID
  return { sessionId: `sess_${randomUUID()}`, isNew: true };
}

/**
 * Attaches the persistent session cookie to an HTTP response.
 */
export function attachSessionCookie(response: NextResponse, sessionId: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year persistence
  });
  return response;
}
