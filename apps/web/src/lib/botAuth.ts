import crypto from "node:crypto";

/**
 * Shared-secret auth for the internal bot API. The bot sends
 * `Authorization: Bearer <BOT_API_SECRET>`.
 */
export function botAuthorized(request: Request): boolean {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;

  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}
