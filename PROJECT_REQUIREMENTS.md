# Brutality TCG — Project Requirements

## 1. Product Summary

Brutality TCG is a mobile-first digital card collection platform built around
brutal deathcore culture and the Brutality Podcast. Cards feature photographs
of deathcore artists and other approved personalities.

Despite the TCG name, the initial product is collection-first rather than a
competitive card game. Subscribers and eligible community members redeem card
packs through Discord, open them through a unique web experience, and browse
their collection in a web binder.

The product will be delivered in phases:

- **Phase 1 — Collect:** Discord redemption, animated pack opening, personal
  and global binders, and a publicly verifiable event ledger.
- **Phase 2 — Trade:** Safe card trading and the supporting social workflows.
- **Future phases:** Gameplay or livestream opening may be considered, but
  neither is required for the initial product.

## 2. Product Goals

1. Reward podcast guests, subscribers, and community participation with
   collectible digital cards.
2. Make redeeming and opening a pack feel exciting on a mobile device.
3. Give collectors an attractive, searchable binder that is easy to share.
4. Establish publicly verifiable ownership history before trading is added.
5. Support subscriber eligibility from Patreon, Twitch, YouTube, and other
   sources without requiring direct integrations in the first release.
6. Provide a reusable foundation for new card sets, pack campaigns, and later
   trading.

## 3. Non-Goals for Phase 1

- Competitive TCG gameplay, decks, matches, combat, or card statistics.
- A livestream host opening every user's pack.
- A new payment or subscription system.
- Direct OAuth integrations with every subscription provider.
- A dedicated ledger browser or blockchain.
- A marketplace, card sales, cash-out, or financial speculation.
- Native iOS or Android applications.

## 4. Users and Roles

### Collector

A Discord community member who can receive pack credits, redeem packs, open
them, and browse their binder.

### Subscriber

A collector whose existing Discord role or imported allowlist entry grants
pack eligibility.

### Administrator

A trusted operator who manages card sets, campaigns, eligibility sources,
pack credits, card assets, and exceptional corrections.

### Public Visitor

Anyone who can browse the public global binder and independently verify the
published ledger without signing in.

## 5. Core Phase 1 Experience

### 5.1 Redemption Flow

1. A collector types `!redeem` in an approved Discord channel.
2. The Discord bot verifies the collector's role or allowlist eligibility and
   available pack credits.
3. The service atomically reserves one pack credit and creates a redemption.
4. The server determines the pack contents and records a cryptographic
   commitment without revealing the cards.
5. The bot sends the collector a unique pack-opening URL.
6. The collector opens the URL on a phone or desktop browser.
7. The web experience animates opening the pack and revealing each card.
8. The service finalizes the opening and appends it to the public ledger.
9. The personal and global binders update from the ledger event.

If the collector is not eligible or has no pack credits, the bot must return a
clear response without creating a redemption.

### 5.2 Unique Pack-Opening URLs

- URLs must contain an opaque, unguessable token and must not expose Discord
  IDs or other private data.
- A redemption is permanently bound to the Discord account that requested it.
  Possession of the URL cannot change ownership of the cards.
- Tokens expire after 24 hours if unopened. Expiration releases the reserved
  credit and creates an auditable expiration event.
- The first successful open finalizes the redemption atomically.
- Refreshing or revisiting a completed URL shows the same result and must never
  draw another pack or consume another credit.
- Concurrent requests must not produce duplicate openings.
- Discord OAuth is required for personal binder access. It is not required
  merely to play the opening animation from a valid redemption URL.

### 5.3 Pack Opening

- A pack contains five cards by default.
- Pack size and available card pool must be configurable per campaign.
- The pull is selected server-side before the reveal and cannot be influenced
  by client behavior, refreshes, animation timing, or network retries.
- Cards reveal sequentially with rarity-appropriate visual and motion effects.
- The experience must work with touch, mouse, keyboard, reduced-motion
  preferences, and common mobile viewport sizes.
- Audio must be optional, start muted where browser policy requires it, and
  never block completion.
- The opening must remain recoverable after interruption or browser closure.

### 5.4 Binder

The binder is the user-facing projection of ledger ownership. It is not an
independent ownership database.

#### Personal Binder

- Authenticated with Discord OAuth.
- Shows every card currently owned by the collector and duplicate quantities.
- Supports filtering by set, rarity, artist, and owned/missing status.
- Supports sorting by card number, name, rarity, acquisition date, and quantity.
- Provides card detail and full-image views.
- Shows set completion counts and percentages.
- Uses placeholders for cards not yet collected without revealing protected
  content that a campaign intentionally keeps secret.
- Provides a shareable public view using a pseudonymous collector identity.

#### Global Binder

- Publicly browsable without authentication.
- Shows all released card sets and cards.
- Shows aggregate circulation and ownership counts derived from the ledger.
- May link to pseudonymous public collector binders.
- Must not publish Discord IDs, emails, subscription identities, or private
  entitlement information.

### 5.5 Entitlements and Pack Credits

Phase 1 consumes membership information already maintained by Discord server
owners rather than rebuilding subscription-provider integrations.

- Discord roles are the primary eligibility signal.
- Administrators can import or synchronize a pre-made allowlist.
- Allowlist records should use stable Discord user IDs wherever possible.
- Pack credits may be granted for subscriptions, weekly podcast guests,
  promotions, gifts, or administrative corrections.
- Every grant, reservation, release, redemption, and correction must be an
  append-only event.
- The initial policy treats all recognized paid subscribers equally.
  Platform-specific and tier-specific pack rules remain configurable for a
  later policy decision.
- Future direct account linking for Patreon, Twitch, and YouTube must be
  possible without changing collector or ledger identities.

### 5.6 Weekly Podcast Campaigns

- Administrators can create a time-bounded campaign associated with a podcast
  episode or weekly guest.
- A campaign selects its card pool, pack art, availability window, eligible
  roles/allowlists, and pack allowance.
- Guest cards and photographs must not be published before their configured
  release time.
- Expired campaigns remain visible in binder history but no longer allow new
  redemptions.

## 6. Cards, Sets, and Rarity

### Card Record

Each card requires:

- Stable card ID
- Card number within a set
- Display name
- Artist/person name
- Set ID
- Rarity
- Front image
- Alt text
- Optional quote or caption
- Release status and release timestamp
- Rights/approval status and attribution

### Set Record

Each set requires:

- Stable set ID and display name
- Version
- Card list
- Default pack configuration
- Rarity distribution
- Release window
- Visual assets
- Published/unpublished state

### Initial Rarity Reference

The legacy project used the following distribution:

| Rarity | Weight |
| --- | ---: |
| Common | 60% |
| Uncommon | 25% |
| Rare | 10% |
| Ultra Rare | 4% |
| Legendary | 1% |

These values are prior art, not a final economy decision. Phase 1 must support
versioned, configurable distributions and preserve the exact distribution
version used for every opening.

## 7. Publicly Verifiable Event Ledger

### 7.1 Purpose

The ledger is the canonical source of truth for pack credits and card
ownership. Personal binders, the global binder, balances, and later trades are
deterministic projections produced by replaying ledger events.

There is no dedicated ledger UI requirement. Public verification is provided
through a documented, machine-readable export/API and an open-source verifier.

### 7.1.1 Storage

The canonical ledger is an append-only JSON Lines file (one complete signed
event object per line). A derived SQLite cache holds rebuildable projections
(credit balances, holdings) and private working state that is not published
(Discord identity map, unopened redemption tokens and pulls). Binders and
balances must always be reproducible by replaying the JSONL ledger alone;
private working state must be backed up alongside it.

### 7.2 Event Types

The ledger always begins with a Genesis event. Its payload is
`type: Genesis` with `id`
`urn:brutality:tcg:Genesis:{publicKeyMultibase}`, anchoring the whole chain to
the key that signs it. Genesis alone declares the versioned `@context`; its
IRI replaces the former `schemaVersion` field and applies to the complete
JSONL stream by ledger convention. Having no predecessor, Genesis digests
with its own payload `id` as the chain anchor; verification
recomputes the multibase from the signing key and checks it against the
Genesis payload `id`.

Phase 1 includes (compact payload JSON-LD `type` in parentheses):

- Collector created (`urn:brutality:tcg:CollectorCreated`)
- Pack credit granted (`urn:brutality:tcg:CreditsGranted`)
- Pack credit reserved (`urn:brutality:tcg:CreditReserved`)
- Redemption committed (`urn:brutality:tcg:RedemptionCommitted`)
- Pack opened (`urn:brutality:tcg:PackOpening`)
- Redemption expired (`urn:brutality:tcg:RedemptionExpired`)
- Pack credit released (`urn:brutality:tcg:CreditReleased`)
- Administrative correction (`urn:brutality:tcg:AdminCorrection`)
- Card/set/campaign version published (`urn:brutality:tcg:SetPublished`)

Phase 2 adds:

- Card trading and related settlement events (`urn:brutality:tcg:CardTrading`
  and finer-grained trade types as needed)

Events are never edited or deleted. Mistakes are corrected with compensating
events that reference the original event.

### 7.3 Integrity Requirements

Each event is a uniform JSON-LD envelope whose `payload` is itself a JSON-LD
resource describing the domain fact:

Envelope (root):

- `@context`: present only on Genesis, pointing to the immutable versioned
  context (normally `<BASE_URL>/context/v1`). It aliases `id` to `@id`,
  `type` to `@type`, and expands compact terms such as `Event`, `Genesis`,
  and `PackOpening` to their Brutality TCG URNs. Applying it to subsequent
  JSONL entries is a ledger convention; standalone events require Genesis
  or the context to be supplied explicitly
- `type`: always `Event` (expands to `urn:brutality:tcg:Event`)
- `id`: `urn:brutality:tcg:Event:{seq}-{digestMultibase}` — the monotonically
  ordered sequence number folded together with the content digest, so the id
  is both sortable and content-addressed. There is no separate `seq` field;
  `seq` is read from the id. Digests use the `digestMultibase` form from the
  W3C security vocabulary: a sha2-256 multihash (0x12 0x20 + digest),
  base58btc multibase encoded (`z…`)
- `ts`: UTC timestamp
- `proof`: a W3C **Data Integrity** proof (`DataIntegrityProof`,
  cryptosuite **`eddsa-jcs-2022`**) over the unsecured document
  (`{@context?, id, type, ts, payload}`), added after `id` is computed.
  Because `seq` lives in the signed `id`, its position is authenticated. It
  carries `created`, a `did:key` `verificationMethod`,
  `proofPurpose: assertionMethod`, and a multibase `proofValue`.

There is no `prevId` field. Chaining follows the did:webvh entry-hash
pattern: the digest is computed over `{id, type, ts, payload}` with the
*previous* event's envelope `id` occupying the `id` slot, and the result
replaces it as `Event:{seq}-{digest}`. Each id therefore binds the full
prior head implicitly. Genesis, the chain root, digests with its own payload
`id` (the signing key anchor) in the slot instead. The Genesis digest also
covers its `@context`.

Payload (domain resource):

- `type`: compact domain-specific type (`PackOpening`, `Genesis`, etc.),
  expanded through the Genesis context
- `id`: stable domain identifier, `{expanded type}:{domainId}` — e.g.
  `urn:brutality:tcg:PackOpening:{redemptionId}`. All events of one pack
  lifecycle (`CreditReserved`, `RedemptionCommitted`, `PackOpening`,
  `RedemptionExpired`, `CreditReleased`) share the same `redemptionId`
  suffix; `CollectorCreated` uses the collector's public id; `SetPublished`
  uses `{setCode}:{version}`; Genesis uses the signing key multibase
- Remaining fields: domain data only (collector, set, cards, commitment,
  etc.). Sets and cards are themselves
  identified by URNs: `urn:brutality:tcg:CardSet:{code}` (e.g.
  `…CardSet:OG`) and `urn:brutality:tcg:Card:{setCode}:{number}` (e.g.
  `…Card:OG:005`, zero-padded)

Verifiers read `seq` from the `id`, substitute the predecessor's `id`
(or the Genesis payload `id`) into the `id` slot, recompute the digest —
one check that proves both content integrity and the chain link — and then
verify the proof. Pack commitments are `digestMultibase` values too.

The ledger must use:

- Canonical JSON serialization so independent implementations hash identical
  bytes.
- SHA-256 or a comparably reviewed cryptographic hash.
- Ed25519 or a comparably reviewed digital-signature algorithm.
- Published verification keys with a documented rotation process.
- Periodic signed checkpoints published outside the primary database, such as
  a read-only Discord audit channel and a public static endpoint.

A hash chain by itself only detects changes relative to a trusted checkpoint.
External signed checkpoints are therefore required to make historical
rewriting publicly detectable.

### 7.4 Commit and Reveal

When `!redeem` succeeds:

1. The server securely generates the pull and a random nonce.
2. It records a commitment over the redemption ID, set/distribution version,
   ordered card IDs, and nonce.
3. The opening page reveals the cards.
4. The finalized event publishes the committed values and nonce.
5. A verifier can recompute the commitment and prove the result was fixed
   before reveal.

The commitment proves that a result was not changed after issuance. The
selection algorithm and randomness policy must also be documented so the
system does not imply stronger fairness guarantees than it provides.

### 7.5 Public Verification

Anyone must be able to:

1. Download ledger events and verification keys.
2. Verify event signatures and the complete hash chain.
3. Verify opening commitments and reveals.
4. Replay events to reproduce pack-credit balances and binder ownership.
5. Compare the result against the public global binder.

The public ledger must use stable pseudonymous collector IDs. Mapping those IDs
to Discord identities is private unless a collector explicitly opts to expose
their public profile.

## 8. Progressive Web App Requirements

The pack-opening experience and binders form one mobile-first web application.

- Installable PWA with manifest, icons, theme colors, and service worker.
- Responsive from small phones through desktop screens.
- Touch targets and gestures designed for one-handed mobile use.
- Supports current Chrome, Safari, Firefox, and Edge releases.
- Binder shell, metadata, and previously viewed card images may be cached for
  read-only offline browsing.
- Redemptions, pack finalization, and trades require an online connection.
- Offline UI must never imply a redemption succeeded until confirmed by the
  server.
- Card images must use responsive formats, lazy loading, and size budgets.
- Opening animations should target smooth performance on mid-range phones.
- Meets WCAG 2.2 AA for navigation, contrast, focus, text, and reduced motion.
- Discord OAuth must work from mobile browsers and handle restrictive in-app
  browser behavior with a clear fallback.

## 9. Administration

Phase 1 requires a protected administrative interface for:

- Managing Discord server, channel, and role configuration
- Importing and validating eligibility allowlists
- Granting and correcting pack credits
- Creating and scheduling campaigns
- Publishing versioned card sets and rarity distributions
- Uploading approved card and pack assets
- Reviewing failed, pending, expired, and completed redemptions
- Rotating ledger signing keys and publishing checkpoints
- Exporting operational data without exposing secrets

All administrative actions that affect credits, openings, or ownership must
create ledger events.

## 10. UI Components to Commission

### 10.1 Existing Commissioned Assets (Retained)

The following card-related assets were already commissioned for the legacy
`PatStLouis/brutality-pack-opener` project and carry forward into this product
as-is. They are production assets, not placeholders:

- Card back (black/grey marbled surface with the red thorn Brutality
  typography)
- Brutality wordmark/logo
- Gold foil pack wrapper

The new UI commission is additive: it designs the application components
around these existing card assets and must treat them as fixed brand anchors
(palette, texture, and typography direction), not as items to replace.

No application UI components are currently commissioned.

### 10.2 Phase 1 Commission Package

The UI designer should provide a cohesive responsive component library and
high-fidelity states for:

#### Foundation

- Mobile and desktop layout grid
- Color, typography, spacing, radius, border, icon, texture, and motion tokens
- Accessible dark-theme palette
- Buttons, links, icon buttons, inputs, selects, chips, tabs, dialogs, sheets,
  toasts, skeletons, empty states, and error states
- App icon, favicon, PWA icons, Discord bot avatar, and social-share image

#### Navigation and Account

- Mobile bottom navigation and desktop navigation
- Discord sign-in, signed-in account menu, and public-profile controls
- Pack-credit indicator and pending-redemption state
- Install-PWA prompt and offline/read-only indicators

#### Pack Redemption

- Discord bot response presentation for success, no credits, ineligible,
  pending redemption, expired link, and system error
- Unique-link landing/loading state
- Sealed pack presentation
- Touch-first tear/open interaction
- Card-back stack and sequential card reveal
- Rarity-specific reveal treatments
- Five-card final pull layout
- Interrupted/resumed, already-opened, expired, and reduced-motion states

#### Cards

- Responsive card-front template around the approved artist photograph
- Card back integration
- Rarity variants
- Set mark, card number, artist name, quote/caption, and attribution treatments
- Owned, missing, unreleased, duplicate, selected, and newly acquired states
- Card detail, zoom, and share presentation

#### Personal Binder

- Binder home and set selector
- Responsive card grid/list
- Search, filter, and sort controls
- Set completion and collection statistics
- Duplicate quantity treatment
- Missing and secret-card treatments
- Public share view

#### Global Binder

- Set directory and set detail
- Aggregate circulation/ownership presentation
- Pseudonymous collector links
- Public no-auth states

#### Administration

- Dashboard
- Campaign editor
- Card/set editor and publishing flow
- Allowlist import and validation results
- Pack-credit adjustment flow
- Redemption status table and detail
- Destructive-action confirmation and audit references

### 10.3 Phase 2 Commission Package

- Trade discovery and collector selection
- Offer builder using duplicate/available cards
- Incoming and outgoing trade states
- Review, confirm, decline, cancel, expire, and completed states
- Ownership-change confirmation and conflict/error handling
- Trade history within personal binder views

### 10.4 Designer Deliverables

- Component library in the selected design tool
- Mobile-first screens plus desktop adaptations
- Interactive pack-opening prototype
- Motion specifications, timings, easing, and reduced-motion alternatives
- Export-ready assets with naming and sizing guidance
- Responsive behavior and interaction annotations
- Accessibility notes and contrast validation
- Empty, loading, error, offline, expired, and unauthorized states

## 11. Phase 2 — Trading

Phase 2 enables collectors to exchange cards while preserving ledger-derived
ownership.

- A collector can propose an atomic card-for-card trade.
- The recipient can accept, decline, or let the offer expire.
- Cards in a pending accepted settlement cannot be double-spent.
- Settlement validates both parties' current ownership in one transaction.
- A successful trade appends one signed settlement event and updates both
  binders through projection.
- Failed or stale offers do not alter ownership.
- Administrators cannot silently transfer cards; corrections require explicit
  compensating events.
- Real-money sales and auctions are outside Phase 2.

## 12. Security, Privacy, and Rights

- Use stable Discord user IDs internally; do not rely on changeable usernames.
- Encrypt sensitive OAuth tokens and secrets at rest.
- Apply least privilege to Discord bot permissions.
- Rate-limit bot commands, token attempts, OAuth flows, and public APIs.
- Store only data required for entitlement, ownership, and operations.
- Provide account deletion/privacy handling without corrupting the public
  ledger; public identity must be pseudonymized rather than deleting events.
- Never place bearer tokens, Discord IDs, pull contents, or private data in
  analytics or application logs.
- Card photographs, artist likenesses, names, quotes, logos, and attribution
  require documented permission or licensing before publication.
- Rights status and allowed usage must be tracked per card asset.

## 13. Reliability and Observability

- Credit reservation and pack finalization must be transactional and idempotent.
- Replaying the ledger from genesis must reproduce all binder and credit state.
- Projections may be cached for performance but must be rebuildable.
- Backups must cover the ledger, signing-key custody, configuration, and card
  metadata; media assets should use versioned object storage.
- Monitor failed Discord commands, failed openings, projection lag, signature
  failures, checkpoint publication, and asset-delivery errors.
- Define recovery procedures for an unavailable Discord API, database, or card
  asset service.

## 14. Phase 1 Acceptance Criteria

Phase 1 is complete when:

1. An eligible Discord user can run `!redeem` and receive one unique URL while
   exactly one credit is reserved.
2. The URL provides a responsive, accessible five-card opening experience on
   supported mobile and desktop browsers.
3. Refreshes, retries, concurrent requests, and revisits cannot change the pull
   or consume additional credits.
4. Finalized cards appear in the user's authenticated personal binder.
5. The global binder reflects the same aggregate ownership.
6. Both binder views can be rebuilt solely by replaying the ledger.
7. An independent verifier can validate the event chain, signatures,
   checkpoints, and commit/reveal records.
8. Public exports reveal no Discord IDs or subscription-provider identities.
9. Administrators can publish a campaign, import eligibility, grant credits,
   and inspect redemption status.
10. The web app is installable as a PWA and has usable offline read-only binder
    behavior.
11. All published artist photographs and likenesses have recorded approval or
    licensing status.

## 15. Open Product Decisions

These decisions do not change the Phase 1 architecture but must be finalized
before production launch:

- Exact pack rights by subscription platform and membership tier
- Final pack size and rarity distributions per campaign
- Whether public profiles show collector-selected Discord display names
- Pack-credit expiration policy
- Whether weekly guest packs are guaranteed cards or weighted pools
- Duplicate protection, pity rules, and limited-edition supply
- Card-photography and artist-likeness licensing process

