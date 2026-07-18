import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./env";

export interface SigningKey {
  keyId: string;
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  publicKeyPem: string;
}

let cached: SigningKey | null = null;

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
  const keyId = crypto
    .createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex")
    .slice(0, 16);

  cached = { keyId, privateKey, publicKey, publicKeyPem };
  return cached;
}
