import { LEDGER_CONTEXT_DOCUMENT } from "@brutality/core";

/** Versioned JSON-LD context declared once by the ledger's Genesis event. */
export async function GET() {
  return Response.json(LEDGER_CONTEXT_DOCUMENT, {
    headers: {
      "Content-Type": "application/ld+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
