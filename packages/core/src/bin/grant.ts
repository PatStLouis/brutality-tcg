import { grantCredits, creditBalance } from "../redemption";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Supports both flag style (--user x --packs 3) and positional style
// (grant.ts <discordId> [packs] [reason]) since npm can strip -- flags when
// forwarding through nested workspace scripts.
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const user = arg("user") ?? positional[0];
const packs = Number(arg("packs") ?? positional[1] ?? "5");
const reason = arg("reason") ?? positional[2] ?? "admin_grant";

if (!user || !Number.isInteger(packs) || packs <= 0) {
  console.error("Usage: npm run grant -- <discordId> [packs] [reason]");
  process.exit(1);
}

const collector = grantCredits(user, packs, reason);
const balance = creditBalance(collector.publicId);
console.log(
  `Granted ${packs} pack(s) to discord:${user} (public id ${collector.publicId}). Balance: ${balance.available} available, ${balance.reserved} reserved.`
);
