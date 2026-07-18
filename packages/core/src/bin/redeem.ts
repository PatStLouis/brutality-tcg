/** Creates a redemption (like the bot would) and prints the opening URL. */
import { redeemPack } from "../redemption";
import { baseUrl } from "../env";
import { initStore } from "../store";

initStore();

const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const user = positional[0];
if (!user) {
  console.error("Usage: npm run redeem -- <discordId>");
  process.exit(1);
}

const result = redeemPack(user, baseUrl());
if (!result.ok) {
  console.error(`Redeem failed: ${result.reason}`);
  process.exit(1);
}
console.log(result.url);
