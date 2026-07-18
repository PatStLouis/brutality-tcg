import type { DataIntegrityProof } from "./dataIntegrity";

/**
 * Root envelope type. Every ledger entry is an `Event`, content-addressed as
 * `urn:brutality:tcg:Event:{contentHash}`. What *kind* of thing happened
 * lives inside `payload` as its own JSON-LD resource. The Genesis context
 * aliases compact `id`/`type` keys to JSON-LD `@id`/`@type`.
 */
export const EVENT_TYPE = "urn:brutality:tcg:Event";
export const EVENT_TERM = "Event";

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

export const TypeTerms = {
  genesis: "Genesis",
  set_published: "SetPublished",
  collector_created: "CollectorCreated",
  credits_granted: "CreditsGranted",
  credit_reserved: "CreditReserved",
  redemption_committed: "RedemptionCommitted",
  pack_opened: "PackOpening",
  redemption_expired: "RedemptionExpired",
  credit_released: "CreditReleased",
  admin_correction: "AdminCorrection",
  card_trading: "CardTrading",
} as const;

export type EventTypeTerm = (typeof TypeTerms)[EventType];

const EventTypeByTerm = Object.fromEntries(
  Object.entries(TypeTerms).map(([key, term]) => [term, key])
) as Record<EventTypeTerm, EventType>;

/** JSON-LD id: `{@type}:{suffix}`. */
export function eventJsonLdId(atType: string, suffix: string): string {
  return `${atType}:${suffix}`;
}

/** Envelope `@id`: `urn:brutality:tcg:Event:{seq}-{contentHash}`. */
export function eventEnvelopeId(seq: number, contentHash: string): string {
  return eventJsonLdId(EVENT_TYPE, `${seq}-${contentHash}`);
}

/** Sequence number folded into an envelope id, or `NaN` if unparseable. */
export function eventSeqOf(e: { id?: string; "@id"?: string }): number {
  // `@id` fallback lets a forced fixture import inspect and replace a v0 ledger.
  const id = e.id ?? e["@id"];
  if (!id) return NaN;
  const suffix = id.slice(EVENT_TYPE.length + 1);
  const dash = suffix.indexOf("-");
  return dash === -1 ? NaN : Number(suffix.slice(0, dash));
}

export function jsonLdTypeFor(type: EventType): JsonLdType {
  return JsonLdTypes[type];
}

export function typeTermFor(type: EventType): EventTypeTerm {
  return TypeTerms[type];
}

/** Internal event name derived from the compact payload `type`. */
export function eventTypeOf(e: { payload: { type?: string } }): EventType | undefined {
  return EventTypeByTerm[e.payload.type as EventTypeTerm];
}

/**
 * Domain identifier suffix of a payload `id` (the part after its expanded type),
 * e.g. the redemptionId of `urn:brutality:tcg:PackOpening:{redemptionId}`.
 */
export function domainSuffixOf(payload: {
  id?: string;
  type?: string;
}): string | undefined {
  const id = payload.id;
  const eventType = EventTypeByTerm[payload.type as EventTypeTerm];
  if (!id || !eventType) return undefined;
  const expandedType = JsonLdTypes[eventType];
  if (!id.startsWith(`${expandedType}:`)) return undefined;
  return id.slice(expandedType.length + 1);
}

/**
 * Domain resource carried by an event: its own compact `id`/`type` plus
 * domain-specific fields. Envelope fields (`@id` carrying `seq` and the
 * chained digest, `ts`, `proof`) live at the root.
 */
export interface LedgerEventPayload {
  id: string;
  type: EventTypeTerm;
  [key: string]: unknown;
}

export interface LedgerEvent {
  /**
   * `urn:brutality:tcg:Event:{seq}-{digestMultibase}` — the ordered, content-
   * addressed chain link. `seq` is read from here via `eventSeqOf`.
   *
   * The digest is computed over this same document with the *previous*
   * event's `id` in this slot (Genesis uses its own payload `id` as the
   * anchor), then replaced by the result — so the chain link is implicit in
   * the digest and there is no separate `prevId` field.
   */
  /** Present only on Genesis; establishes the context for the JSONL stream. */
  "@context"?: string;
  id: string;
  type: typeof EVENT_TERM;
  ts: string;
  payload: LedgerEventPayload;
  proof: DataIntegrityProof;
}

export interface EventSpec {
  type: EventType;
  /**
   * Domain identifier suffix for the payload `id`
   * (e.g. a redemptionId, collector publicId, or `{setCode}:{version}`).
   */
  domainId: string;
  /** Domain-specific fields only; compact `id`/`type` are added automatically. */
  payload: Record<string, unknown>;
}
