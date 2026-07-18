import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./env";

export interface SigningKey {
  keyId: string;
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  publicKeyPem: string;
  /** did:key-style Ed25519 public key: multicodec 0xed01 + base58btc, `z` prefix. */
  publicKeyMultibase: string;
  /** `did:key:{multibase}`. */
  did: string;
  /** Data Integrity verification method: `did:key:{multibase}#{multibase}`. */
  verificationMethod: string;
}

let cached: SigningKey | null = null;

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58btcEncode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58_ALPHABET[digits[i]];
  return out;
}

export function base58btcDecode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of str) {
    let carry = BASE58_ALPHABET.indexOf(ch);
    if (carry < 0) throw new Error(`invalid base58 character: ${ch}`);
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let k = 0; k < str.length && str[k] === "1"; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

/** Decodes a `z`-prefixed base58btc multibase string to raw bytes. */
export function multibaseDecode(value: string): Uint8Array {
  if (!value.startsWith("z")) throw new Error("expected base58btc multibase (z-prefix)");
  return base58btcDecode(value.slice(1));
}

/** Multibase (base58btc, `z`) of the Ed25519 public key with multicodec prefix. */
export function ed25519PublicKeyMultibase(publicKey: crypto.KeyObject): string {
  const jwk = publicKey.export({ format: "jwk" }) as { x?: string };
  if (!jwk.x) throw new Error("expected an Ed25519 public key");
  const raw = Buffer.from(jwk.x, "base64url");
  const prefixed = Buffer.concat([Buffer.from([0xed, 0x01]), raw]);
  return "z" + base58btcEncode(prefixed);
}

/** Data Integrity verification method (`did:key`) for an Ed25519 public key. */
export function verificationMethodFor(publicKey: crypto.KeyObject): string {
  const mb = ed25519PublicKeyMultibase(publicKey);
  return `did:key:${mb}#${mb}`;
}

/**
 * Loads (or creates on first use) the Ed25519 ledger signing key.
 * The private key stays in data/keys/ and is gitignored; the public key is
 * served from the public verification endpoint.
 */
export function getSigningKey(): SigningKey {
  if (cached) return cached;

  const keysDir = path.join(dataDir(), "keys");
  fs.mkdirSync(keysDir, { recursive: true });
  const privPath = path.join(keysDir, "ledger-ed25519.pem");
  const pubPath = path.join(keysDir, "ledger-ed25519.pub.pem");

  let privateKey: crypto.KeyObject;
  if (fs.existsSync(privPath)) {
    privateKey = crypto.createPrivateKey(fs.readFileSync(privPath, "utf8"));
  } else {
    const pair = crypto.generateKeyPairSync("ed25519");
    privateKey = pair.privateKey;
    fs.writeFileSync(privPath, privateKey.export({ type: "pkcs8", format: "pem" }), {
      mode: 0o600,
    });
    fs.writeFileSync(
      pubPath,
      pair.publicKey.export({ type: "spki", format: "pem" })
    );
  }

  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const publicKeyMultibase = ed25519PublicKeyMultibase(publicKey);
  const did = `did:key:${publicKeyMultibase}`;
  const verificationMethod = `${did}#${publicKeyMultibase}`;
  const keyId = crypto
    .createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex")
    .slice(0, 16);

  cached = {
    keyId,
    privateKey,
    publicKey,
    publicKeyPem,
    publicKeyMultibase,
    did,
    verificationMethod,
  };
  return cached;
}
