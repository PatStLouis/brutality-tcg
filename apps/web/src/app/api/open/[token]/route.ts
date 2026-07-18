import { NextResponse } from "next/server";
import { openPack, getCard, initStore } from "@brutality/core";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  initStore();
  const { token } = await context.params;
  const result = openPack(token);

  if (result.status === "not_found") {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  if (result.status === "expired") {
    return NextResponse.json({ status: "expired" }, { status: 410 });
  }

  const cards = result.redemption.cardIds.map((cardId) => {
    const card = getCard(cardId);
    return {
      cardId: card.cardId,
      number: card.number,
      name: card.name,
      rarity: card.rarity,
      image: card.image,
    };
  });

  return NextResponse.json({
    status: "opened",
    firstOpen: result.firstOpen,
    setId: result.redemption.setId,
    commitment: result.redemption.commitment,
    nonce: result.redemption.nonce,
    cards,
  });
}
