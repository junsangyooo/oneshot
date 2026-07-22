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
import { Backdrop, AvatarImg, SettingsModal, RulesModal, GameRail } from "../../ui/terminal";
import type { RailSeat } from "../../ui/terminal";
import { useCountdown } from "../../ui/useCountdown";

type Props = {
  roomState: PartyRoomState;
  privateState: unknown;
  currentPlayerId: string | null;
};

const fill = (s: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

const cardLabel = (card: UpstageCard): string => (card.value === "star" ? "★" : String(card.value));

// One playing card. Stars are wilds, 1 is the strongest — both get a caption so
// first-time players can read the card without opening the rules.
const CardFace = ({
  card,
  selected,
  dim,
  onClick,
}: {
  card: UpstageCard;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
}) => {
  const t = useT();
  const cls = [
    "up-card",
    card.value === "star" ? "up-card--star" : "",
    card.value === 1 ? "up-card--best" : "",
    selected ? "is-selected" : "",
    dim ? "is-dim" : "",
    onClick ? "" : "up-card--static",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={!onClick}
      aria-label={card.value === "star" ? t("upstage.card.star") : String(card.value)}
    >
      <span className="up-card__v">{cardLabel(card)}</span>
      {card.value === "star" ? <span className="up-card__k">{t("upstage.card.star")}</span> : null}
      {card.value === 1 ? <span className="up-card__k">{t("upstage.card.best")}</span> : null}
    </button>
  );
};

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
  const amSeated = currentPlayerId != null && (pub?.players.some((p) => p.playerId === currentPlayerId) ?? false);
  const voteCooldown = useCountdown(pub?.endVoteCooldownUntil);

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

  const railSeats: RailSeat[] =
    pub.phase === "play"
      ? pub.order.map((id) => {
          const p = pub.players.find((x) => x.playerId === id);
          const out = (p?.handCount ?? 0) === 0;
          return {
            id,
            countLabel: out ? t("upstage.play.out") : String(p?.handCount ?? 0),
            turn: pub.currentTurnPlayerId === id,
            accent: pub.leadPlayerId === id ? "lead" : null,
            badge: p?.passed ? t("upstage.play.passed") : null,
            dim: out,
          };
        })
      : [];

  return (
    <main className={`scr scr--upstage${pub.phase === "play" ? " has-rail" : ""}`}>
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>UP/STG/04X-220</div>
          <div>
            <span className="readout__lbl">SECTOR_ID: </span>
            <span className="hot">#{roomState.roomCode}</span>
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
          {amSeated && pub.phase !== "setup" && pub.phase !== "ended" && !voteOpen ? (
            <button
              className="btn btn--sm btn--danger"
              type="button"
              disabled={voteCooldown > 0}
              onClick={() => sendAction(UPSTAGE_ACTIONS.proposeEnd)}
            >
              <span>
                ⏻ {voteCooldown > 0 ? fill(t("vote.cooldown"), { s: voteCooldown }) : t("upstage.proposeEnd")}
              </span>
            </button>
          ) : null}
          {/* early-end vote — a small chip in the toolbar (where the propose button
              was), deliberately NOT a modal so an open vote never blocks the table */}
          {voteOpen ? (
            <div className="up-vote" role="status">
              <span className="up-vote__title">{t("upstage.vote.title")}</span>
              <span className="up-vote__tally">
                {fill(t("upstage.vote.tally"), {
                  // mirror the server's quorum: only CONNECTED seats count
                  agree: Object.entries(pub.endVote!.votes).filter(
                    ([id, v]) => v && roomState.players[id]?.connectionStatus === "online",
                  ).length,
                  total: pub.players.filter((p) => roomState.players[p.playerId]?.connectionStatus === "online")
                    .length,
                })}
              </span>
              {iVoted || !amSeated ? (
                <span className="up-vote__waiting">{t("upstage.vote.waiting")}</span>
              ) : (
                <span className="up-vote__row">
                  <button
                    type="button"
                    className="btn btn--sm btn--primary"
                    onClick={() => sendAction(UPSTAGE_ACTIONS.voteEnd, { agree: true })}
                  >
                    <span>{t("upstage.vote.agree")}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => sendAction(UPSTAGE_ACTIONS.voteEnd, { agree: false })}
                  >
                    <span>{t("upstage.vote.reject")}</span>
                  </button>
                </span>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {pub.phase === "play" ? <GameRail seats={railSeats} players={roomState.players} nameOf={nameOf} /> : null}

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
            {amSeated ? (
              <button type="button" className="btn btn--primary up-cta" onClick={() => sendAction(UPSTAGE_ACTIONS.startHand)}>
                {t("upstage.draw.start")}
              </button>
            ) : null}
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
            currentPlayerId={currentPlayerId}
            selected={selected}
            toggleCard={toggleCard}
            onPlay={(cards) => sendAction(UPSTAGE_ACTIONS.play, { cards })}
            onPass={() => sendAction(UPSTAGE_ACTIONS.pass)}
            nameOf={nameOf}
            t={t}
          />
        ) : pub.phase === "handEnd" ? (
          <HandEndView pub={pub} canAdvance={amSeated} onNext={() => sendAction(UPSTAGE_ACTIONS.nextHand)} nameOf={nameOf} t={t} />
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
                  // mirror the server's quorum: only CONNECTED seats count
                  agree: Object.entries(pub.endVote!.votes).filter(
                    ([id, v]) => v && roomState.players[id]?.connectionStatus === "online",
                  ).length,
                  total: pub.players.filter((p) => roomState.players[p.playerId]?.connectionStatus === "online")
                    .length,
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
        {(me?.hand ?? []).map((card) => {
          const can = selected.includes(card.id) || selected.length < owed;
          return (
            <CardFace
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              dim={!can}
              onClick={can ? () => toggleCard(card.id) : undefined}
            />
          );
        })}
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
  const hand = me?.hand ?? [];
  const follow = pub.currentPlay;

  // --- client-side legality mirror (UI gating only; the server re-validates) ---
  const stars = hand.filter((c) => c.value === "star").length;
  const countOf = (v: number): number => hand.filter((c) => c.value === v).length;
  // Can value v (plus stars as padding) form a beating set of exactly `count`?
  const valueBeats = (v: number): boolean =>
    follow != null && v < follow.value && countOf(v) + stars >= follow.count;
  const canBeat = follow == null || hand.some((c) => c.value !== "star" && valueBeats(c.value));

  // Would this card ever participate in a legal play right now?
  const usable = (card: UpstageCard): boolean => {
    if (!follow) return true; // leading: anything goes
    if (card.value === "star") {
      // a star can only pad a number set (a lone/all-star set never beats)
      return follow.count >= 2 && hand.some((c) => c.value !== "star" && valueBeats(c.value));
    }
    return valueBeats(card.value);
  };

  // Selection compatibility: sets are one number value + stars.
  const selCards = selected.map((id) => hand.find((c) => c.id === id)).filter((c): c is UpstageCard => c != null);
  const selValue = selCards.find((c) => c.value !== "star")?.value as number | undefined;
  const togglable = (card: UpstageCard): boolean => {
    if (!myTurn || !usable(card)) return false;
    if (selected.includes(card.id) || selCards.length === 0) return true;
    if (card.value === "star") return true;
    return selValue == null || card.value === selValue;
  };

  // Is the current selection a set the server would accept?
  const effValue = selValue ?? pub.starSoloValue;
  const selectionLegal =
    selCards.length > 0 &&
    selCards.every((c) => c.value === "star" || c.value === selValue) &&
    (follow == null || (selCards.length === follow.count && effValue < follow.value));

  // Nothing can beat the pile → no decision left; pass automatically after a
  // visible beat instead of presenting a dead Play/Pass choice.
  const autoPassing = myTurn && follow != null && !canBeat && hand.length > 0;
  useEffect(() => {
    if (!autoPassing) return;
    const timer = setTimeout(() => onPass(), 1300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPassing]);

  return (
    <div className="up-play">
      <div className="up-pile">
        <span className="up-pile__label">{t("upstage.play.pile")}</span>
        {follow ? (
          <div className="up-pile__cards">
            {follow.cards.map((c) => (
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
          {follow ? fill(t("upstage.play.follow"), { count: follow.count, value: follow.value }) : t("upstage.play.lead")}
        </span>
        {follow ? <span className="up-status__hint up-status__hint--mute">{t("upstage.play.lowWins")}</span> : null}
      </div>

      <div className="up-hand">
        {hand.map((card) => {
          const can = togglable(card);
          return (
            <CardFace
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              dim={(!myTurn || !can) && !selected.includes(card.id)}
              onClick={can ? () => toggleCard(card.id) : undefined}
            />
          );
        })}
      </div>

      {autoPassing ? (
        <div className="up-actions">
          <span className="up-autobanner" role="status">
            {t("upstage.play.autoPass")}
          </span>
        </div>
      ) : (
        <div className="up-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!myTurn || !selectionLegal}
            onClick={() => onPlay(selected)}
          >
            {selected.length > 1
              ? fill(t("upstage.play.playN"), { n: selected.length })
              : t("upstage.play.play")}
          </button>
          <button type="button" className="btn" disabled={!myTurn || !follow} onClick={onPass}>
            {t("upstage.play.pass")}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- hand end
const HandEndView = ({
  pub,
  canAdvance,
  onNext,
  nameOf,
  t,
}: {
  pub: UpstagePublicState;
  canAdvance: boolean;
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
      {canAdvance ? (
        <button type="button" className="btn btn--primary up-cta" onClick={onNext}>
          {isFinal ? t("upstage.hand.finish") : t("upstage.hand.next")}
        </button>
      ) : null}
    </div>
  );
};
