import { appendEvent, listEvents, eventTypeOf } from "../ledger";
import { SETS } from "../cards";
import { initStore } from "../store";

initStore();

const existing = listEvents(0);
for (const set of SETS) {
  const already = existing.some(
    (e) =>
      eventTypeOf(e) === "set_published" &&
      (e.payload as any).setId === set.setId &&
      (e.payload as any).version === set.version
  );
  if (already) {
    console.log(`Set already published: ${set.name} v${set.version}`);
    continue;
  }
  appendEvent("set_published", `${set.setId}:${set.version}`, {
    setId: set.setId,
    version: set.version,
    name: set.name,
    packSize: set.packSize,
    rarityWeights: set.rarityWeights,
    cardIds: set.cards.map((c) => c.cardId),
  });
  console.log(`Published set: ${set.name} v${set.version} (${set.cards.length} cards)`);
}
