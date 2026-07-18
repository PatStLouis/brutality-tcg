import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "brutality_session";
const MAX_AGE_S = 30 * 24 * 60 * 60;

export interface Session {
  discordId: string;
  username: string;
  exp: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s === "change-me") {
    // Dev fallback keeps local demos working; production must set a secret.
    return "brutality-dev-session-secret";
  }
  return s;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeSession(session: Session): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(value: string): Session | null {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return value ? decodeSession(value) : null;
}

export function sessionCookie(session: Session): {
  name: string;
  value: string;
  options: Record<string, unknown>;
} {
  return {
    name: COOKIE_NAME,
    value: encodeSession(session),
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_S,
    },
  };
}

export function clearedSessionCookie(): {
  name: string;
  value: string;
  options: Record<string, unknown>;
} {
  return {
    name: COOKIE_NAME,
    value: "",
    options: { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 },
  };
}

export function newSession(discordId: string, username: string): Session {
  return { discordId, username, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S };
}
