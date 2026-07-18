import { getDb } from "./db";
import { ensureCollector } from "./redemption";

export interface PublicCollectorProfile {
  collector: string;
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  updatedTs: string;
}

interface ProfileRow {
  public_id: string;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  updated_ts: string;
}

function rowToProfile(row: ProfileRow): PublicCollectorProfile {
  return {
    collector: row.public_id,
    discordId: row.discord_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    updatedTs: row.updated_ts,
  };
}

export function publicProfileByDiscordId(
  discordId: string
): PublicCollectorProfile | null {
  const row = getDb()
    .prepare("SELECT * FROM public_profiles WHERE discord_id = ?")
    .get(discordId) as ProfileRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function listPublicProfiles(): PublicCollectorProfile[] {
  const rows = getDb()
    .prepare("SELECT * FROM public_profiles ORDER BY display_name, public_id")
    .all() as ProfileRow[];
  return rows.map(rowToProfile);
}

export function publishPublicProfile(input: {
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}): PublicCollectorProfile {
  const collector = ensureCollector(input.discordId, input.displayName);
  const updatedTs = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO public_profiles
        (public_id, discord_id, username, display_name, avatar_url, updated_ts)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(public_id) DO UPDATE SET
         discord_id = excluded.discord_id,
         username = excluded.username,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         updated_ts = excluded.updated_ts`
    )
    .run(
      collector.publicId,
      input.discordId,
      input.username,
      input.displayName,
      input.avatarUrl ?? null,
      updatedTs
    );
  return {
    collector: collector.publicId,
    discordId: input.discordId,
    username: input.username,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl ?? null,
    updatedTs,
  };
}

/** Deletes the current public Discord binding. Ledger ownership is untouched. */
export function unpublishPublicProfile(discordId: string): boolean {
  return (
    getDb()
      .prepare("DELETE FROM public_profiles WHERE discord_id = ?")
      .run(discordId).changes > 0
  );
}
