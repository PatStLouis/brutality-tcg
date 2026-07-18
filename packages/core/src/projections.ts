import { getDb } from "./db";
import { listEvents } from "./ledger";

export interface Holding {
  cardId: string;
  quantity: number;
}

/** Personal binder contents from the materialized projection. */
export function holdingsFor(publicId: string): Holding[] {
  const rows = getDb()
    .prepare(
      "SELECT card_id, quantity FROM holdings WHERE public_id = ? AND quantity > 0 ORDER BY card_id"
    )
    .all(publicId) as Array<{ card_id: string; quantity: number }>;
  return rows.map((r) => ({ cardId: r.card_id, quantity: r.quantity }));
}

export interface GlobalCardStats {
  cardId: string;
  totalCirculation: number;
  distinctOwners: number;
}

/** Global binder aggregates from the materialized projection. */
export function globalStats(): GlobalCardStats[] {
  const rows = getDb()
    .prepare(
      `SELECT card_id, SUM(quantity) AS total, COUNT(DISTINCT public_id) AS owners
       FROM holdings WHERE quantity > 0 GROUP BY card_id ORDER BY card_id`
    )
    .all() as Array<{ card_id: string; total: number; owners: number }>;
  return rows.map((r) => ({
    cardId: r.card_id,
    totalCirculation: r.total,
    distinctOwners: r.owners,
  }));
}

export interface ReplayState {
  credits: Map<string, { available: number; reserved: number }>;
  holdings: Map<string, Map<string, number>>;
}

/**
 * Rebuilds credit balances and holdings purely from ledger events.
 * Used by the verifier to prove projections match the ledger.
 */
export function replayLedger(): ReplayState {
  const credits = new Map<string, { available: number; reserved: number }>();
  const holdings = new Map<string, Map<string, number>>();

  const bal = (c: string) => {
    if (!credits.has(c)) credits.set(c, { available: 0, reserved: 0 });
    return credits.get(c)!;
  };

  let afterSeq = 0;
  for (;;) {
    const batch = listEvents(afterSeq, 1000);
    if (batch.length === 0) break;
    for (const e of batch) {
      const p = e.payload as Record<string, any>;
      switch (e.type) {
        case "collector_created":
          bal(p.collector);
          break;
        case "credits_granted":
          bal(p.collector).available += p.packs;
          break;
        case "credit_reserved": {
          const b = bal(p.collector);
          b.available -= 1;
          b.reserved += 1;
          break;
        }
        case "credit_released": {
          const b = bal(p.collector);
          b.available += 1;
          break;
        }
        case "redemption_expired": {
          bal(p.collector).reserved -= 1;
          break;
        }
        case "pack_opened": {
          bal(p.collector).reserved -= 1;
          if (!holdings.has(p.collector)) holdings.set(p.collector, new Map());
          const h = holdings.get(p.collector)!;
          for (const cardId of p.cardIds as string[]) {
            h.set(cardId, (h.get(cardId) ?? 0) + 1);
          }
          break;
        }
        default:
          break;
      }
      afterSeq = e.seq;
    }
  }

  return { credits, holdings };
}

export interface ProjectionCheck {
  ok: boolean;
  errors: string[];
}

/** Compares replayed state against the materialized tables. */
export function checkProjections(): ProjectionCheck {
  const db = getDb();
  const errors: string[] = [];
  const replayed = replayLedger();

  const balances = db
    .prepare("SELECT public_id, available, reserved FROM credit_balances")
    .all() as Array<{ public_id: string; available: number; reserved: number }>;
  for (const b of balances) {
    const r = replayed.credits.get(b.public_id) ?? { available: 0, reserved: 0 };
    if (r.available !== b.available || r.reserved !== b.reserved) {
      errors.push(
        `credits mismatch for ${b.public_id}: table ${b.available}/${b.reserved}, replay ${r.available}/${r.reserved}`
      );
    }
  }

  const held = db
    .prepare("SELECT public_id, card_id, quantity FROM holdings WHERE quantity > 0")
    .all() as Array<{ public_id: string; card_id: string; quantity: number }>;
  for (const h of held) {
    const q = replayed.holdings.get(h.public_id)?.get(h.card_id) ?? 0;
    if (q !== h.quantity) {
      errors.push(
        `holding mismatch for ${h.public_id}/${h.card_id}: table ${h.quantity}, replay ${q}`
      );
    }
  }
  for (const [publicId, cards] of replayed.holdings) {
    for (const [cardId, q] of cards) {
      const row = held.find((h) => h.public_id === publicId && h.card_id === cardId);
      if (!row && q > 0) {
        errors.push(`holding missing from table: ${publicId}/${cardId} (replay ${q})`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
