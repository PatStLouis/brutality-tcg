export type Rarity = "common" | "uncommon" | "rare" | "ultra_rare" | "legendary";

export interface CardDef {
  cardId: string;
  number: number;
  name: string;
  rarity: Rarity;
  /**
   * Path (under the web app's public/ directory) to the commissioned card
   * front. Null renders the built-in placeholder card face; when commissioned
   * art lands, drop the file in apps/web/public/assets/cards/ and set this.
   */
  image: string | null;
  quote?: string;
}

export interface SetDef {
  /** Canonical URN: `urn:brutality:tcg:CardSet:{code}`. */
  setId: string;
  /** Short set code (the URN suffix), e.g. `OG`. */
  code: string;
  name: string;
  version: number;
  packSize: number;
  rarityWeights: Record<Rarity, number>;
  cards: CardDef[];
}

export const CARD_SET_URN_PREFIX = "urn:brutality:tcg:CardSet";
export const CARD_URN_PREFIX = "urn:brutality:tcg:Card";

export function cardSetUrn(code: string): string {
  return `${CARD_SET_URN_PREFIX}:${code}`;
}

/** Canonical card URN: `urn:brutality:tcg:Card:{setCode}:{number}` (zero-padded). */
export function cardUrn(setCode: string, number: number): string {
  return `${CARD_URN_PREFIX}:${setCode}:${String(number).padStart(3, "0")}`;
}

export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "ultra_rare", "legendary"];

export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  ultra_rare: "Ultra Rare",
  legendary: "Legendary",
};

/**
 * OG SET, carried over from the legacy pack opener as prior art.
 * All images are placeholders until photo rights are confirmed and the card
 * front template is commissioned.
 */
const OG_CARDS: Array<Omit<CardDef, "cardId">> = [
  { number: 1, name: "Nick Arthur", rarity: "common", image: null },
  { number: 2, name: "Alex Koehler", rarity: "uncommon", image: null },
  { number: 3, name: "Oli Sykes", rarity: "rare", image: null },
  { number: 4, name: "Phil Bozeman", rarity: "ultra_rare", image: null },
  { number: 5, name: "Mitch Lucker", rarity: "legendary", image: null },
  { number: 6, name: "Adam Warren", rarity: "common", image: null },
  { number: 7, name: "Alex Erian", rarity: "common", image: null },
  { number: 8, name: "Brandon Butler", rarity: "uncommon", image: null },
  { number: 9, name: "Frankie Palmeri", rarity: "rare", image: null },
  { number: 10, name: "Scott Ian Lewis", rarity: "common", image: null },
];

export const OG_SET: SetDef = {
  setId: cardSetUrn("OG"),
  code: "OG",
  name: "OG SET",
  version: 1,
  packSize: 5,
  rarityWeights: {
    common: 60,
    uncommon: 25,
    rare: 10,
    ultra_rare: 4,
    legendary: 1,
  },
  cards: OG_CARDS.map((c) => ({ ...c, cardId: cardUrn("OG", c.number) })),
};

export const SETS: SetDef[] = [OG_SET];

export function getSet(setId: string): SetDef {
  const set = SETS.find((s) => s.setId === setId);
  if (!set) throw new Error(`Unknown set: ${setId}`);
  return set;
}

export function getCard(cardId: string): CardDef {
  for (const set of SETS) {
    const card = set.cards.find((c) => c.cardId === cardId);
    if (card) return card;
  }
  throw new Error(`Unknown card: ${cardId}`);
}

export function setForCard(cardId: string): SetDef {
  const set = SETS.find((s) => s.cards.some((c) => c.cardId === cardId));
  if (!set) throw new Error(`Unknown card: ${cardId}`);
  return set;
}
