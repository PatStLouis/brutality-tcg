import crypto from "node:crypto";
import { getDb } from "./db";
import { canonicalize } from "./canonical";
import { getSigningKey } from "./keys";

export const GENESIS_HASH = "0".repeat(64);

export type EventType =
  | "collector_created"
  | "credits_granted"
  | "credit_reserved"
  | "redemption_committed"
  | "pack_opened"
  | "redemption_expired"
  | "credit_released"
  | "admin_correction"
  | "set_published";

export interface LedgerEvent {
  seq: number;
  id: string;
  ts: string;
  type: EventType;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
  sig: string;
  keyId: string;
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** Bytes that are hashed for an event (hash and sig excluded, obviously). */
export function eventHashInput(e: {
  id: string;
  ts: string;
  type: string;
  payload: Record<string, unknown>;
  prevHash: string;
}): string {
  return canonicalize({
    id: e.id,
    ts: e.ts,
    type: e.type,
    payload: e.payload,
    prevHash: e.prevHash,
  });
}

function lastHash(): string {
  const row = getDb()
    .prepare("SELECT hash FROM events ORDER BY seq DESC LIMIT 1")
    .get() as { hash: string } | undefined;
  return row?.hash ?? GENESIS_HASH;
}

/**
 * Appends a signed event to the hash chain. Callers are expected to wrap this
 * together with their projection updates in a single transaction.
 */
export function appendEvent(
  type: EventType,
  payload: Record<string, unknown>
): LedgerEvent {
  const db = getDb();
  const key = getSigningKey();

  const id = crypto.randomUUID();
  const ts = new Date().toISOString();
  const prevHash = lastHash();
  const hash = sha256Hex(eventHashInput({ id, ts, type, payload, prevHash }));
  const sig = crypto.sign(null, Buffer.from(hash, "hex"), key.privateKey).toString("base64");

  const info = db
    .prepare(
      `INSERT INTO events (id, ts, type, payload, prev_hash, hash, sig, key_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, ts, type, canonicalize(payload), prevHash, hash, sig, key.keyId);

  return {
    seq: Number(info.lastInsertRowid),
    id,
    ts,
    type,
    payload,
    prevHash,
    hash,
    sig,
    keyId: key.keyId,
  };
}

export function listEvents(afterSeq = 0, limit = 1000): LedgerEvent[] {
  const rows = getDb()
    .prepare(
      "SELECT seq, id, ts, type, payload, prev_hash, hash, sig, key_id FROM events WHERE seq > ? ORDER BY seq ASC LIMIT ?"
    )
    .all(afterSeq, limit) as Array<{
    seq: number;
    id: string;
    ts: string;
    type: EventType;
    payload: string;
    prev_hash: string;
    hash: string;
    sig: string;
    key_id: string;
  }>;
  return rows.map((r) => ({
    seq: r.seq,
    id: r.id,
    ts: r.ts,
    type: r.type,
    payload: JSON.parse(r.payload),
    prevHash: r.prev_hash,
    hash: r.hash,
    sig: r.sig,
    keyId: r.key_id,
  }));
}

export interface VerifyResult {
  ok: boolean;
  checkedEvents: number;
  headHash: string;
  errors: string[];
}

/** Verifies the full hash chain and every signature. */
export function verifyChain(events: LedgerEvent[], publicKeyPem: string): VerifyResult {
  const errors: string[] = [];
  const publicKey = crypto.createPublicKey(publicKeyPem);
  let prev = GENESIS_HASH;

  for (const e of events) {
    if (e.prevHash !== prev) {
      errors.push(`seq ${e.seq}: prevHash mismatch (expected ${prev}, got ${e.prevHash})`);
    }
    const expected = sha256Hex(
      eventHashInput({ id: e.id, ts: e.ts, type: e.type, payload: e.payload, prevHash: e.prevHash })
    );
    if (expected !== e.hash) {
      errors.push(`seq ${e.seq}: hash mismatch`);
    }
    const sigOk = crypto.verify(
      null,
      Buffer.from(e.hash, "hex"),
      publicKey,
      Buffer.from(e.sig, "base64")
    );
    if (!sigOk) {
      errors.push(`seq ${e.seq}: bad signature`);
    }
    prev = e.hash;
  }

  return {
    ok: errors.length === 0,
    checkedEvents: events.length,
    headHash: prev,
    errors,
  };
}
