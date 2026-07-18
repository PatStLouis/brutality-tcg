import { OG_SET, globalStats } from "@brutality/core";
import { CardFace } from "@/components/CardFace";

export const dynamic = "force-dynamic";

export default async function GlobalBinderPage() {
  const stats = new Map(globalStats().map((s) => [s.cardId, s]));
  const totalCirculation = [...stats.values()].reduce((s, c) => s + c.totalCirculation, 0);

  return (
    <div>
      <h1>Global Binder</h1>
      <p className="muted">
        Community-wide circulation, derived from the public ledger. Verify it
        yourself at <a href="/api/ledger">/api/ledger</a>.
      </p>
      <div className="stats-row">
        <div className="stat">
          <b>{totalCirculation}</b> cards in circulation
        </div>
        <div className="stat">
          <b>{OG_SET.cards.length}</b> cards in {OG_SET.name}
        </div>
      </div>
      <div className="grid">
        {OG_SET.cards.map((card) => {
          const s = stats.get(card.cardId);
          return (
            <div key={card.cardId}>
              <CardFace
                name={card.name}
                number={card.number}
                rarity={card.rarity}
                image={card.image}
                setName={OG_SET.name}
                missing={!s}
              />
              <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>
                {s
                  ? `${s.totalCirculation} in circulation · ${s.distinctOwners} owner(s)`
                  : "none pulled yet"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
