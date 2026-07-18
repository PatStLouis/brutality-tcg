import { NextResponse } from "next/server";
import { listEvents, getSigningKey, GENESIS_HASH } from "@brutality/core";

/**
 * Public, machine-readable ledger export. Payloads contain pseudonymous
 * collector ids only; Discord identities are never present.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after") ?? "0");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "1000"), 5000);
  const events = listEvents(Number.isFinite(after) ? after : 0, limit);
  const key = getSigningKey();

  return NextResponse.json({
    genesisHash: GENESIS_HASH,
    keyId: key.keyId,
    publicKeyPem: key.publicKeyPem,
    hashAlgorithm: "sha256",
    signatureAlgorithm: "ed25519",
    canonicalization: "sorted-key JSON, no whitespace",
    count: events.length,
    events,
  });
}
