import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const AUTH_COOKIE = "inspira_session";
const AUTH_SECRET = process.env.AUTH_SECRET || "inspira-default-secret-change-me";

function verify(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.substring(0, lastDot);
  const hmac = crypto.createHmac("sha256", AUTH_SECRET);
  hmac.update(value);
  const expected = value + "." + hmac.digest("hex");
  if (expected === signed) return value;
  return null;
}

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (!cookie) return false;
  return verify(cookie) !== null;
}

export function middleware(request: NextRequest) {
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

  if (!isAuthenticated(request)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
