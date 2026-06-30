import { useEffect, useState } from "react";
import type {
  PartyRoomState,
  UpstageCard,
  UpstagePrivateState,
  UpstagePublicState,
} from "@oneshot/shared";
import {
  UPSTAGE_ACTIONS,
  UPSTAGE_HANDS_MAX,
  UPSTAGE_HANDS_MIN,
  UPSTAGE_HANDS_DEFAULT,
} from "@oneshot/shared";
import { useRoomStore } from "../../app/useRoomStore";
import { useT } from "../../i18n";
import { Backdrop, AvatarImg, SettingsModal, RulesModal } from "../../ui/terminal";

type Props = {
  roomState: PartyRoomState;
  privateState: unknown;
  currentPlayerId: string | null;
};

const fill = (s: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

const cardLabel = (card: UpstageCard): string => (card.value === "star" ? "★" : String(card.value));

// One playing card.
const CardFace = ({
  card,
  selected,
  onClick,
}: {
  card: UpstageCard;
  selected?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    className={`up-card${card.value === "star" ? " up-card--star" : ""}${selected ? " is-selected" : ""}${onClick ? "" : " up-card--static"}`}
    onClick={onClick}
    disabled={!onClick}
  >
    <span className="up-card__v">{cardLabel(card)}</span>
  </button>
);

export const UpstageGameScreen = ({ roomState, privateState, currentPlayerId }: Props) => {
  const t = useT();
  const send = useRoomStore((s) => s.send);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // setup controls (host)
  const [penalty, setPenalty] = useState(false);
  const [hands, setHands] = useState<number>(UPSTAGE_HANDS_DEFAULT);

  const pub = roomState.activeGame?.publicState as UpstagePublicState | undefined;
  const me = privateState as UpstagePrivateState | null;
  const myPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = myPlayer?.isHost ?? false;

  const sendAction = (type: string, payload?: unknown) =>
    send({ type: "game:action", action: { type, payload, clientActionId: crypto.randomUUID() } });

  // clear selection whenever the phase or turn changes
  useEffect(() => {
    setSelected([]);
  }, [pub?.phase, pub?.currentTurnPlayerId, pub?.pendingTaxReceivers?.length]);

  if (!pub) {
    return (
      <main className="scr scr--upstage">
        <Backdrop />
        <div className="up-loading">{t("upstage.loading")}</div>
      </main>
    );
  }

  const nameOf = (id: string): string =>
    id === currentPlayerId ? t("upstage.you") : (roomState.players[id]?.nickname ?? "—");

  const toggleCard = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const voteOpen = pub.endVote != null;
  const iVoted = voteOpen && currentPlayerId != null && currentPlayerId in (pub.endVote?.votes ?? {});

  return (
    <main className="scr scr--upstage">
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>UP/STG/04X-220</div>
          <div>
            SECTOR_ID: <span className="hot">#{roomState.roomCode}</span>
          </div>
          <div>DECK: 1–{pub.maxRank} · ★×2</div>
        </div>
        <div className="up-round">
          <span className="lbl">{t("upstage.round")}</span>
          <span className="val">
            {String(pub.handNumber).padStart(2, "0")}/{String(pub.totalHands).padStart(2, "0")}
          </span>
        </div>
        <div className="up-toolbar">
          <button className="btn btn--sm" type="button" aria-label={t("rules.help")} onClick={() => setRulesOpen(true)}>
            <span>?</span>
          </button>
          <button className="btn btn--sm" type="button" aria-label={t("settings.title")} onClick={() => setSettingsOpen(true)}>
            <span>⚙</span>
          </button>
          {isHost && pub.phase !== "setup" && pub.phase !== "ended" && !voteOpen ? (
            <button
              className="btn btn--sm btn--danger"
              type="button"
              onClick={() => sendAction(UPSTAGE_ACTIONS.proposeEnd)}
            >
              <span>⏻ {t("upstage.proposeEnd")}</span>
            </button>
          ) : null}
        </div>
      </header>

      <section className="up-stage">
        {pub.phase === "setup" ? (
          <div className="up-panel up-setup">
            <h2 className="up-h">{t("upstage.setup.title")}</h2>
            {isHost ? (
              <>
                <div className="up-field">
                  <span className="up-field__label">{t("upstage.setup.penalty")}</span>
                  <div className="up-seg">
                    <button
                      type="button"
                      className={`up-seg__btn${!penalty ? " is-on" : ""}`}
                      onClick={() => setPenalty(false)}
                    >
                      {t("upstage.setup.penaltyOff")}
                    </button>
                    <button
                      type="button"
                      className={`up-seg__btn${penalty ? " is-on" : ""}`}
                      onClick={() => setPenalty(true)}
                    >
                      {t("upstage.setup.penaltyOn")}
                    </button>
                  </div>
                </div>
                <p className="up-hint">{t("upstage.setup.penaltyDesc")}</p>
                <div className="up-field">
                  <span className="up-field__label">{t("upstage.setup.hands")}</span>
                  <div className="up-stepper">
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => setHands((h) => Math.max(UPSTAGE_HANDS_MIN, h - 1))}
                    >
                      −
                    </button>
                    <span className="up-stepper__v">{hands}</span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => setHands((h) => Math.min(UPSTAGE_HANDS_MAX, h + 1))}
                    >
                      ＋
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--primary up-cta"
                  onClick={() => sendAction(UPSTAGE_ACTIONS.configure, { penalty, totalHands: hands })}
                >
                  {t("upstage.setup.start")}
                </button>
              </>
            ) : (
              <p className="up-wait">{t("upstage.setup.waitingHost")}</p>
            )}
          </div>
        ) : pub.phase === "draw" ? (
          <div className="up-panel up-draw">
            <h2 className="up-h">{t("upstage.draw.title")}</h2>
            <div className="up-draw__grid">
              {pub.order.map((id, index) => {
                const card = pub.drawnCards?.[id];
                return (
                  <div className="up-draw__cell" key={id}>
                    <span className="up-draw__rank">{index + 1}</span>
                    <AvatarImg avatarKey={roomState.players[id]?.avatarKey} themeId={roomState.players[id]?.themeId} />
                    <span className="up-draw__name">{nameOf(id)}</span>
                    {card ? <CardFace card={card} /> : null}
                  </div>
                );
              })}
            </div>
            {isHost ? (
              <button type="button" className="btn btn--primary up-cta" onClick={() => sendAction(UPSTAGE_ACTIONS.startHand)}>
                {t("upstage.draw.start")}
              </button>
            ) : (
              <p className="up-wait">{t("upstage.draw.waitingHost")}</p>
            )}
          </div>
        ) : pub.phase === "declare" ? (
          <div className="up-panel up-declare">
            {pub.declarePlayerId === currentPlayerId ? (
              <>
                <h2 className="up-h">{t("upstage.declare.title")}</h2>
                <p className="up-hint">{t("upstage.declare.hint")}</p>
                <div className="up-declare__actions">
                  <button type="button" className="btn btn--primary" onClick={() => sendAction(UPSTAGE_ACTIONS.declare, { revolt: true })}>
                    {pub.declarePlayerId === pub.order[pub.order.length - 1]
                      ? t("upstage.declare.greatRevolt")
                      : t("upstage.declare.revolt")}
                  </button>
                  <button type="button" className="btn" onClick={() => sendAction(UPSTAGE_ACTIONS.declare, { revolt: false })}>
                    {t("upstage.declare.skip")}
                  </button>
                </div>
              </>
            ) : (
              <p className="up-wait">{t("upstage.declare.waiting")}</p>
            )}
          </div>
        ) : pub.phase === "tax" ? (
          <TaxView
            pub={pub}
            me={me}
            currentPlayerId={currentPlayerId}
            selected={selected}
            toggleCard={toggleCard}
            onReturn={(cards) => sendAction(UPSTAGE_ACTIONS.taxReturn, { cards })}
            nameOf={nameOf}
            t={t}
          />
        ) : pub.phase === "play" ? (
          <PlayView
            pub={pub}
            me={me}
            roomState={roomState}
            currentPlayerId={currentPlayerId}
            selected={selected}
            toggleCard={toggleCard}
            onPlay={(cards) => sendAction(UPSTAGE_ACTIONS.play, { cards })}
            onPass={() => sendAction(UPSTAGE_ACTIONS.pass)}
            nameOf={nameOf}
            t={t}
          />
        ) : pub.phase === "handEnd" ? (
          <HandEndView pub={pub} isHost={isHost} onNext={() => sendAction(UPSTAGE_ACTIONS.nextHand)} nameOf={nameOf} t={t} />
        ) : (
          <div className="up-panel">
            <p className="up-wait">{t("upstage.ended")}</p>
          </div>
        )}
      </section>

      {voteOpen ? (
        <div className="modal-backdrop open" role="presentation">
          <div className="modal up-vote" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3>{t("upstage.vote.title")}</h3>
            </div>
            <div className="modal-body">
              <p className="up-hint">{t("upstage.vote.desc")}</p>
              <p className="up-vote__tally">
                {fill(t("upstage.vote.tally"), {
                  agree: Object.values(pub.endVote!.votes).filter(Boolean).length,
                  total: pub.players.length,
                })}
              </p>
              {iVoted ? (
                <p className="up-wait">{t("upstage.vote.waiting")}</p>
              ) : (
                <div className="up-declare__actions">
                  <button type="button" className="btn btn--primary" onClick={() => sendAction(UPSTAGE_ACTIONS.voteEnd, { agree: true })}>
                    {t("upstage.vote.agree")}
                  </button>
                  <button type="button" className="btn" onClick={() => sendAction(UPSTAGE_ACTIONS.voteEnd, { agree: false })}>
                    {t("upstage.vote.reject")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t("upstage.rules.title")}
        paragraphs={[
          t("upstage.rules.p1"),
          t("upstage.rules.p2"),
          t("upstage.rules.p3"),
          t("upstage.rules.p4"),
          t("upstage.rules.p5"),
          t("upstage.rules.p6"),
        ]}
      />
    </main>
  );
};

// ---------------------------------------------------------------- tax view
type TFn = (key: string) => string;

const TaxView = ({
  pub,
  me,
  currentPlayerId,
  selected,
  toggleCard,
  onReturn,
  nameOf,
  t,
}: {
  pub: UpstagePublicState;
  me: UpstagePrivateState | null;
  currentPlayerId: string | null;
  selected: string[];
  toggleCard: (id: string) => void;
  onReturn: (cards: string[]) => void;
  nameOf: (id: string) => string;
  t: TFn;
}) => {
  const amReceiver = currentPlayerId != null && pub.pendingTaxReceivers.includes(currentPlayerId);
  const owed = currentPlayerId === pub.order[0] ? 2 : 1;
  if (!amReceiver) {
    return (
      <div className="up-panel up-tax">
        <h2 className="up-h">{t("upstage.tax.title")}</h2>
        <p className="up-wait">{t("upstage.tax.waiting")}</p>
        <div className="up-tax__pending">
          {pub.pendingTaxReceivers.map((id) => (
            <span className="up-chip" key={id}>
              {nameOf(id)}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="up-panel up-tax">
      <h2 className="up-h">{t("upstage.tax.youReceive")}</h2>
      <div className="up-hand up-hand--wrap">
        {(me?.hand ?? []).map((card) => (
          <CardFace key={card.id} card={card} selected={selected.includes(card.id)} onClick={() => toggleCard(card.id)} />
        ))}
      </div>
      <button
        type="button"
        className="btn btn--primary up-cta"
        disabled={selected.length !== owed}
        onClick={() => onReturn(selected)}
      >
        {t("upstage.tax.return")} · {fill(t("upstage.tax.pickN"), { n: owed })}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------- play view
const PlayView = ({
  pub,
  me,
  roomState,
  currentPlayerId,
  selected,
  toggleCard,
  onPlay,
  onPass,
  nameOf,
  t,
}: {
  pub: UpstagePublicState;
  me: UpstagePrivateState | null;
  roomState: PartyRoomState;
  currentPlayerId: string | null;
  selected: string[];
  toggleCard: (id: string) => void;
  onPlay: (cards: string[]) => void;
  onPass: () => void;
  nameOf: (id: string) => string;
  t: TFn;
}) => {
  const myTurn = pub.currentTurnPlayerId === currentPlayerId;
  const turnName = pub.currentTurnPlayerId ? nameOf(pub.currentTurnPlayerId) : "—";
  return (
    <div className="up-play">
      <div className="up-seats">
        {pub.order.map((id) => {
          const p = pub.players.find((x) => x.playerId === id);
          const out = (p?.handCount ?? 0) === 0;
          const classes = [
            "up-seat",
            pub.currentTurnPlayerId === id ? "is-turn" : "",
            pub.leadPlayerId === id ? "is-lead" : "",
            out ? "is-out" : "",
            p?.passed ? "is-passed" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div className={classes} key={id}>
              <AvatarImg avatarKey={roomState.players[id]?.avatarKey} themeId={roomState.players[id]?.themeId} />
              <span className="up-seat__name">{nameOf(id)}</span>
              <span className="up-seat__count">{out ? t("upstage.play.out") : p?.handCount}</span>
              {p?.passed ? <span className="up-seat__badge">{t("upstage.play.passed")}</span> : null}
            </div>
          );
        })}
      </div>

      <div className="up-pile">
        <span className="up-pile__label">{t("upstage.play.pile")}</span>
        {pub.currentPlay ? (
          <div className="up-pile__cards">
            {pub.currentPlay.cards.map((c) => (
              <CardFace key={c.id} card={c} />
            ))}
          </div>
        ) : (
          <span className="up-pile__empty">{t("upstage.play.empty")}</span>
        )}
      </div>

      <div className="up-status">
        {myTurn ? (
          <span className="up-status__turn">{t("upstage.play.yourTurn")}</span>
        ) : (
          <span className="up-status__wait">{fill(t("upstage.play.turnOf"), { name: turnName })}</span>
        )}
        <span className="up-status__hint">
          {pub.currentPlay
            ? fill(t("upstage.play.follow"), { count: pub.currentPlay.count, value: pub.currentPlay.value })
            : t("upstage.play.lead")}
        </span>
      </div>

      <div className="up-hand">
        {(me?.hand ?? []).map((card) => (
          <CardFace
            key={card.id}
            card={card}
            selected={selected.includes(card.id)}
            onClick={myTurn ? () => toggleCard(card.id) : undefined}
          />
        ))}
      </div>

      <div className="up-actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!myTurn || selected.length === 0}
          onClick={() => onPlay(selected)}
        >
          {t("upstage.play.play")}
        </button>
        <button type="button" className="btn" disabled={!myTurn || !pub.currentPlay} onClick={onPass}>
          {t("upstage.play.pass")}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- hand end
const HandEndView = ({
  pub,
  isHost,
  onNext,
  nameOf,
  t,
}: {
  pub: UpstagePublicState;
  isHost: boolean;
  onNext: () => void;
  nameOf: (id: string) => string;
  t: TFn;
}) => {
  const ranking = pub.lastHandRanking ?? pub.order;
  const isFinal = pub.handNumber >= pub.totalHands;
  return (
    <div className="up-panel up-handend">
      <h2 className="up-h">{fill(t("upstage.hand.title"), { n: pub.handNumber })}</h2>
      <div className="up-table">
        <div className="up-table__head">
          <span>{t("upstage.hand.rankCol")}</span>
          <span />
          <span>{t("upstage.hand.scoreCol")}</span>
        </div>
        {ranking.map((id, index) => {
          const p = pub.players.find((x) => x.playerId === id);
          return (
            <div className="up-table__row" key={id}>
              <span className="up-table__rank">{index + 1}</span>
              <span className="up-table__name">{nameOf(id)}</span>
              <span className="up-table__score">{p?.cumulativeScore ?? 0}</span>
            </div>
          );
        })}
      </div>
      {isHost ? (
        <button type="button" className="btn btn--primary up-cta" onClick={onNext}>
          {isFinal ? t("upstage.hand.finish") : t("upstage.hand.next")}
        </button>
      ) : (
        <p className="up-wait">{t("upstage.hand.waitingHost")}</p>
      )}
    </div>
  );
};
