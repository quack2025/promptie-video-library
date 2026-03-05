import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "inspira_session";
const AUTH_SECRET = process.env.AUTH_SECRET || "inspira-default-secret-change-me";

async function hmacSign(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(AUTH_SECRET);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const hexSig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return value + "." + hexSig;
}

async function hmacVerify(signed: string): Promise<string | null> {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.substring(0, lastDot);
  const expected = await hmacSign(value);
  if (expected === signed) return value;
  return null;
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (!cookie) return false;
  return (await hmacVerify(cookie)) !== null;
}

export async function middleware(request: NextRequest) {
  if (!process.env.AUTH_USERS) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout"
  ) {
    return NextResponse.next();
  }

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
