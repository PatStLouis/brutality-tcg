import Link from "next/link";
import { OG_SET, demoEnabled } from "@brutality/core";

export default function HomePage() {
  return (
    <div>
      <h1>Brutality TCG</h1>
      <p>
        Collect photo cards of deathcore artists. Earn packs through the
        Brutality Podcast community, redeem them with the Discord bot, and rip
        them open right here.
      </p>
      <div className="stats-row">
        <div className="stat">
          <b>{OG_SET.cards.length}</b> cards in {OG_SET.name}
        </div>
        <div className="stat">
          <b>{OG_SET.packSize}</b> cards per pack
        </div>
        <div className="stat">
          <b>Public</b> verifiable ledger
        </div>
      </div>
      <h2>How it works</h2>
      <ol>
        <li>Subscribe (Patreon / Twitch / YouTube) and join the Discord.</li>
        <li>
          Type <code>!redeem</code> in the redeem channel — the bot sends you a
          unique pack link.
        </li>
        <li>Open the link on your phone and tear the pack open.</li>
        <li>
          Browse your <Link href="/binder">binder</Link> or the{" "}
          <Link href="/global">global collection</Link>.
        </li>
      </ol>
      <p className="muted">
        Every pack opening is committed to a hash-chained, signed ledger you can
        verify yourself: <Link href="/api/ledger">/api/ledger</Link>
      </p>
      {demoEnabled() ? (
        <p>
          <a className="btn" href="/api/auth/guest">
            Try the demo as guest
          </a>
        </p>
      ) : null}
    </div>
  );
}
