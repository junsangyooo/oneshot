import type { AlloutCard as TCard } from "@oneshot/shared";
import { useT } from "../../i18n";

// Glyphs for non-number cards. Colors carry meaning so faces stay text-light.
const KIND_GLYPH: Record<TCard["kind"], string> = {
  number: "",
  plus2: "+2",
  plus4: "+4",
  plus7: "+7",
  exchange: "⇄",
  reverse: "⟲",
  shield: "⛨",
  reflect: "↩",
  wild: "", // wild face is the 4-color disc, not a glyph
};

// Colorless kinds get a 4-color strip so "matches any color" is visible at a glance.
const MULTI: TCard["kind"][] = ["plus4", "plus7", "exchange", "reflect", "wild"];

type Props = {
  card: TCard;
  selected?: boolean;
  dim?: boolean;
  glow?: boolean;
  onClick?: () => void;
};

export const AlloutCardFace = ({ card, selected, dim, glow, onClick }: Props) => {
  const t = useT();
  const color = "color" in card ? card.color : null;
  const aria =
    card.kind === "number"
      ? `${t(`allout.color.${card.color}`)} ${card.value}`
      : t(`allout.card.${card.kind}`);
  const cls = [
    "ao-card",
    `ao-card--${card.kind}`,
    card.kind === "plus7" ? "ao-card--joker" : "",
    card.kind === "exchange" ? "ao-card--fancy" : "",
    selected ? "is-selected" : "",
    dim ? "is-dim" : "",
    glow ? "is-glow" : "",
    onClick ? "" : "ao-card--static",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      data-color={color ?? "wild"}
      onClick={onClick}
      disabled={!onClick}
      aria-label={aria}
    >
      {card.kind === "number" ? (
        <>
          <span className="ao-card__pip" aria-hidden>
            {card.value}
          </span>
          <span className="ao-card__v">{card.value}</span>
          <span className="ao-card__pip ao-card__pip--br" aria-hidden>
            {card.value}
          </span>
        </>
      ) : (
        <>
          {card.kind === "wild" ? (
            <span className="ao-card__quad" aria-hidden />
          ) : (
            <span className="ao-card__v">{KIND_GLYPH[card.kind]}</span>
          )}
          <span className="ao-card__k">{t(`allout.cardk.${card.kind}`)}</span>
          {MULTI.includes(card.kind) && card.kind !== "plus7" ? (
            <span className="ao-card__multi" aria-hidden />
          ) : null}
        </>
      )}
    </button>
  );
};
