import Database from "better-sqlite3";
import { databasePath } from "./env";

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,
  ts         TEXT NOT NULL,
  type       TEXT NOT NULL,
  payload    TEXT NOT NULL,
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL UNIQUE,
  sig        TEXT NOT NULL,
  key_id     TEXT NOT NULL
);

-- Private mapping of Discord identity to pseudonymous public collector id.
-- Discord ids never appear in ledger event payloads.
CREATE TABLE IF NOT EXISTS collectors (
  discord_id   TEXT PRIMARY KEY,
  public_id    TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_ts   TEXT NOT NULL
);

-- Materialized projection of pack credit balances (rebuildable from events).
CREATE TABLE IF NOT EXISTS credit_balances (
  public_id TEXT PRIMARY KEY,
  available INTEGER NOT NULL DEFAULT 0,
  reserved  INTEGER NOT NULL DEFAULT 0
);

-- Redemption state. Card contents stay private until the pack is opened.
CREATE TABLE IF NOT EXISTS redemptions (
  redemption_id TEXT PRIMARY KEY,
  token         TEXT NOT NULL UNIQUE,
  public_id     TEXT NOT NULL,
  set_id        TEXT NOT NULL,
  card_ids      TEXT NOT NULL,
  nonce         TEXT NOT NULL,
  commitment    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_ts    TEXT NOT NULL,
  expires_ts    TEXT NOT NULL,
  opened_ts     TEXT
);

-- Materialized projection of card ownership (rebuildable from events).
CREATE TABLE IF NOT EXISTS holdings (
  public_id TEXT NOT NULL,
  card_id   TEXT NOT NULL,
  quantity  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (public_id, card_id)
);
`;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(databasePath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA);
  }
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
