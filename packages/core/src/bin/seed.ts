import { appendEvent, listEvents, eventTypeOf } from "../ledger";
import { SETS } from "../cards";
import { initStore } from "../store";

initStore();

const existing = listEvents(0);
for (const set of SETS) {
  const already = existing.some(
    (e) =>
      eventTypeOf(e) === "set_published" &&
      (e.payload as any).set === set.setId &&
      (e.payload as any).version === set.version
  );
  if (already) {
    console.log(`Set already published: ${set.name} v${set.version}`);
    continue;
  }
  appendEvent("set_published", `${set.code}:${set.version}`, {
    set: set.setId,
    version: set.version,
    name: set.name,
    packSize: set.packSize,
    rarityWeights: set.rarityWeights,
    cards: set.cards.map((c) => c.cardId),
  });
  console.log(`Published set: ${set.name} v${set.version} (${set.cards.length} cards)`);
}
