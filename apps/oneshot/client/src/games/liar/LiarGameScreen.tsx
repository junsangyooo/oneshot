import { useState } from "react";
import type {
  LiarCategoryId,
  LiarConfigurePayload,
  LiarPrivateState,
  LiarPublicState,
} from "@oneshot/shared";
import { FOOL_LIAR_ACTIONS, LIAR_ACTIONS, LIAR_CATEGORY_IDS } from "@oneshot/shared";
import { useRoomStore } from "../../app/useRoomStore";
import { useT } from "../../i18n";
import { Backdrop, SettingsModal, RulesModal, ConfirmModal } from "../../ui/terminal";
import type { GameScreenProps } from "../registry";
import { LiarCard } from "./LiarCard";
import { LiarSetup } from "./LiarSetup";

// Both liar games share this screen — the server already tailors each player's
// card, so the only per-game difference is which action namespace to send.
export const LiarGameScreen = ({ roomState, privateState, currentPlayerId }: GameScreenProps) => {
  const t = useT();
  const send = useRoomStore((state) => state.send);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const gameId = roomState.activeGame?.gameId;
  const actions = gameId === "fool-liar" ? FOOL_LIAR_ACTIONS : LIAR_ACTIONS;
  const pub = roomState.activeGame?.publicState as LiarPublicState | undefined;
  const me = privateState as LiarPrivateState | null;
  const myPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = myPlayer?.isHost ?? false;

  const sendAction = (type: string, payload?: unknown) =>
    send({ type: "game:action", action: { type, payload, clientActionId: crypto.randomUUID() } });

  if (!pub) {
    return (
      <main className="scr scr--liar">
        <Backdrop />
        <div className="liar-loading">{t("liar.loading")}</div>
      </main>
    );
  }

  return (
    <main className="scr scr--liar">
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>LIAR_PROTOCOL</div>
          <div>
            SECTOR_ID: <span className="hot">#{roomState.roomCode}</span>
          </div>
          <div>LIARS: {pub.liarCount > 0 ? String(pub.liarCount).padStart(2, "0") : "--"}</div>
        </div>
        <div className="liar-title">{t(`game.${gameId ?? "liar"}`)}</div>
        <div className="liar-toolbar">
          <button className="btn btn--sm" type="button" aria-label={t("rules.help")} onClick={() => setRulesOpen(true)}>
            <span>?</span>
          </button>
          <button className="btn btn--sm" type="button" aria-label={t("settings.title")} onClick={() => setSettingsOpen(true)}>
            <span>⚙</span>
          </button>
          {isHost && pub.phase !== "setup" ? (
            <button
              className="btn btn--sm btn--danger"
              type="button"
              onClick={() => setEndOpen(true)}
            >
              <span>⏻ {t("liar.endGame")}</span>
            </button>
          ) : null}
        </div>
      </header>

      <section className="liar-stage">
        {pub.phase === "setup" ? (
          <LiarSetup
            isHost={isHost}
            maxLiars={pub.maxLiars}
            title={t(gameId === "fool-liar" ? "foolliar.setup.title" : "liar.setup.title")}
            onConfigure={(payload: LiarConfigurePayload) => sendAction(actions.configure, payload)}
          />
        ) : (
          <RevealView pub={pub} me={me} />
        )}
      </section>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t("liar.rules.title")}
        paragraphs={[t("liar.rules.p1"), t("liar.rules.p2"), t("liar.rules.p3"), t("liar.rules.p4")]}
      />
      <ConfirmModal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={() => sendAction(actions.endGame)}
        title={t("endgame.title")}
        body={t("endgame.body")}
        confirmLabel={t("endgame.confirm")}
        cancelLabel={t("endgame.cancel")}
      />
    </main>
  );
};

const RevealView = ({ pub, me }: { pub: LiarPublicState; me: LiarPrivateState | null }) => {
  const t = useT();
  const categoryId = (me?.categoryId ?? pub.categoryId);

  return (
    <div className="liar-reveal">
      <div className="liar-reveal__head">
        <span className="panel-label">{t("liar.reveal.category")}</span>
        <span className="liar-category">{categoryId ? t(`liarcat.${categoryId}`) : "—"}</span>
      </div>

      <LiarCard card={me?.card ?? null} categoryId={categoryId} />

      <p className="liar-hint">{t("liar.reveal.hint")}</p>
    </div>
  );
};

// re-exported so the lobby category preview (if ever needed) can reuse the order
export const LIAR_CATEGORY_ORDER: LiarCategoryId[] = LIAR_CATEGORY_IDS;
