import { getDb } from "../db";
import { appendEvent, listEvents } from "../ledger";
import { SETS } from "../cards";

getDb();

const existing = listEvents(0, 10_000);
for (const set of SETS) {
  const already = existing.some(
    (e) =>
      e.type === "set_published" &&
      (e.payload as any).setId === set.setId &&
      (e.payload as any).version === set.version
  );
  if (already) {
    console.log(`Set already published: ${set.name} v${set.version}`);
    continue;
  }
  appendEvent("set_published", {
    setId: set.setId,
    version: set.version,
    name: set.name,
    packSize: set.packSize,
    rarityWeights: set.rarityWeights,
    cardIds: set.cards.map((c) => c.cardId),
  });
  console.log(`Published set: ${set.name} v${set.version} (${set.cards.length} cards)`);
}
