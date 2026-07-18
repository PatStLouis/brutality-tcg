import { baseUrl } from "./env";
import { EVENT_TYPE, JsonLdTypes } from "./ledgerTypes";

/** Context IRI fixed by Genesis for the lifetime of a ledger. */
export function ledgerContextUrl(): string {
  return (
    process.env.LEDGER_CONTEXT_URL ??
    `${baseUrl().replace(/\/$/, "")}/context/v1`
  );
}

/** JSON-LD 1.1 context served by the web app at `/context/v1`. */
export const LEDGER_CONTEXT_DOCUMENT = {
  "@context": {
    "@version": 1.1,
    "@vocab": "urn:brutality:tcg:",
    id: "@id",
    type: "@type",
    Event: EVENT_TYPE,
    Genesis: JsonLdTypes.genesis,
    SetPublished: JsonLdTypes.set_published,
    CollectorCreated: JsonLdTypes.collector_created,
    CreditsGranted: JsonLdTypes.credits_granted,
    CreditReserved: JsonLdTypes.credit_reserved,
    RedemptionCommitted: JsonLdTypes.redemption_committed,
    PackOpening: JsonLdTypes.pack_opened,
    RedemptionExpired: JsonLdTypes.redemption_expired,
    CreditReleased: JsonLdTypes.credit_released,
    AdminCorrection: JsonLdTypes.admin_correction,
    CardTrading: JsonLdTypes.card_trading,
    Collector: "urn:brutality:tcg:Collector",
    ts: {
      "@id": "urn:brutality:tcg:ts",
      "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
    },
    payload: "urn:brutality:tcg:payload",
    collector: {
      "@id": "urn:brutality:tcg:collector",
      "@type": "@id",
    },
    proof: "https://w3id.org/security#proof",
    DataIntegrityProof: "https://w3id.org/security#DataIntegrityProof",
    cryptosuite: "https://w3id.org/security#cryptosuite",
    created: {
      "@id": "http://purl.org/dc/terms/created",
      "@type": "http://www.w3.org/2001/XMLSchema#dateTime",
    },
    verificationMethod: {
      "@id": "https://w3id.org/security#verificationMethod",
      "@type": "@id",
    },
    proofPurpose: {
      "@id": "https://w3id.org/security#proofPurpose",
      "@type": "@vocab",
    },
    assertionMethod: "https://w3id.org/security#assertionMethod",
    proofValue: "https://w3id.org/security#proofValue",
    set: {
      "@id": "urn:brutality:tcg:set",
      "@type": "@id",
    },
    cards: {
      "@id": "urn:brutality:tcg:cards",
      "@type": "@id",
      "@container": "@list",
    },
  },
} as const;
