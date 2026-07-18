import crypto from "node:crypto";
import { canonicalize } from "./canonical";
import { base58btcEncode, multibaseDecode } from "./keys";

/**
 * W3C Data Integrity proof, `eddsa-jcs-2022` cryptosuite.
 *
 * Note on canonicalization: `eddsa-jcs-2022` specifies JCS (RFC 8785). Our
 * {@link canonicalize} produces sorted-key, whitespace-free JSON, which is
 * equivalent to JCS for the value types this ledger uses (strings, integers,
 * booleans, arrays, objects — no floats). It is used consistently for signing
 * and verifying here; a full RFC 8785 implementation can be dropped in later
 * for cross-implementation interop without changing the event shape.
 */
export interface DataIntegrityProof {
  type: "DataIntegrityProof";
  cryptosuite: "eddsa-jcs-2022";
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

export type ProofOptions = Omit<DataIntegrityProof, "proofValue">;

function sha256Bytes(input: string): Buffer {
  return crypto.createHash("sha256").update(input, "utf8").digest();
}

/** hashData = SHA-256(JCS(proofConfig)) || SHA-256(JCS(document)). */
function hashData(proofConfig: ProofOptions, unsecuredDoc: Record<string, unknown>): Buffer {
  const proofConfigHash = sha256Bytes(canonicalize(proofConfig));
  const docHash = sha256Bytes(canonicalize(unsecuredDoc));
  return Buffer.concat([proofConfigHash, docHash]);
}

export function createDataIntegrityProof(
  unsecuredDoc: Record<string, unknown>,
  opts: {
    created: string;
    verificationMethod: string;
    privateKey: crypto.KeyObject;
    proofPurpose?: string;
  }
): DataIntegrityProof {
  const proofConfig: ProofOptions = {
    type: "DataIntegrityProof",
    cryptosuite: "eddsa-jcs-2022",
    created: opts.created,
    verificationMethod: opts.verificationMethod,
    proofPurpose: opts.proofPurpose ?? "assertionMethod",
  };
  const data = hashData(proofConfig, unsecuredDoc);
  const sig = crypto.sign(null, data, opts.privateKey);
  return { ...proofConfig, proofValue: "z" + base58btcEncode(sig) };
}

export function verifyDataIntegrityProof(
  unsecuredDoc: Record<string, unknown>,
  proof: DataIntegrityProof,
  publicKey: crypto.KeyObject
): boolean {
  if (proof.type !== "DataIntegrityProof" || proof.cryptosuite !== "eddsa-jcs-2022") {
    return false;
  }
  if (typeof proof.proofValue !== "string" || !proof.proofValue.startsWith("z")) {
    return false;
  }
  const { proofValue, ...proofConfig } = proof;
  const data = hashData(proofConfig, unsecuredDoc);
  let sig: Buffer;
  try {
    sig = Buffer.from(multibaseDecode(proofValue));
  } catch {
    return false;
  }
  return crypto.verify(null, data, publicKey, sig);
}
