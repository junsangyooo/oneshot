import { useState } from "react";
import type { LiarCategoryId, LiarConfigurePayload } from "@oneshot/shared";
import { LIAR_CATEGORY_IDS } from "@oneshot/shared";
import { useT } from "../../i18n";

// Host-only pre-game setup: pick a category + how many liars. Non-hosts wait.
export const LiarSetup = ({
  isHost,
  maxLiars,
  onConfigure,
}: {
  isHost: boolean;
  maxLiars: number;
  onConfigure: (payload: LiarConfigurePayload) => void;
}) => {
  const t = useT();
  const [categoryId, setCategoryId] = useState<LiarCategoryId | null>(null);
  const [liarCount, setLiarCount] = useState(1);

  if (!isHost) {
    return (
      <div className="liar-wait">
        <div className="liar-wait__pulse">?</div>
        <p>{t("liar.setup.waitingHost")}</p>
      </div>
    );
  }

  const canStart = categoryId != null;
  const start = () => {
    if (categoryId == null) return;
    onConfigure({ categoryId, liarCount });
  };

  return (
    <div className="liar-setup">
      <div className="liar-setup__head">
        <h2>{t("liar.setup.title")}</h2>
        <span className="panel-label">{t("liar.setup.chooseCategory")}</span>
      </div>

      <div className="liar-cat-grid">
        {LIAR_CATEGORY_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`liar-cat ${categoryId === id ? "is-selected" : ""}`}
            onClick={() => setCategoryId(id)}
          >
            {t(`liarcat.${id}`)}
          </button>
        ))}
      </div>

      <div className="liar-setup__liars">
        <span className="panel-label">{t("liar.setup.liarCount")}</span>
        <div className="liar-count-seg">
          {Array.from({ length: maxLiars }, (_, index) => index + 1).map((count) => (
            <button
              key={count}
              type="button"
              className={liarCount === count ? "on" : ""}
              onClick={() => setLiarCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
        <span className="liar-hint liar-hint--dim">{t("liar.setup.liarCountHint")}</span>
      </div>

      <button
        className="btn btn--primary btn--init"
        type="button"
        disabled={!canStart}
        onClick={start}
      >
        <span>{t("liar.setup.start")}</span>
        <span>→</span>
      </button>
    </div>
  );
};
