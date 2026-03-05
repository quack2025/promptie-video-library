import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const AUTH_COOKIE = "inspira_session";
const AUTH_SECRET = process.env.AUTH_SECRET || "inspira-default-secret-change-me";

function getUsers(): Map<string, string> {
  const users = new Map<string, string>();
  const raw = process.env.AUTH_USERS || "";
  for (const entry of raw.split(",")) {
    const [username, password] = entry.split(":");
    if (username && password) {
      users.set(username.trim(), password.trim());
    }
  }
  return users;
}

function sign(value: string): string {
  const hmac = crypto.createHmac("sha256", AUTH_SECRET);
  hmac.update(value);
  return value + "." + hmac.digest("hex");
}

function verify(signed: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.substring(0, lastDot);
  if (sign(value) === signed) return value;
  return null;
}

export function validateCredentials(username: string, password: string): boolean {
  const users = getUsers();
  return users.get(username) === password;
}

export function createSessionCookie(username: string): string {
  const payload = JSON.stringify({ user: username, ts: Date.now() });
  return sign(Buffer.from(payload).toString("base64"));
}

export function getSessionUser(request: NextRequest): string | null {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (!cookie) return null;
  const value = verify(cookie);
  if (!value) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, "base64").toString());
    return payload.user || null;
  } catch {
    return null;
  }
}

export function isAuthEnabled(): boolean {
  return !!process.env.AUTH_USERS;
}

export { AUTH_COOKIE };
