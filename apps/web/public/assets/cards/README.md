# Card art assets

Commissioned card art drops in here.

- File naming: `<set-code>/<card-number>.png` (e.g. `og/005.png`)
- After adding a file, set the matching card's `image` field in
  `packages/core/src/cards.ts` to `/assets/cards/og/005.png`.
- Card identity in the ledger uses URNs (`urn:brutality:tcg:Card:OG:005`);
  file paths just use the lowercase set code and zero-padded card number.
- Until an image is set, the app renders a built-in placeholder card face,
  so nothing breaks while art is pending.

Photo rights: only add artist photographs with documented permission or
licensing (see PROJECT_REQUIREMENTS.md section 12).
