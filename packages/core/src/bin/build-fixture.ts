/**
 * Dev-time generator for the static demo ledger fixture.
 *
 * Builds a small demo world against the configured database (guest account
 * with unopened packs, a few community collectors with opened packs), then
 * exports it to fixtures/demo-ledger.json. Run against a scratch DATABASE_PATH,
 * not a real one:
 *
 *   DATABASE_PATH=./data/fixture-build.db npm run fixture:build
 */
import { getDb } from "../db";
import { appendEvent, listEvents } from "../ledger";
import { SETS } from "../cards";
import { grantCredits, redeemPack, openPack } from "../redemption";
import { exportFixture, fixturePath } from "../fixture";
import { DEMO_GUEST_DISCORD_ID, DEMO_GUEST_USERNAME } from "../demo";
import { ensureCollector } from "../redemption";

const db = getDb();
const existing = db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
if (existing.n > 0) {
  console.error(
    "Database is not empty. Point DATABASE_PATH at a scratch file, e.g.\n" +
      "  DATABASE_PATH=./data/fixture-build.db npm run fixture:build"
  );
  process.exit(1);
}

// 1. Publish sets.
for (const set of SETS) {
  appendEvent("set_published", {
    setId: set.setId,
    version: set.version,
    name: set.name,
    packSize: set.packSize,
    rarityWeights: set.rarityWeights,
    cardIds: set.cards.map((c) => c.cardId),
  });
}

// 2. Community collectors with some opened packs, so binders look alive.
const community = [
  { discordId: "demo-npc-overlord", name: "Overlord", packs: 4 },
  { discordId: "demo-npc-lowpoint", name: "LowPoint", packs: 3 },
  { discordId: "demo-npc-pitlord", name: "PitLord", packs: 2 },
];
for (const npc of community) {
  ensureCollector(npc.discordId, npc.name);
  grantCredits(npc.discordId, npc.packs, "demo_fixture");
  for (let i = 0; i < npc.packs; i++) {
    const redeem = redeemPack(npc.discordId, "http://demo.invalid");
    if (redeem.ok) openPack(redeem.redemption.token);
  }
}

// 3. Guest account: one opened pack for binder content, plus unopened credits
//    so a demo visitor can redeem and open packs themselves.
ensureCollector(DEMO_GUEST_DISCORD_ID, DEMO_GUEST_USERNAME);
grantCredits(DEMO_GUEST_DISCORD_ID, 6, "demo_fixture");
const guestRedeem = redeemPack(DEMO_GUEST_DISCORD_ID, "http://demo.invalid");
if (guestRedeem.ok) openPack(guestRedeem.redemption.token);

const fixture = exportFixture();
console.log(`Wrote ${fixturePath()}`);
console.log(
  `  ${fixture.events.length} events, ${fixture.collectors.length} collectors, ${fixture.redemptions.length} redemptions`
);
console.log(`  ledger events: ${listEvents(0, 10).length >= 1 ? "ok" : "??"}`);
