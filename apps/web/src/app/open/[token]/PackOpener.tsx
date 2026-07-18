"use client";

import { useCallback, useEffect, useState } from "react";
import { CardFace } from "@/components/CardFace";

interface OpenedCard {
  cardId: string;
  number: number;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "ultra_rare" | "legendary";
  image: string | null;
}

type Stage = "sealed" | "tearing" | "revealing" | "done" | "error";

export function PackOpener({
  token,
  alreadyOpened,
  commitment,
}: {
  token: string;
  alreadyOpened: boolean;
  commitment: string;
}) {
  const [stage, setStage] = useState<Stage>(alreadyOpened ? "done" : "sealed");
  const [cards, setCards] = useState<OpenedCard[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const finalize = useCallback(async (): Promise<OpenedCard[] | null> => {
    const res = await fetch(`/api/open/${token}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.status === "expired" ? "This pack expired." : "Could not open this pack.");
      setStage("error");
      return null;
    }
    const body = (await res.json()) as { cards: OpenedCard[] };
    setCards(body.cards);
    return body.cards;
  }, [token]);

  // Already-opened links show the same result immediately.
  useEffect(() => {
    if (alreadyOpened) {
      finalize();
    }
  }, [alreadyOpened, finalize]);

  const tearOpen = async () => {
    if (stage !== "sealed") return;
    setStage("tearing");
    const opened = await finalize();
    if (opened) {
      setRevealIndex(0);
      setTimeout(() => setStage("revealing"), 600);
    }
  };

  const revealNext = () => {
    if (revealIndex < cards.length - 1) {
      setRevealIndex((i) => i + 1);
    } else {
      setStage("done");
    }
  };

  if (stage === "error") {
    return (
      <div className="open-stage">
        <h1>Pack unavailable</h1>
        <p className="muted">{error}</p>
      </div>
    );
  }

  if (stage === "sealed" || stage === "tearing") {
    return (
      <div className="open-stage">
        <h1>Your pack awaits</h1>
        <div
          className={`pack${stage === "tearing" ? " pack--tearing" : ""}`}
          onClick={tearOpen}
          role="button"
          aria-label="Tear the pack open"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && tearOpen()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/brand/pack.webp" alt="Sealed Brutality pack" />
        </div>
        <div className="tap-hint">Tap the pack to tear it open</div>
        <div className="commitment">commitment: {commitment}</div>
      </div>
    );
  }

  if (stage === "revealing" && cards.length > 0) {
    const card = cards[revealIndex];
    return (
      <div className="open-stage" onClick={revealNext}>
        <div className="reveal-area">
          <div className="flip" key={card.cardId + revealIndex}>
            <div className="flip__back" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/brand/cardback.webp" alt="" />
            </div>
            <div className="flip__front">
              <CardFace
                name={card.name}
                number={card.number}
                rarity={card.rarity}
                image={card.image}
              />
            </div>
          </div>
        </div>
        <div className="tap-hint">
          Card {revealIndex + 1} of {cards.length} — tap to continue
        </div>
      </div>
    );
  }

  return (
    <div className="open-stage">
      <h1>Your pull</h1>
      <div className="final-grid">
        {cards.map((card, i) => (
          <CardFace
            key={`${card.cardId}-${i}`}
            name={card.name}
            number={card.number}
            rarity={card.rarity}
            image={card.image}
          />
        ))}
      </div>
      <p className="muted">
        These cards are now in your binder. <a href="/binder">View binder →</a>
      </p>
      <div className="commitment">commitment: {commitment}</div>
    </div>
  );
}
