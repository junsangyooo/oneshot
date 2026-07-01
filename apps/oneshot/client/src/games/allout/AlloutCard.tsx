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
  wild: "✦",
};

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
  const label = card.kind === "number" ? String(card.value) : KIND_GLYPH[card.kind];
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
      <span className="ao-card__v">{label}</span>
    </button>
  );
};
