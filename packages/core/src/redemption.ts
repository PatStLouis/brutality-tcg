import crypto from "node:crypto";
import { getDb } from "./db";
import { appendEvent, appendEvents } from "./ledger";
import { canonicalize } from "./canonical";
import { sha256DigestMultibase } from "./ledger";
import { getSet, OG_SET, type CardDef, type Rarity, type SetDef, RARITIES } from "./cards";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface Collector {
  discordId: string;
  publicId: string;
  displayName: string | null;
}

export interface RedemptionRecord {
  redemptionId: string;
  token: string;
  publicId: string;
  setId: string;
  cardIds: string[];
  nonce: string;
  commitment: string;
  status: "pending" | "opened" | "expired";
  createdTs: string;
  expiresTs: string;
  openedTs: string | null;
}

/** Finds or creates a collector, keyed by Discord user id. */
export function ensureCollector(discordId: string, displayName?: string): Collector {
  const db = getDb();
  const existing = db
    .prepare("SELECT discord_id, public_id, display_name FROM collectors WHERE discord_id = ?")
    .get(discordId) as { discord_id: string; public_id: string; display_name: string | null } | undefined;
  if (existing) {
    if (displayName && displayName !== existing.display_name) {
      db.prepare("UPDATE collectors SET display_name = ? WHERE discord_id = ?").run(
        displayName,
        discordId
      );
    }
    return {
      discordId: existing.discord_id,
      publicId: existing.public_id,
      displayName: displayName ?? existing.display_name,
    };
  }

  const opaqueId = `c_${crypto.randomBytes(8).toString("hex")}`;
  const publicId = `urn:brutality:tcg:Collector:${opaqueId}`;
  // Ledger (source of truth) first, then the private mapping + cache row.
  appendEvent("collector_created", opaqueId, { collector: publicId });
  db.transaction(() => {
    db.prepare(
      "INSERT INTO collectors (discord_id, public_id, display_name, created_ts) VALUES (?, ?, ?, ?)"
    ).run(discordId, publicId, displayName ?? null, new Date().toISOString());
    db.prepare(
      "INSERT INTO credit_balances (public_id, available, reserved) VALUES (?, 0, 0)"
    ).run(publicId);
  })();
  return { discordId, publicId, displayName: displayName ?? null };
}

export function collectorByDiscordId(discordId: string): Collector | null {
  const row = getDb()
    .prepare("SELECT discord_id, public_id, display_name FROM collectors WHERE discord_id = ?")
    .get(discordId) as { discord_id: string; public_id: string; display_name: string | null } | undefined;
  return row
    ? { discordId: row.discord_id, publicId: row.public_id, displayName: row.display_name }
    : null;
}

export function collectorByPublicId(publicId: string): Collector | null {
  const row = getDb()
    .prepare("SELECT discord_id, public_id, display_name FROM collectors WHERE public_id = ?")
    .get(publicId) as { discord_id: string; public_id: string; display_name: string | null } | undefined;
  return row
    ? { discordId: row.discord_id, publicId: row.public_id, displayName: row.display_name }
    : null;
}

export function creditBalance(publicId: string): { available: number; reserved: number } {
  const row = getDb()
    .prepare("SELECT available, reserved FROM credit_balances WHERE public_id = ?")
    .get(publicId) as { available: number; reserved: number } | undefined;
  return row ?? { available: 0, reserved: 0 };
}

export function grantCredits(discordId: string, packs: number, reason: string): Collector {
  if (!Number.isInteger(packs) || packs <= 0) throw new Error("packs must be a positive integer");
  const db = getDb();
  const collector = ensureCollector(discordId);
  appendEvent("credits_granted", crypto.randomUUID(), {
    collector: collector.publicId,
    packs,
    reason,
  });
  db.prepare("UPDATE credit_balances SET available = available + ? WHERE public_id = ?").run(
    packs,
    collector.publicId
  );
  return collector;
}

/** Weighted server-side pull. Rarity first, then uniform within rarity. */
function drawCards(set: SetDef): CardDef[] {
  const byRarity = new Map<Rarity, CardDef[]>();
  for (const r of RARITIES) {
    const pool = set.cards.filter((c) => c.rarity === r);
    if (pool.length > 0) byRarity.set(r, pool);
  }
  const weighted = RARITIES.filter((r) => byRarity.has(r)).map((r) => ({
    rarity: r,
    weight: set.rarityWeights[r],
  }));
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  const cards: CardDef[] = [];
  for (let i = 0; i < set.packSize; i++) {
    let roll = crypto.randomInt(totalWeight);
    let rarity = weighted[weighted.length - 1].rarity;
    for (const w of weighted) {
      if (roll < w.weight) {
        rarity = w.rarity;
        break;
      }
      roll -= w.weight;
    }
    const pool = byRarity.get(rarity)!;
    cards.push(pool[crypto.randomInt(pool.length)]);
  }
  return cards;
}

export function computeCommitment(
  redemptionId: string,
  set: string,
  setVersion: number,
  cards: string[],
  nonce: string
): string {
  return sha256DigestMultibase(canonicalize({ redemptionId, set, setVersion, cards, nonce }));
}

export type RedeemResult =
  | { ok: true; redemption: RedemptionRecord; url: string }
  | { ok: false; reason: "no_credits" };

/**
 * Atomically reserves one pack credit, draws the pull server-side, and records
 * a commitment to it. Cards stay hidden until the pack is opened.
 */
export function redeemPack(discordId: string, baseUrl: string, setId = OG_SET.setId): RedeemResult {
  const db = getDb();
  const collector = ensureCollector(discordId);
  const set = getSet(setId);

  const redemptionId = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("base64url");
  const nonce = crypto.randomBytes(16).toString("hex");
  const cards = drawCards(set);
  const cardIds = cards.map((c) => c.cardId);
  const commitment = computeCommitment(redemptionId, set.setId, set.version, cardIds, nonce);
  const createdTs = new Date().toISOString();
  const expiresTs = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  // Reserve the credit and persist the (secret) pull in one SQLite txn. The
  // conditional UPDATE is the atomic double-spend guard; secrets are stored
  // before the ledger append so any committed redemption can always be opened.
  const reserved = db.transaction((): boolean => {
    const res = db
      .prepare(
        "UPDATE credit_balances SET available = available - 1, reserved = reserved + 1 WHERE public_id = ? AND available > 0"
      )
      .run(collector.publicId);
    if (res.changes === 0) return false;
    db.prepare(
      `INSERT INTO redemptions
        (redemption_id, token, public_id, set_id, card_ids, nonce, commitment, status, created_ts, expires_ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      redemptionId,
      token,
      collector.publicId,
      set.setId,
      JSON.stringify(cardIds),
      nonce,
      commitment,
      createdTs,
      expiresTs
    );
    return true;
  })();

  if (!reserved) return { ok: false, reason: "no_credits" };

  try {
    appendEvents([
      {
        type: "credit_reserved",
        domainId: redemptionId,
        payload: { collector: collector.publicId },
      },
      {
        type: "redemption_committed",
        domainId: redemptionId,
        payload: {
          collector: collector.publicId,
          set: set.setId,
          setVersion: set.version,
          packSize: set.packSize,
          commitment,
        },
      },
    ]);
  } catch (err) {
    // Ledger append failed: undo the SQLite reservation so cache matches ledger.
    db.transaction(() => {
      db.prepare(
        "UPDATE credit_balances SET available = available + 1, reserved = reserved - 1 WHERE public_id = ?"
      ).run(collector.publicId);
      db.prepare("DELETE FROM redemptions WHERE redemption_id = ?").run(redemptionId);
    })();
    throw err;
  }

  const redemption: RedemptionRecord = {
    redemptionId,
    token,
    publicId: collector.publicId,
    setId: set.setId,
    cardIds,
    nonce,
    commitment,
    status: "pending",
    createdTs,
    expiresTs,
    openedTs: null,
  };
  return { ok: true, redemption, url: `${baseUrl}/open/${token}` };
}

function rowToRedemption(row: Record<string, unknown>): RedemptionRecord {
  return {
    redemptionId: row.redemption_id as string,
    token: row.token as string,
    publicId: row.public_id as string,
    setId: row.set_id as string,
    cardIds: JSON.parse(row.card_ids as string),
    nonce: row.nonce as string,
    commitment: row.commitment as string,
    status: row.status as RedemptionRecord["status"],
    createdTs: row.created_ts as string,
    expiresTs: row.expires_ts as string,
    openedTs: (row.opened_ts as string) ?? null,
  };
}

export function redemptionByToken(token: string): RedemptionRecord | null {
  const row = getDb().prepare("SELECT * FROM redemptions WHERE token = ?").get(token) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToRedemption(row) : null;
}

export type OpenResult =
  | { status: "opened"; redemption: RedemptionRecord; firstOpen: boolean }
  | { status: "expired" }
  | { status: "not_found" };

/**
 * First successful call finalizes the pack: reveals the committed cards,
 * appends the ledger event, and updates holdings. Idempotent afterwards.
 */
export function openPack(token: string): OpenResult {
  const db = getDb();

  const row = db.prepare("SELECT * FROM redemptions WHERE token = ?").get(token) as
    | Record<string, unknown>
    | undefined;
  if (!row) return { status: "not_found" };
  const redemption = rowToRedemption(row);

  if (redemption.status === "opened") {
    return { status: "opened", redemption, firstOpen: false };
  }
  if (redemption.status === "expired") return { status: "expired" };

  if (new Date(redemption.expiresTs).getTime() < Date.now()) {
    // Ledger first: a crash after append is repaired by rebuildCache on boot.
    appendEvents([
      {
        type: "redemption_expired",
        domainId: redemption.redemptionId,
        payload: { collector: redemption.publicId },
      },
      {
        type: "credit_released",
        domainId: redemption.redemptionId,
        payload: { collector: redemption.publicId },
      },
    ]);
    db.transaction(() => {
      db.prepare("UPDATE redemptions SET status = 'expired' WHERE redemption_id = ?").run(
        redemption.redemptionId
      );
      db.prepare(
        "UPDATE credit_balances SET reserved = reserved - 1, available = available + 1 WHERE public_id = ?"
      ).run(redemption.publicId);
    })();
    return { status: "expired" };
  }

  const openedTs = new Date().toISOString();
  appendEvent("pack_opened", redemption.redemptionId, {
    collector: redemption.publicId,
    set: redemption.setId,
    cards: redemption.cardIds,
    nonce: redemption.nonce,
    commitment: redemption.commitment,
  });
  db.transaction(() => {
    db.prepare(
      "UPDATE redemptions SET status = 'opened', opened_ts = ? WHERE redemption_id = ?"
    ).run(openedTs, redemption.redemptionId);
    db.prepare("UPDATE credit_balances SET reserved = reserved - 1 WHERE public_id = ?").run(
      redemption.publicId
    );
    for (const cardId of redemption.cardIds) {
      db.prepare(
        `INSERT INTO holdings (public_id, card_id, quantity) VALUES (?, ?, 1)
         ON CONFLICT(public_id, card_id) DO UPDATE SET quantity = quantity + 1`
      ).run(redemption.publicId, cardId);
    }
  })();

  return {
    status: "opened",
    redemption: { ...redemption, status: "opened", openedTs },
    firstOpen: true,
  };
}
