import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
} from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const apiUrl = (process.env.WEB_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const apiSecret = process.env.BOT_API_SECRET;
if (!apiSecret) {
  console.error("BOT_API_SECRET is not set. It must match the web service's value.");
  process.exit(1);
}

const eligibleRoleIds = (process.env.ELIGIBLE_ROLE_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const redeemChannelIds = (process.env.REDEEM_CHANNEL_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiSecret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function channelAllowed(message: Message): boolean {
  return redeemChannelIds.length === 0 || redeemChannelIds.includes(message.channelId);
}

async function roleEligible(message: Message): Promise<boolean> {
  if (eligibleRoleIds.length === 0) return true;
  const member = message.member ?? (await message.guild?.members.fetch(message.author.id));
  if (!member) return false;
  return eligibleRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

async function handleRedeem(message: Message) {
  if (!channelAllowed(message)) return;

  if (!(await roleEligible(message))) {
    await message.reply(
      "You need a subscriber role to redeem packs. Link your Patreon/Twitch/YouTube membership to Discord first."
    );
    return;
  }

  const res = await api("/api/internal/redeem", {
    method: "POST",
    body: JSON.stringify({
      discordId: message.author.id,
      displayName: message.member?.displayName ?? message.author.username,
    }),
  });
  if (!res.ok) {
    console.error(`Redeem API error: ${res.status}`);
    await message.reply("The pack service is unavailable right now — try again shortly.");
    return;
  }

  const body = (await res.json()) as { ok: boolean; reason?: string; url?: string };
  if (!body.ok) {
    await message.reply(
      "You have no pack credits right now. Credits come from subscriptions and weekly podcast drops."
    );
    return;
  }

  const link = body.url!;
  try {
    await message.author.send(
      `Your Brutality pack is ready. Open it here (link expires in 24h):\n${link}`
    );
    await message.reply("Pack redeemed — check your DMs for your opening link.");
  } catch {
    // DMs closed; fall back to a channel reply.
    await message.reply(
      `Pack redeemed. Open it here (this link is bound to your account):\n${link}`
    );
  }
}

async function handlePacks(message: Message) {
  const res = await api(
    `/api/internal/packs?discordId=${encodeURIComponent(message.author.id)}`
  );
  if (!res.ok) {
    console.error(`Packs API error: ${res.status}`);
    await message.reply("The pack service is unavailable right now — try again shortly.");
    return;
  }
  const balance = (await res.json()) as { available: number; reserved: number };
  await message.reply(
    `You have ${balance.available} unopened pack credit(s)` +
      (balance.reserved > 0 ? ` and ${balance.reserved} pending opening.` : ".")
  );
}

async function handleProfile(message: Message, action?: string) {
  if (!action) {
    const res = await api(
      `/api/internal/profile?discordId=${encodeURIComponent(message.author.id)}`
    );
    if (!res.ok) {
      console.error(`Profile API error: ${res.status}`);
      await message.reply("The profile service is unavailable right now.");
      return;
    }
    const body = (await res.json()) as {
      public: boolean;
      profile?: { collector: string; displayName: string } | null;
    };
    await message.reply(
      body.public
        ? `Your public profile is enabled as **${body.profile?.displayName}** (${body.profile?.collector}).`
        : "Your public profile is private. Use `!profile public` to opt in."
    );
    return;
  }

  if (action !== "public" && action !== "private") {
    await message.reply("Use `!profile`, `!profile public`, or `!profile private`.");
    return;
  }

  const displayName = message.member?.displayName ?? message.author.displayName;
  const res = await api("/api/internal/profile", {
    method: "POST",
    body: JSON.stringify({
      action,
      discordId: message.author.id,
      username: message.author.username,
      displayName,
      avatarUrl: message.author.displayAvatarURL({ extension: "webp", size: 256 }),
    }),
  });
  if (!res.ok) {
    console.error(`Profile API error: ${res.status}`);
    await message.reply("The profile service is unavailable right now.");
    return;
  }

  if (action === "public") {
    await message.reply(
      "Public profile enabled. Your collector id is now publicly linked to your Discord id, username, display name, and avatar. Use `!profile private` to remove the current listing."
    );
  } else {
    await message.reply(
      "Public profile disabled. The current Discord binding has been removed. Copies previously saved by third parties cannot be recalled."
    );
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();
  try {
    if (content === "!redeem") await handleRedeem(message);
    else if (content === "!packs") await handlePacks(message);
    else if (content === "!profile") await handleProfile(message);
    else if (content.startsWith("!profile ")) {
      await handleProfile(message, content.slice("!profile ".length).trim());
    }
  } catch (err) {
    console.error("Command failed:", err);
    await message.reply("Something went wrong — try again in a moment.").catch(() => {});
  }
});

client.once("ready", () => {
  console.log(`Brutality bot logged in as ${client.user?.tag}`);
  console.log(`Web API: ${apiUrl}`);
  console.log(
    `Eligible roles: ${eligibleRoleIds.length ? eligibleRoleIds.join(", ") : "(any member)"}`
  );
  console.log(
    `Redeem channels: ${redeemChannelIds.length ? redeemChannelIds.join(", ") : "(any channel)"}`
  );
});

client.login(token);
