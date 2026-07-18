import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { listEvents, verifyChain, type LedgerEvent } from "./ledger";
import { getSigningKey } from "./keys";
import { writeAllEvents, getLastSeq } from "./ledgerFile";
import { resyncCache } from "./store";
import { dataDir, REPO_ROOT } from "./env";

/**
 * A fixture is a static, pre-signed ledger snapshot plus the private tables
 * that are not part of the public ledger (collector identity mapping and
 * redemption tokens). It ships with the DEMO signing key so a freshly seeded
 * database can keep appending valid events to the same chain.
 *
 * Never export a fixture from a production database: the fixture exposes the
 * signing key and the discordId->publicId mapping by design.
 */
export interface LedgerFixture {
  format: "brutality-ledger-fixture";
  version: 1;
  exportedTs: string;
  demoSigningKeyPem: string;
  publicKeyPem: string;
  keyId: string;
  events: LedgerEvent[];
  collectors: Array<{
    discord_id: string;
    public_id: string;
    display_name: string | null;
    created_ts: string;
  }>;
  redemptions: Array<Record<string, unknown>>;
}

export function fixturePath(): string {
  return path.join(REPO_ROOT, "fixtures", "demo-ledger.json");
}

export function exportFixture(outPath = fixturePath()): LedgerFixture {
  const db = getDb();
  const key = getSigningKey();

  const pending = db
    .prepare("SELECT COUNT(*) AS n FROM redemptions WHERE status = 'pending'")
    .get() as { n: number };
  if (pending.n > 0) {
    throw new Error(
      `Refusing to export with ${pending.n} pending redemption(s); open or expire them first.`
    );
  }

  const events = listEvents(0);
  const collectors = db
    .prepare("SELECT discord_id, public_id, display_name, created_ts FROM collectors")
    .all() as LedgerFixture["collectors"];
  const redemptions = db.prepare("SELECT * FROM redemptions").all() as Array<
    Record<string, unknown>
  >;

  const privPath = path.join(dataDir(), "keys", "ledger-ed25519.pem");
  const fixture: LedgerFixture = {
    format: "brutality-ledger-fixture",
    version: 1,
    exportedTs: new Date().toISOString(),
    demoSigningKeyPem: fs.readFileSync(privPath, "utf8"),
    publicKeyPem: key.publicKeyPem,
    keyId: key.keyId,
    events,
    collectors,
    redemptions,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2));
  return fixture;
}

export interface ImportResult {
  events: number;
  collectors: number;
  redemptions: number;
}

/**
 * Imports a fixture into the configured database. Requires an empty ledger
 * unless `force` is set, in which case all existing state is wiped first.
 */
export function importFixture(inPath = fixturePath(), force = false): ImportResult {
  const fixture = JSON.parse(fs.readFileSync(inPath, "utf8")) as LedgerFixture;
  if (fixture.format !== "brutality-ledger-fixture") {
    throw new Error("Not a ledger fixture file");
  }

  const check = verifyChain(fixture.events, fixture.publicKeyPem);
  if (!check.ok) {
    throw new Error(`Fixture ledger fails verification: ${check.errors[0]}`);
  }

  const db = getDb();
  const existing = getLastSeq();
  if (existing > 0 && !force) {
    throw new Error(
      `Ledger already has ${existing} event(s). Pass --force to wipe and reseed.`
    );
  }

  // Install the demo signing key so new events continue the fixture chain.
  const keysDir = path.join(dataDir(), "keys");
  fs.mkdirSync(keysDir, { recursive: true });
  fs.writeFileSync(path.join(keysDir, "ledger-ed25519.pem"), fixture.demoSigningKeyPem, {
    mode: 0o600,
  });
  fs.writeFileSync(path.join(keysDir, "ledger-ed25519.pub.pem"), fixture.publicKeyPem);

  // The JSONL ledger file is the source of truth; write it first.
  writeAllEvents(fixture.events);

  // Restore private working state (not derivable from the ledger).
  db.transaction(() => {
    for (const table of ["collectors", "credit_balances", "redemptions", "holdings"]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }

    const insertCollector = db.prepare(
      "INSERT INTO collectors (discord_id, public_id, display_name, created_ts) VALUES (?, ?, ?, ?)"
    );
    for (const c of fixture.collectors) {
      insertCollector.run(c.discord_id, c.public_id, c.display_name, c.created_ts);
    }

    const insertRedemption = db.prepare(
      `INSERT INTO redemptions
        (redemption_id, token, public_id, set_id, card_ids, nonce, commitment, status, created_ts, expires_ts, opened_ts)
       VALUES (@redemption_id, @token, @public_id, @set_id, @card_ids, @nonce, @commitment, @status, @created_ts, @expires_ts, @opened_ts)`
    );
    for (const r of fixture.redemptions) {
      insertRedemption.run(r);
    }
  })();

  // Rebuild credit/holdings projections from the freshly written ledger.
  resyncCache();

  return {
    events: fixture.events.length,
    collectors: fixture.collectors.length,
    redemptions: fixture.redemptions.length,
  };
}
