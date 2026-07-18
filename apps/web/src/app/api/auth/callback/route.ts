import { NextResponse } from "next/server";
import { ensureCollector, initStore } from "@brutality/core";
import { newSession, sessionCookie } from "@/lib/session";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const base = process.env.BASE_URL ?? requestUrl.origin;
  if (!code) {
    return NextResponse.redirect(`${base}/?auth=missing_code`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Discord OAuth is not configured" }, { status: 500 });
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${base}/api/auth/callback`,
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${base}/?auth=token_error`);
  }
  const token = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) {
    return NextResponse.redirect(`${base}/?auth=user_error`);
  }
  const user = (await userRes.json()) as { id: string; username: string };

  initStore();
  ensureCollector(user.id, user.username);

  const response = NextResponse.redirect(`${base}/binder`);
  const cookie = sessionCookie(newSession(user.id, user.username));
  response.cookies.set(cookie.name, cookie.value, cookie.options as any);
  return response;
}
