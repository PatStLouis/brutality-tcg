import { RARITY_LABELS, type Rarity } from "@brutality/core/cards";

export interface CardFaceProps {
  name: string;
  number: number;
  rarity: Rarity;
  image: string | null;
  setName?: string;
  quantity?: number;
  missing?: boolean;
}

/**
 * Card shell: rarity chrome + nameplate around the artwork area.
 * Until commissioned photography lands, a monogram placeholder fills the art
 * slot; swapping in real art is just providing `image`.
 */
export function CardFace({
  name,
  number,
  rarity,
  image,
  setName = "OG SET",
  quantity,
  missing = false,
}: CardFaceProps) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <div className={`card card--${rarity}${missing ? " card--missing" : ""}`}>
      <div className="card__art">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`${name} card art`} />
        ) : (
          <div className="card__placeholder" aria-hidden>
            {initials}
          </div>
        )}
        {quantity !== undefined && quantity > 1 ? (
          <div className="card__qty">x{quantity}</div>
        ) : null}
      </div>
      <div className="card__nameplate">
        <div className="card__name">{name}</div>
        <div className="card__meta">
          <span className={`rarity rarity--${rarity}`}>{RARITY_LABELS[rarity]}</span>
          <span className="muted">
            {setName} #{String(number).padStart(3, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
