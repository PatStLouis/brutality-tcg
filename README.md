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
└── data/             # ledger.jsonl + SQLite cache + signing keys (gitignored)
```

The two services communicate over an authenticated internal API
(`POST /api/internal/redeem`, `GET /api/internal/packs`) using the shared
`BOT_API_SECRET`. Only the web service reads or writes the ledger and holds
the signing keys, so the services can be deployed on separate hosts.

- **Ledger (source of truth):** append-only JSON Lines file (`data/ledger.jsonl`).
  Every entry is a uniform envelope: `@type` `urn:brutality:tcg:Event`, `@id`
  content-addressed as `urn:brutality:tcg:Event:{hash}` (hash of
  `seq`/`ts`/`prevId`/`payload`), plus `seq`, `ts`, optional `prevId`, and a
  W3C **Data Integrity** `proof` (`eddsa-jcs-2022` / `did:key`). The `payload`
  is its own JSON-LD resource describing what happened: a domain `@type`
  (e.g. `urn:brutality:tcg:PackOpening`) and a stable domain `@id`
  (e.g. `urn:brutality:tcg:PackOpening:{redemptionId}`), so all events of one
  pack lifecycle share the same id suffix. An empty ledger gets a Genesis
  event first, whose payload `@id` is
  `urn:brutality:tcg:Genesis:{publicKeyMultibase}` — anchoring the chain to
  its signing key (Genesis is the only event without a `prevId`). Later events
  set `prevId` to the prior event's envelope `@id`. A shared `@context` can be
  added later. Commit/reveal per pack. Public export at `/api/ledger` or
  `/api/ledger?format=jsonl`.
- **SQLite cache:** rebuildable projections (credit balances, holdings) plus
  private working state (Discord→collector map, redemption tokens/pulls). The
  cache is reconciled from the ledger on every web boot. Back up **both**
  `ledger.jsonl` and the SQLite file — private state is not in the public ledger.
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

## Demo mode (no Discord required)

A static, pre-signed ledger fixture ships in `fixtures/demo-ledger.json`:
a guest account with unopened pack credits plus a few community collectors,
all with valid hashes, signatures, and commit/reveals.

```bash
npm run seed:demo             # import the fixture (use FORCE=true to wipe first)
DEMO=true npm run dev:web     # enable guest login + in-browser redemption
```

With `DEMO=true`, the home page and binder show a **Continue as guest**
option (`/api/auth/guest`) that bypasses Discord OAuth, and the binder gets a
**Redeem a demo pack** button (`/api/demo/redeem`) that stands in for the
bot's `!redeem`. Both endpoints return 404 when `DEMO` is not `true` — never
enable it in production, and never reuse the fixture's signing key outside
demos (it is public by design).

To regenerate the fixture after changing sets or demo contents:

```bash
DATABASE_PATH=./data/fixture-build.db LEDGER_PATH=./data/fixture-build.jsonl \
  npm run fixture:build
```

## Docker

Each service has its own image; both build from the repo root:

```bash
docker build -f apps/web/Dockerfile -t brutality-web .
docker build -f apps/bot/Dockerfile -t brutality-bot .
```

Or run both with compose (reads variables from `.env`):

```bash
docker compose up --build
```

The web container owns `ledger.jsonl`, the SQLite cache, and the signing keys
under `/app/data` — keep that on a persistent volume (compose sets up
`brutality-data` for you). The bot container is stateless and reaches the web
service at `http://web:3000` on the compose network.

To seed inside the container (first run):

```bash
docker compose exec web npm run seed          # production set publish
docker compose exec web npm run seed:demo     # or the demo fixture
```

## Discord setup

1. Create an application at https://discord.com/developers, add a bot, and
   enable the *Message Content* and *Server Members* intents.
2. Put the bot token and OAuth client id/secret in `.env`.
3. Add `<BASE_URL>/api/auth/callback` as an OAuth redirect URI.
4. Optionally set `ELIGIBLE_ROLE_IDS` (subscriber roles) and
   `REDEEM_CHANNEL_IDS` (where `!redeem` is allowed).

## Verifying the ledger

`GET /api/ledger` returns all events plus the public key. Pass
`?format=jsonl` for the raw append-only form (identical to `data/ledger.jsonl`).
The `npm run verify` CLI recomputes the hash chain, checks every Ed25519
signature, validates each pack's commit/reveal, and replays events to confirm
the binder projections match — the same checks any third party can implement
from the export.

## License

MIT
