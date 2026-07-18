import crypto from "node:crypto";
import { canonicalize } from "./canonical";
import { getSigningKey, ed25519PublicKeyMultibase, verificationMethodFor } from "./keys";
import { createDataIntegrityProof, verifyDataIntegrityProof } from "./dataIntegrity";
import {
  appendRaw,
  getHeadId,
  getLastSeq,
  readAllEvents,
} from "./ledgerFile";
import {
  EVENT_TYPE,
  JsonLdTypes,
  domainSuffixOf,
  eventEnvelopeId,
  eventJsonLdId,
  eventSeqOf,
  eventTypeOf,
  jsonLdTypeFor,
  type EventSpec,
  type EventType,
  type LedgerEvent,
  type LedgerEventPayload,
} from "./ledgerTypes";

export {
  EVENT_TYPE,
  JsonLdTypes,
  domainSuffixOf,
  eventEnvelopeId,
  eventJsonLdId,
  eventSeqOf,
  eventTypeOf,
  jsonLdTypeFor,
};
export type { EventType, EventSpec, LedgerEvent, LedgerEventPayload };

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Content hashed for the envelope `@id` (and chain binding): everything except
 * the root `@id`/`@type` (derived from this hash / constant) and `proof`
 * (added after). The payload — including its domain `@id`/`@type` — is inside.
 */
export function eventContentHash(e: {
  seq: number;
  ts: string;
  prevId?: string;
  payload: LedgerEventPayload;
}): string {
  const body: Record<string, unknown> = {
    seq: e.seq,
    ts: e.ts,
    payload: e.payload,
  };
  if (e.prevId !== undefined) body.prevId = e.prevId;
  return sha256Hex(canonicalize(body));
}

/**
 * Document signed by the Data Integrity proof (everything except `proof`).
 * `seq` is not a field of its own; it is folded into `@id`, which is signed.
 */
function unsecuredDocument(e: Omit<LedgerEvent, "proof">): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    "@id": e["@id"],
    "@type": e["@type"],
    ts: e.ts,
    payload: e.payload,
  };
  if (e.prevId !== undefined) doc.prevId = e.prevId;
  return doc;
}

function buildSignedEvent(
  type: EventType,
  domainId: string,
  fields: Record<string, unknown>,
  prevId: string | null,
  seq: number
): LedgerEvent {
  const key = getSigningKey();
  const ts = new Date().toISOString();
  const atType = jsonLdTypeFor(type);
  const payload: LedgerEventPayload = {
    "@id": eventJsonLdId(atType, domainId),
    "@type": atType,
    ...fields,
  };

  const hash = eventContentHash({
    seq,
    ts,
    prevId: prevId ?? undefined,
    payload,
  });

  const unsecured: Omit<LedgerEvent, "proof"> = {
    "@id": eventEnvelopeId(seq, hash),
    "@type": EVENT_TYPE,
    ts,
    ...(prevId !== null ? { prevId } : {}),
    payload,
  };

  const proof = createDataIntegrityProof(unsecuredDocument(unsecured), {
    created: ts,
    verificationMethod: key.verificationMethod,
    privateKey: key.privateKey,
  });

  return { ...unsecured, proof };
}

/**
 * Appends one or more signed, hash-chained events to the JSONL ledger as a
 * single atomic write. If the ledger is empty, a Genesis event is written
 * first and becomes the chain root.
 */
export function appendEvents(specs: EventSpec[]): LedgerEvent[] {
  if (specs.length === 0) return [];
  for (const s of specs) {
    if (s.type === "genesis") {
      throw new Error("Genesis is created automatically; do not append it manually");
    }
  }

  let prevId = getHeadId();
  let seq = getLastSeq();
  const built: LedgerEvent[] = [];

  if (prevId === null) {
    seq += 1;
    // The chain root's domain resource is identified by the signing key.
    const genesis = buildSignedEvent(
      "genesis",
      getSigningKey().publicKeyMultibase,
      { schemaVersion: 1 },
      null,
      seq
    );
    built.push(genesis);
    prevId = genesis["@id"];
  }

  for (const spec of specs) {
    seq += 1;
    const event = buildSignedEvent(spec.type, spec.domainId, spec.payload, prevId, seq);
    built.push(event);
    prevId = event["@id"];
  }

  appendRaw(built);
  return built;
}

export function appendEvent(
  type: EventType,
  domainId: string,
  payload: Record<string, unknown>
): LedgerEvent {
  const events = appendEvents([{ type, domainId, payload }]);
  return events[events.length - 1];
}

export function listEvents(afterSeq = 0, limit = Number.MAX_SAFE_INTEGER): LedgerEvent[] {
  const all = readAllEvents();
  const out: LedgerEvent[] = [];
  for (const e of all) {
    if (eventSeqOf(e) > afterSeq) out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export interface VerifyResult {
  ok: boolean;
  checkedEvents: number;
  headId: string | null;
  errors: string[];
}

/** Verifies the full hash chain and every Data Integrity proof. */
export function verifyChain(events: LedgerEvent[], publicKeyPem: string): VerifyResult {
  const errors: string[] = [];
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const keyMultibase = ed25519PublicKeyMultibase(publicKey);
  const expectedVm = verificationMethodFor(publicKey);
  let prev: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const seq = eventSeqOf(e);
    const seqLabel = Number.isNaN(seq) ? i + 1 : seq;

    if (e["@type"] !== EVENT_TYPE) {
      errors.push(`seq ${seqLabel}: root @type must be ${EVENT_TYPE}`);
    }

    const shortType = eventTypeOf(e);
    if (!shortType) {
      errors.push(`seq ${seqLabel}: unknown payload @type ${e.payload?.["@type"]}`);
    }
    const domainSuffix = domainSuffixOf(e.payload ?? {});
    if (domainSuffix === undefined || domainSuffix.length === 0) {
      errors.push(`seq ${seqLabel}: payload @id must be {payload @type}:{domain id}`);
    }

    if (seq !== i + 1) {
      errors.push(`seq ${seqLabel}: expected seq ${i + 1}`);
    }

    const isGenesis = i === 0;
    if (isGenesis) {
      if (shortType !== "genesis") {
        errors.push(`seq ${seqLabel}: first event must be Genesis`);
      }
      if (domainSuffix !== keyMultibase) {
        errors.push(`seq ${seqLabel}: Genesis @id must carry the signing key`);
      }
      if (e.prevId !== undefined) {
        errors.push(`seq ${seqLabel}: Genesis must not have a prevId`);
      }
    } else if (e.prevId !== prev) {
      errors.push(`seq ${seqLabel}: prevId mismatch (expected ${prev}, got ${e.prevId})`);
    }

    // Envelope @id folds seq together with the content hash of envelope+payload.
    const hash = eventContentHash({
      seq,
      ts: e.ts,
      prevId: e.prevId,
      payload: e.payload,
    });
    if (e["@id"] !== eventEnvelopeId(seq, hash)) {
      errors.push(`seq ${seqLabel}: @id does not match seq + content hash`);
    }

    if (e.proof?.verificationMethod !== expectedVm) {
      errors.push(`seq ${seqLabel}: proof verificationMethod does not match signing key`);
    }
    const { proof: _proof, ...unsecured } = e;
    if (!e.proof || !verifyDataIntegrityProof(unsecuredDocument(unsecured), e.proof, publicKey)) {
      errors.push(`seq ${seqLabel}: invalid proof`);
    }
    prev = e["@id"];
  }

  return {
    ok: errors.length === 0,
    checkedEvents: events.length,
    headId: prev,
    errors,
  };
}
