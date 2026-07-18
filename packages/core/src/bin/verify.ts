/**
 * Independent-style verifier:
 * 1. Verifies the full hash chain and every event signature.
 * 2. Verifies commit/reveal for every opened pack.
 * 3. Replays events and compares against materialized projections.
 */
import { listEvents, verifyChain } from "../ledger";
import { getSigningKey } from "../keys";
import { checkProjections } from "../projections";
import { computeCommitment } from "../redemption";
import { getSet } from "../cards";

const events = listEvents(0, 1_000_000);
const key = getSigningKey();

const chain = verifyChain(events, key.publicKeyPem);
console.log(`Chain: ${chain.checkedEvents} events, head ${chain.headHash.slice(0, 16)}…`);
if (!chain.ok) {
  for (const err of chain.errors) console.error(`  CHAIN ERROR: ${err}`);
}

let revealErrors = 0;
const commitments = new Map<string, string>();
for (const e of events) {
  if (e.type === "redemption_committed") {
    commitments.set((e.payload as any).redemptionId, (e.payload as any).commitment);
  }
  if (e.type === "pack_opened") {
    const p = e.payload as any;
    const set = getSet(p.setId);
    const expected = computeCommitment(p.redemptionId, p.setId, set.version, p.cardIds, p.nonce);
    const committed = commitments.get(p.redemptionId);
    if (committed !== p.commitment || expected !== p.commitment) {
      revealErrors++;
      console.error(`  COMMITMENT ERROR: redemption ${p.redemptionId}`);
    }
  }
}
console.log(`Commit/reveal: ${revealErrors === 0 ? "all valid" : `${revealErrors} error(s)`}`);

const projections = checkProjections();
console.log(`Projections: ${projections.ok ? "match ledger replay" : "MISMATCH"}`);
for (const err of projections.errors) console.error(`  PROJECTION ERROR: ${err}`);

const ok = chain.ok && revealErrors === 0 && projections.ok;
console.log(ok ? "LEDGER VERIFIED" : "LEDGER VERIFICATION FAILED");
process.exit(ok ? 0 : 1);
