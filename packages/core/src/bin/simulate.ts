/**
 * End-to-end local simulation without Discord:
 * grant credits -> redeem -> open -> print binder state.
 */
import { grantCredits, redeemPack, openPack, creditBalance } from "../redemption";
import { holdingsFor, globalStats } from "../projections";
import { getCard } from "../cards";
import { baseUrl } from "../env";
import { initStore } from "../store";

initStore();

const discordId = process.argv[2] ?? "sim-user-1";

const collector = grantCredits(discordId, 1, "simulation");
console.log(`Granted 1 pack to ${discordId} (${collector.publicId})`);

const redeem = redeemPack(discordId, baseUrl());
if (!redeem.ok) {
  console.error(`Redeem failed: ${redeem.reason}`);
  process.exit(1);
}
console.log(`Redemption URL: ${redeem.url}`);
console.log(`Commitment: ${redeem.redemption.commitment}`);

const open = openPack(redeem.redemption.token);
if (open.status !== "opened") {
  console.error(`Open failed: ${open.status}`);
  process.exit(1);
}
console.log("Pulled cards:");
for (const cardId of open.redemption.cardIds) {
  const card = getCard(cardId);
  console.log(`  ${card.name} [${card.rarity}]`);
}

const balance = creditBalance(collector.publicId);
console.log(`Balance: ${balance.available} available, ${balance.reserved} reserved`);

console.log("Personal binder:");
for (const h of holdingsFor(collector.publicId)) {
  console.log(`  ${getCard(h.cardId).name} x${h.quantity}`);
}

console.log("Global circulation:");
for (const s of globalStats()) {
  console.log(`  ${getCard(s.cardId).name}: ${s.totalCirculation} in circulation, ${s.distinctOwners} owner(s)`);
}
