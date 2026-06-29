import { useState } from "react";
import type { LiarCard as LiarCardData, LiarCategoryId } from "@oneshot/shared";
import { LIAR_CATEGORIES } from "@oneshot/shared";
import { useT, useLangStore } from "../../i18n";

// The player's own secret card. Hidden by default behind a theme-appropriate
// cover (cyber: glitch/scanline block · cozy: a flipped card back); tapping
// toggles it open/closed so it isn't left exposed on a shared screen.
export const LiarCard = ({
  card,
  categoryId,
}: {
  card: LiarCardData | null;
  categoryId: LiarCategoryId | null;
}) => {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [revealed, setRevealed] = useState(false);

  const label =
    card == null
      ? "—"
      : card.kind === "liar"
        ? t("liar.card.liarWord")
        : (categoryId ? LIAR_CATEGORIES[categoryId][card.wordIndex]?.[lang] : undefined) ?? "—";

  const isLiarCard = card?.kind === "liar";

  return (
    <button
      type="button"
      className={`liar-card ${revealed ? "is-revealed" : "is-hidden"} ${isLiarCard ? "is-liar" : ""}`}
      onClick={() => setRevealed((value) => !value)}
      aria-label={revealed ? t("liar.card.tapHide") : t("liar.card.tapReveal")}
    >
      <span className="liar-card__cover" aria-hidden={revealed}>
        <span className="liar-card__cover-glyph">?</span>
        <span className="liar-card__cover-hint">{t("liar.card.tapReveal")}</span>
      </span>
      <span className="liar-card__face" aria-hidden={!revealed}>
        <span className="liar-card__word">{label}</span>
        <span className="liar-card__hint">{t("liar.card.tapHide")}</span>
      </span>
    </button>
  );
};
