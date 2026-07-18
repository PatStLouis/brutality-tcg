import { getDb } from "./db";
import { listEvents, eventTypeOf, domainSuffixOf } from "./ledger";

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

  for (const e of listEvents(0)) {
    const p = e.payload as Record<string, any>;
    switch (eventTypeOf(e)) {
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
        for (const cardId of p.cards as string[]) {
          h.set(cardId, (h.get(cardId) ?? 0) + 1);
        }
        break;
      }
      default:
        break;
    }
  }

  return { credits, holdings };
}

/**
 * Rebuilds the SQLite projection cache (credit_balances, holdings) from the
 * canonical ledger. Also reconciles redemption working state against the
 * ledger: pending redemptions with no committed event are voided, and
 * redemptions the ledger marks opened/expired are updated to match.
 */
export function rebuildCache(): void {
  const db = getDb();
  const replayed = replayLedger();

  const committed = new Set<string>();
  const opened = new Set<string>();
  const expired = new Set<string>();
  for (const e of listEvents(0)) {
    const t = eventTypeOf(e);
    // For redemption lifecycle events the redemptionId is the payload @id suffix.
    const redemptionId = domainSuffixOf(e.payload);
    if (!redemptionId) continue;
    if (t === "redemption_committed") committed.add(redemptionId);
    else if (t === "pack_opened") opened.add(redemptionId);
    else if (t === "redemption_expired") expired.add(redemptionId);
  }

  db.transaction(() => {
    db.prepare("DELETE FROM credit_balances").run();
    db.prepare("DELETE FROM holdings").run();

    const insertBalance = db.prepare(
      "INSERT INTO credit_balances (public_id, available, reserved) VALUES (?, ?, ?)"
    );
    for (const [publicId, bal] of replayed.credits) {
      insertBalance.run(publicId, bal.available, bal.reserved);
    }
    const insertHolding = db.prepare(
      "INSERT INTO holdings (public_id, card_id, quantity) VALUES (?, ?, ?)"
    );
    for (const [publicId, cards] of replayed.holdings) {
      for (const [cardId, quantity] of cards) {
        if (quantity > 0) insertHolding.run(publicId, cardId, quantity);
      }
    }

    // Reconcile redemption working state with the ledger. Credits/holdings were
    // already rebuilt above; this only repairs the private redemptions table.
    const redemptions = db
      .prepare("SELECT redemption_id, status FROM redemptions")
      .all() as Array<{ redemption_id: string; status: string }>;
    for (const r of redemptions) {
      if (opened.has(r.redemption_id)) {
        if (r.status !== "opened") {
          db.prepare("UPDATE redemptions SET status = 'opened' WHERE redemption_id = ?").run(
            r.redemption_id
          );
        }
      } else if (expired.has(r.redemption_id)) {
        if (r.status !== "expired") {
          db.prepare("UPDATE redemptions SET status = 'expired' WHERE redemption_id = ?").run(
            r.redemption_id
          );
        }
      } else if (!committed.has(r.redemption_id)) {
        // Crash between SQLite write and ledger append: no committed event, so
        // the redemption never really happened. Drop the orphan.
        db.prepare("DELETE FROM redemptions WHERE redemption_id = ?").run(r.redemption_id);
      } else if (r.status !== "pending") {
        // Ledger still shows the pack as committed (not opened/expired), but
        // SQLite was advanced before a crashed ledger append. Reset so the
        // user can open (or expire) again.
        db.prepare(
          "UPDATE redemptions SET status = 'pending', opened_ts = NULL WHERE redemption_id = ?"
        ).run(r.redemption_id);
      }
    }
  })();
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
