import {
  OG_SET,
  collectorByDiscordId,
  creditBalance,
  demoEnabled,
  holdingsFor,
} from "@brutality/core";
import { getSession } from "@/lib/session";
import { CardFace } from "@/components/CardFace";
import { DemoRedeem } from "@/components/DemoRedeem";

export const dynamic = "force-dynamic";

export default async function BinderPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <h1>My Binder</h1>
        <p className="muted">Sign in with Discord to see your collection.</p>
        <a className="btn" href="/api/auth/login">
          Sign in with Discord
        </a>
        {demoEnabled() ? (
          <p>
            <a className="btn" href="/api/auth/guest">
              Continue as guest (demo)
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  const collector = collectorByDiscordId(session.discordId);
  const holdings = collector ? holdingsFor(collector.publicId) : [];
  const owned = new Map(holdings.map((h) => [h.cardId, h.quantity]));
  const balance = collector
    ? creditBalance(collector.publicId)
    : { available: 0, reserved: 0 };

  const distinctOwned = OG_SET.cards.filter((c) => owned.has(c.cardId)).length;
  const totalCards = holdings.reduce((s, h) => s + h.quantity, 0);
  const completion = Math.round((distinctOwned / OG_SET.cards.length) * 100);

  return (
    <div>
      <h1>My Binder</h1>
      <div className="stats-row">
        <div className="stat">
          <b>
            {distinctOwned}/{OG_SET.cards.length}
          </b>
          {OG_SET.name} completion ({completion}%)
        </div>
        <div className="stat">
          <b>{totalCards}</b> total cards
        </div>
        <div className="stat">
          <b>{balance.available}</b> unopened pack credit(s)
        </div>
      </div>
      {demoEnabled() ? (
        <DemoRedeem />
      ) : balance.available > 0 ? (
        <p className="muted">
          You have pack credits waiting — run <code>!redeem</code> in Discord to
          get an opening link.
        </p>
      ) : null}
      <div className="grid">
        {OG_SET.cards.map((card) => {
          const qty = owned.get(card.cardId);
          return (
            <CardFace
              key={card.cardId}
              name={card.name}
              number={card.number}
              rarity={card.rarity}
              image={card.image}
              setName={OG_SET.name}
              quantity={qty}
              missing={!qty}
            />
          );
        })}
      </div>
    </div>
  );
}
