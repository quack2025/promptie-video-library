import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "inspira_session";
const AUTH_SECRET = process.env.AUTH_SECRET || "inspira-default-secret-change-me";

async function verify(signed: string): Promise<string | null> {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.substring(0, lastDot);
  const signature = signed.substring(lastDot + 1);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected === signature) return value;
  return null;
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (!cookie) return false;
  return (await verify(cookie)) !== null;
}

export async function middleware(request: NextRequest) {
  // Skip auth if AUTH_USERS is not configured
  if (!process.env.AUTH_USERS) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow login page and login API
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/logout") {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (!(await isAuthenticated(request))) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
