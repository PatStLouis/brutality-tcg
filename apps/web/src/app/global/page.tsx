import { OG_SET, globalStats, listPublicProfiles } from "@brutality/core";
import { CardFace } from "@/components/CardFace";

export const dynamic = "force-dynamic";

export default async function GlobalBinderPage() {
  const stats = new Map(globalStats().map((s) => [s.cardId, s]));
  const profiles = listPublicProfiles();
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
      {profiles.length > 0 && (
        <>
          <h2>Public Collectors</h2>
          <p className="muted">
            Discord profiles shown here are opt-in. Current machine-readable
            bindings are available at <a href="/api/profiles">/api/profiles</a>.
          </p>
          <div className="stats-row">
            {profiles.map((profile) => (
              <div className="stat" key={profile.collector}>
                {profile.avatarUrl && (
                  // Discord CDN URL supplied by the authenticated bot.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    width={48}
                    height={48}
                    style={{ borderRadius: "50%", verticalAlign: "middle", marginRight: 12 }}
                  />
                )}
                <b>{profile.displayName}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  @{profile.username}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
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
