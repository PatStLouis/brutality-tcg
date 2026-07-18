/**
 * Seeds the database from the static demo ledger fixture
 * (fixtures/demo-ledger.json). Use --force to wipe existing state.
 */
import { importFixture, fixturePath } from "../fixture";
import { checkProjections } from "../projections";

// npm strips flags when forwarding through nested workspace scripts, so the
// env var form (FORCE=true npm run seed:demo) is supported too.
const force =
  process.argv.includes("--force") || (process.env.FORCE ?? "").toLowerCase() === "true";

try {
  const result = importFixture(fixturePath(), force);
  console.log(
    `Imported demo fixture: ${result.events} events, ${result.collectors} collectors, ${result.redemptions} redemptions`
  );
  const check = checkProjections();
  console.log(check.ok ? "Projections verified against ledger replay." : "PROJECTION MISMATCH");
  if (!check.ok) {
    for (const err of check.errors) console.error(`  ${err}`);
    process.exit(1);
  }
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
