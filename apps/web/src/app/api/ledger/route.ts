import { NextResponse } from "next/server";
import { listEvents, getSigningKey, EVENT_TYPE, JsonLdTypes, initStore } from "@brutality/core";

/**
 * Public, machine-readable ledger export. Payloads contain pseudonymous
 * collector ids only; Discord identities are never present.
 *
 * Default response is a JSON envelope with verification metadata. Pass
 * `?format=jsonl` to stream the raw append-only ledger, one event per line —
 * the exact canonical form stored on disk.
 */
export async function GET(request: Request) {
  initStore();
  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after") ?? "0");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100000"), 100000);
  const events = listEvents(Number.isFinite(after) ? after : 0, limit);

  if (url.searchParams.get("format") === "jsonl") {
    const body = events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
    return new Response(body, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  }

  const key = getSigningKey();
  return NextResponse.json({
    eventType: EVENT_TYPE,
    genesisType: JsonLdTypes.genesis,
    controller: key.did,
    verificationMethod: key.verificationMethod,
    publicKeyMultibase: key.publicKeyMultibase,
    publicKeyPem: key.publicKeyPem,
    proofCryptosuite: "eddsa-jcs-2022",
    hashAlgorithm: "sha2-256",
    digestEncoding: "digestMultibase (base58btc multihash, z-prefix)",
    canonicalization: "sorted-key JSON (JCS-compatible)",
    count: events.length,
    events,
  });
}
