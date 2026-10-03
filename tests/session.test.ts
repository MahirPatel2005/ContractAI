import { describe, expect, it } from "vitest";
import { getSessionId, attachSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";
import { NextResponse } from "next/server";

describe("Anonymous Session Isolation", () => {
  it("generates a new unique session ID when no session is provided", async () => {
    const { sessionId, isNew } = await getSessionId();
    expect(sessionId).toMatch(/^sess_[a-f0-9-]{36}$/);
    expect(isNew).toBe(true);
  });

  it("extracts session ID from x-session-id header", async () => {
    const existing = "sess_12345678-abcd-ef01-2345-6789abcdef01";
    const req = new Request("http://localhost/api/documents", {
      headers: { "x-session-id": existing },
    });
    const { sessionId, isNew } = await getSessionId(req);
    expect(sessionId).toBe(existing);
    expect(isNew).toBe(false);
  });

  it("extracts session ID from cookie header", async () => {
    const existing = "sess_87654321-dcba-fe10-5432-10fedcba9876";
    const req = new Request("http://localhost/api/documents", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${existing}; other=123` },
    });
    const { sessionId, isNew } = await getSessionId(req);
    expect(sessionId).toBe(existing);
    expect(isNew).toBe(false);
  });

  it("attaches session cookie to response", () => {
    const sessionId = "sess_test1234-5678-90ab-cdef-1234567890ab";
    const res = NextResponse.json({ ok: true });
    attachSessionCookie(res, sessionId);
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe(sessionId);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
  });
});
