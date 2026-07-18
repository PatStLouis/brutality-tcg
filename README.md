# Brutality TCG

Brutality TCG is a mobile-first digital card collection platform for the
Brutality Podcast and deathcore community.

The first phase centers on:

- Discord-based pack redemption (`!redeem` → unique opening link)
- Unique web pack-opening experiences
- Personal and global card binders
- A mobile-friendly Progressive Web App
- A hash-chained, signed, publicly verifiable ownership ledger

Trading is planned for Phase 2. Competitive card gameplay and livestream pack
opening are not part of the initial scope.

See [PROJECT_REQUIREMENTS.md](PROJECT_REQUIREMENTS.md) for the complete product
requirements, delivery phases, ledger design, and UI commissioning scope.

## MVP layout

```
brutality-tcg/
├── packages/core     # Ledger, cards, redemption logic, projections, CLI tools
├── apps/web          # Next.js PWA: pack opening, binders, ledger export, OAuth,
│                     # and the internal bot API (owns the DB + signing keys)
├── apps/bot          # discord.js bot: !redeem and !packs (talks to the web API,
│                     # never the database)
└── data/             # SQLite database + ledger signing keys (gitignored)
```

The two services communicate over an authenticated internal API
(`POST /api/internal/redeem`, `GET /api/internal/packs`) using the shared
`BOT_API_SECRET`. Only the web service reads or writes the database and holds
the ledger signing keys, so the services can be deployed on separate hosts.

- **Ledger:** append-only events, SHA-256 hash chain, Ed25519 signatures,
  commit/reveal per pack. Binders are projections of the ledger and can be
  rebuilt by replay. Public export at `/api/ledger`.
- **Placeholder art:** cards render a built-in placeholder face until
  commissioned art is added (see `apps/web/public/assets/cards/README.md`).
  Swapping in real art requires no schema or UI changes.

## Quick start

```bash
npm install
cp .env.example .env    # fill in Discord credentials when you have them

npm run seed            # publish the OG SET to the ledger
npm run grant -- <discordId> 5 subscription   # give a user pack credits
npm run dev:web         # http://localhost:3000
npm run dev:bot         # requires DISCORD_BOT_TOKEN
```

Without Discord you can exercise the whole flow locally:

```bash
npm run simulate        # grant -> redeem -> open -> binder, all in one go
npm run redeem -- <discordId>   # prints an opening URL for the web app
npm run verify          # verify hash chain, signatures, commit/reveal, replay
```

## Discord setup

1. Create an application at https://discord.com/developers, add a bot, and
   enable the *Message Content* and *Server Members* intents.
2. Put the bot token and OAuth client id/secret in `.env`.
3. Add `<BASE_URL>/api/auth/callback` as an OAuth redirect URI.
4. Optionally set `ELIGIBLE_ROLE_IDS` (subscriber roles) and
   `REDEEM_CHANNEL_IDS` (where `!redeem` is allowed).

## Verifying the ledger

`GET /api/ledger` returns all events plus the public key. The `npm run verify`
CLI recomputes the hash chain, checks every Ed25519 signature, validates each
pack's commit/reveal, and replays events to confirm the binder projections
match — the same checks any third party can implement from the export.

## License

MIT
