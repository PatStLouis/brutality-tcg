import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const base = process.env.BASE_URL ?? new URL(request.url).origin;
  if (!clientId) {
    return NextResponse.json(
      { error: "DISCORD_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }
  const redirectUri = `${base}/api/auth/callback`;
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  return NextResponse.redirect(url);
}
