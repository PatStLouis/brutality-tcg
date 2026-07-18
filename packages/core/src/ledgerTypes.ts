import type { DataIntegrityProof } from "./dataIntegrity";

/**
 * Root envelope type. Every ledger entry is an `Event`, content-addressed as
 * `urn:brutality:tcg:Event:{contentHash}`. What *kind* of thing happened
 * lives inside `payload` as its own JSON-LD resource (`@id`/`@type`).
 */
export const EVENT_TYPE = "urn:brutality:tcg:Event";

/** JSON-LD type URNs for domain resources carried in event payloads. */
export const JsonLdTypes = {
  genesis: "urn:brutality:tcg:Genesis",
  set_published: "urn:brutality:tcg:SetPublished",
  collector_created: "urn:brutality:tcg:CollectorCreated",
  credits_granted: "urn:brutality:tcg:CreditsGranted",
  credit_reserved: "urn:brutality:tcg:CreditReserved",
  redemption_committed: "urn:brutality:tcg:RedemptionCommitted",
  pack_opened: "urn:brutality:tcg:PackOpening",
  redemption_expired: "urn:brutality:tcg:RedemptionExpired",
  credit_released: "urn:brutality:tcg:CreditReleased",
  admin_correction: "urn:brutality:tcg:AdminCorrection",
  // Phase 2
  card_trading: "urn:brutality:tcg:CardTrading",
} as const;

export type EventType = keyof typeof JsonLdTypes;
export type JsonLdType = (typeof JsonLdTypes)[EventType];

const EventTypeByJsonLd = Object.fromEntries(
  Object.entries(JsonLdTypes).map(([k, v]) => [v, k])
) as Record<JsonLdType, EventType>;

/** JSON-LD id: `{@type}:{suffix}`. */
export function eventJsonLdId(atType: string, suffix: string): string {
  return `${atType}:${suffix}`;
}

export function jsonLdTypeFor(type: EventType): JsonLdType {
  return JsonLdTypes[type];
}

/** Short event name derived from the payload `@type`. */
export function eventTypeOf(e: { payload: { "@type"?: string } }): EventType | undefined {
  return EventTypeByJsonLd[e.payload["@type"] as JsonLdType];
}

/**
 * Domain identifier suffix of a payload `@id` (the part after `{@type}:`),
 * e.g. the redemptionId of `urn:brutality:tcg:PackOpening:{redemptionId}`.
 */
export function domainSuffixOf(payload: {
  "@id"?: string;
  "@type"?: string;
}): string | undefined {
  const id = payload["@id"];
  const type = payload["@type"];
  if (!id || !type || !id.startsWith(`${type}:`)) return undefined;
  return id.slice(type.length + 1);
}

/**
 * Domain resource carried by an event: its own `@id`/`@type` plus
 * domain-specific fields. Envelope fields (`seq`, `ts`, `prevId`, `proof`)
 * live at the root.
 */
export interface LedgerEventPayload {
  "@id": string;
  "@type": JsonLdType;
  [key: string]: unknown;
}

export interface LedgerEvent {
  /** `urn:brutality:tcg:Event:{contentHash}` — content-addressed chain link. */
  "@id": string;
  "@type": typeof EVENT_TYPE;
  seq: number;
  ts: string;
  /** Previous event `@id`. Omitted on the Genesis event (chain root). */
  prevId?: string;
  payload: LedgerEventPayload;
  proof: DataIntegrityProof;
}

export interface EventSpec {
  type: EventType;
  /**
   * Domain identifier suffix for the payload `@id`
   * (e.g. a redemptionId, collector publicId, or `{setCode}:{version}`).
   */
  domainId: string;
  /** Domain-specific fields only; `@id`/`@type` are added automatically. */
  payload: Record<string, unknown>;
}
