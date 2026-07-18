/**
 * Demo mode constants. The guest account is a normal collector keyed by a
 * reserved fake Discord id, so the rest of the system needs no special cases.
 */
export const DEMO_GUEST_DISCORD_ID = "demo-guest-000000000000";
export const DEMO_GUEST_USERNAME = "Guest";

export function demoEnabled(): boolean {
  return (process.env.DEMO ?? "").toLowerCase() === "true";
}
