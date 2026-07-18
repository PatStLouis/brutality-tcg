import { NextResponse } from "next/server";
import {
  initStore,
  publicProfileByDiscordId,
  publishPublicProfile,
  unpublishPublicProfile,
} from "@brutality/core";
import { botAuthorized } from "@/lib/botAuth";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, max);
  return result || null;
}

/** Current opt-in status for a Discord user. */
export async function GET(request: Request) {
  if (!botAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  initStore();
  const discordId = new URL(request.url).searchParams.get("discordId");
  if (!discordId) {
    return NextResponse.json({ error: "discordId required" }, { status: 400 });
  }
  const profile = publicProfileByDiscordId(discordId);
  return NextResponse.json({ public: profile !== null, profile });
}

/** Publishes/updates or removes the current public Discord profile binding. */
export async function POST(request: Request) {
  if (!botAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  initStore();
  const body = (await request.json()) as Record<string, unknown>;
  const discordId = clean(body.discordId, 32);
  const action = body.action;
  if (!discordId || (action !== "public" && action !== "private")) {
    return NextResponse.json(
      { error: "discordId and action (public|private) required" },
      { status: 400 }
    );
  }

  if (action === "private") {
    const changed = unpublishPublicProfile(discordId);
    return NextResponse.json({ public: false, changed });
  }

  const username = clean(body.username, 64);
  const displayName = clean(body.displayName, 128);
  if (!username || !displayName) {
    return NextResponse.json(
      { error: "username and displayName required for public profile" },
      { status: 400 }
    );
  }
  const avatarUrl = clean(body.avatarUrl, 512);
  if (
    avatarUrl &&
    !avatarUrl.startsWith("https://cdn.discordapp.com/") &&
    !avatarUrl.startsWith("https://media.discordapp.net/")
  ) {
    return NextResponse.json({ error: "unsupported avatar URL" }, { status: 400 });
  }

  const profile = publishPublicProfile({
    discordId,
    username,
    displayName,
    avatarUrl,
  });
  return NextResponse.json({ public: true, profile });
}
