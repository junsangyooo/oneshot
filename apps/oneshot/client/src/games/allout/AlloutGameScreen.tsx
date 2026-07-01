import { useEffect, useState } from "react";
import type {
  AlloutCard as TCard,
  AlloutColor,
  AlloutPrivateState,
  AlloutPublicState,
  PartyRoomState,
} from "@oneshot/shared";
import {
  ALLOUT_ACTIONS,
  ALLOUT_BANKRUPT_DEFAULT,
  ALLOUT_BANKRUPT_MAX,
  ALLOUT_BANKRUPT_MIN,
  ALLOUT_COLORS,
  ALLOUT_ROUNDS_DEFAULT,
  ALLOUT_ROUNDS_MAX,
  ALLOUT_ROUNDS_MIN,
} from "@oneshot/shared";
import { useRoomStore } from "../../app/useRoomStore";
import { useT } from "../../i18n";
import { Backdrop, AvatarImg, SettingsModal, RulesModal, GameRail } from "../../ui/terminal";
import type { RailSeat } from "../../ui/terminal";
import { AlloutCardFace } from "./AlloutCard";

type Props = {
  roomState: PartyRoomState;
  privateState: unknown;
  currentPlayerId: string | null;
};

const fill = (s: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

const COLORLESS: TCard["kind"][] = ["plus4", "plus7", "exchange", "reflect", "wild"];
const isColorless = (k: TCard["kind"]): boolean => COLORLESS.includes(k);

// Client-side legality mirror — UI hint only; the server is authoritative.
const canStart = (card: TCard, top: AlloutPublicState["top"], activeColor: AlloutColor, pending: number): boolean => {
  if (!top) return false;
  const k = card.kind;
  const colorMatch = "color" in card && card.color === activeColor;
  if (pending > 0) {
    if (k === "plus4" || k === "plus7" || k === "reflect") return true;
    if (k === "plus2") return top.card.kind === "plus2" || colorMatch;
    if (k === "shield") return colorMatch;
    return false;
  }
  if (k === "plus4" || k === "plus7" || k === "exchange" || k === "wild") return true;
  if (k === "reflect" || k === "shield") return false;
  if (k === "number") return (top.card.kind === "number" && top.card.value === card.value) || colorMatch;
  return top.card.kind === k || colorMatch;
};

// Can `card` join a set whose first card is `first`? (same number, or same kind)
const compatible = (card: TCard, first: TCard): boolean => {
  if (first.kind === "number") return card.kind === "number" && card.value === first.value;
  return card.kind === first.kind;
};

export const AlloutGameScreen = ({ roomState, privateState, currentPlayerId }: Props) => {
  const t = useT();
  const send = useRoomStore((s) => s.send);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [colorOpen, setColorOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  // setup controls (host)
  const [rounds, setRounds] = useState<number>(ALLOUT_ROUNDS_DEFAULT);
  const [bankruptcyOn, setBankruptcyOn] = useState(false);
  const [limit, setLimit] = useState<number>(ALLOUT_BANKRUPT_DEFAULT);

  const pub = roomState.activeGame?.publicState as AlloutPublicState | undefined;
  const me = privateState as AlloutPrivateState | null;
  const myPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = myPlayer?.isHost ?? false;

  const sendAction = (type: string, payload?: unknown) =>
    send({ type: "game:action", action: { type, payload, clientActionId: crypto.randomUUID() } });

  useEffect(() => {
    setSelected([]);
    setColorOpen(false);
    setTargetOpen(false);
    setPendingTarget(null);
  }, [pub?.phase, pub?.currentTurnPlayerId, pub?.pendingAttack, pub?.drawnPendingPlayerId]);

  if (!pub) {
    return (
      <main className="scr scr--allout">
        <Backdrop />
        <div className="ao-loading">{t("allout.loading")}</div>
      </main>
    );
  }

  const nameOf = (id: string): string =>
    id === currentPlayerId ? t("allout.you") : (roomState.players[id]?.nickname ?? "—");

  const handById = (id: string): TCard | undefined => me?.hand.find((c) => c.id === id);
  const firstSelected = (selected.length > 0 ? handById(selected[0]!) : null) ?? null;

  const voteOpen = pub.endVote != null;
  const iVoted = voteOpen && currentPlayerId != null && currentPlayerId in (pub.endVote?.votes ?? {});

  const railSeats: RailSeat[] =
    pub.phase === "play"
      ? pub.order.map((id) => {
          const p = pub.players.find((x) => x.playerId === id);
          return {
            id,
            countLabel: p?.bankrupt
              ? t("allout.play.bankruptOut")
              : p?.finished
                ? t("allout.play.out")
                : String(p?.handCount ?? 0),
            turn: pub.currentTurnPlayerId === id,
            accent: pub.attackFromId === id ? "attacker" : null,
            badge: p && !p.finished && p.handCount === 1 ? t("allout.play.lastCard") : null,
            dim: p?.finished ?? false,
          };
        })
      : [];

  const toggleCard = (card: TCard) => {
    setSelected((prev) => {
      if (prev.includes(card.id)) return prev.filter((x) => x !== card.id);
      return [...prev, card.id];
    });
  };

  // --- play submission flow (color wheel / exchange target as needed) ---
  const submitPlay = () => {
    if (selected.length === 0 || !firstSelected) return;
    const kind = firstSelected.kind;
    if (kind === "exchange" && !pendingTarget) {
      setTargetOpen(true);
      return;
    }
    if (isColorless(kind)) {
      setColorOpen(true);
      return;
    }
    doSend(undefined, pendingTarget ?? undefined);
  };
  const onTargetChosen = (id: string) => {
    setPendingTarget(id);
    setTargetOpen(false);
    setColorOpen(true); // exchange also picks a color
  };
  const onColorChosen = (color: AlloutColor) => {
    setColorOpen(false);
    doSend(color, pendingTarget ?? undefined);
  };
  const doSend = (chosenColor?: AlloutColor, exchangeTargetId?: string) => {
    sendAction(ALLOUT_ACTIONS.play, { cards: selected, chosenColor, exchangeTargetId });
    setSelected([]);
    setPendingTarget(null);
  };

  return (
    <main className={`scr scr--allout${pub.phase === "play" ? " has-rail" : ""}`}>
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>ALL/OUT/80X-440</div>
          <div>
            SECTOR_ID: <span className="hot">#{roomState.roomCode}</span>
          </div>
          <div>DECK: {pub.doubleDeck ? "×2 (160)" : "×1 (80)"}</div>
        </div>
        <div className="ao-round">
          <span className="lbl">{t("allout.round")}</span>
          <span className="val">
            {String(pub.roundNumber).padStart(2, "0")}/{String(pub.totalRounds).padStart(2, "0")}
          </span>
        </div>
        <div className="ao-toolbar">
          <button className="btn btn--sm" type="button" aria-label={t("rules.help")} onClick={() => setRulesOpen(true)}>
            <span>?</span>
          </button>
          <button className="btn btn--sm" type="button" aria-label={t("settings.title")} onClick={() => setSettingsOpen(true)}>
            <span>⚙</span>
          </button>
          {isHost && pub.phase !== "setup" && pub.phase !== "ended" && !voteOpen ? (
            <button className="btn btn--sm btn--danger" type="button" onClick={() => sendAction(ALLOUT_ACTIONS.proposeEnd)}>
              <span>⏻ {t("allout.proposeEnd")}</span>
            </button>
          ) : null}
        </div>
      </header>

      {pub.phase === "play" ? <GameRail seats={railSeats} players={roomState.players} nameOf={nameOf} /> : null}

      <section className="ao-stage">
        {pub.phase === "setup" ? (
          <SetupView
            isHost={isHost}
            rounds={rounds}
            setRounds={setRounds}
            bankruptcyOn={bankruptcyOn}
            setBankruptcyOn={setBankruptcyOn}
            limit={limit}
            setLimit={setLimit}
            onStart={() =>
              sendAction(ALLOUT_ACTIONS.configure, { totalRounds: rounds, bankruptcyOn, bankruptcyLimit: limit })
            }
            t={t}
          />
        ) : pub.phase === "play" ? (
          <PlayView
            pub={pub}
            me={me}
            currentPlayerId={currentPlayerId}
            selected={selected}
            firstSelected={firstSelected}
            toggleCard={toggleCard}
            onPlay={submitPlay}
            onDraw={() => sendAction(ALLOUT_ACTIONS.draw)}
            onPass={() => sendAction(ALLOUT_ACTIONS.pass)}
            nameOf={nameOf}
            t={t}
          />
        ) : pub.phase === "roundEnd" ? (
          <RoundEndView pub={pub} isHost={isHost} onNext={() => sendAction(ALLOUT_ACTIONS.nextRound)} nameOf={nameOf} t={t} />
        ) : (
          <div className="ao-panel">
            <p className="ao-wait">{t("allout.ended")}</p>
          </div>
        )}
      </section>

      {colorOpen ? (
        <div className="modal-backdrop open" role="presentation">
          <div className="modal ao-colormodal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3>{t("allout.color.title")}</h3>
            </div>
            <div className="modal-body">
              <div className="ao-wheel">
                {ALLOUT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="ao-wheel__seg"
                    data-color={c}
                    aria-label={t(`allout.color.${c}`)}
                    onClick={() => onColorChosen(c)}
                  >
                    <span>{t(`allout.color.${c}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {targetOpen ? (
        <div className="modal-backdrop open" role="presentation">
          <div className="modal ao-targetmodal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3>{t("allout.target.title")}</h3>
            </div>
            <div className="modal-body">
              <div className="ao-targets">
                {pub.players
                  .filter((p) => p.playerId !== currentPlayerId && !p.finished)
                  .map((p) => (
                    <button key={p.playerId} type="button" className="ao-target" onClick={() => onTargetChosen(p.playerId)}>
                      <AvatarImg avatarKey={roomState.players[p.playerId]?.avatarKey} themeId={roomState.players[p.playerId]?.themeId} />
                      <span>{nameOf(p.playerId)}</span>
                      <span className="ao-target__count">{p.handCount}</span>
                    </button>
                  ))}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setTargetOpen(false)}>
                {t("allout.target.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {voteOpen ? (
        <div className="modal-backdrop open" role="presentation">
          <div className="modal ao-vote" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3>{t("allout.vote.title")}</h3>
            </div>
            <div className="modal-body">
              <p className="ao-hint">{t("allout.vote.desc")}</p>
              <p className="ao-vote__tally">
                {fill(t("allout.vote.tally"), {
                  agree: Object.values(pub.endVote!.votes).filter(Boolean).length,
                  total: pub.players.length,
                })}
              </p>
              {iVoted ? (
                <p className="ao-wait">{t("allout.vote.waiting")}</p>
              ) : (
                <div className="ao-row">
                  <button type="button" className="btn btn--primary" onClick={() => sendAction(ALLOUT_ACTIONS.voteEnd, { agree: true })}>
                    {t("allout.vote.agree")}
                  </button>
                  <button type="button" className="btn" onClick={() => sendAction(ALLOUT_ACTIONS.voteEnd, { agree: false })}>
                    {t("allout.vote.reject")}
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
        title={t("allout.rules.title")}
        paragraphs={[
          t("allout.rules.p1"),
          t("allout.rules.p2"),
          t("allout.rules.p3"),
          t("allout.rules.p4"),
          t("allout.rules.p5"),
          t("allout.rules.p6"),
          t("allout.rules.p7"),
        ]}
      />
    </main>
  );
};

type TFn = (key: string) => string;

// ---------------------------------------------------------------- setup
const SetupView = ({
  isHost,
  rounds,
  setRounds,
  bankruptcyOn,
  setBankruptcyOn,
  limit,
  setLimit,
  onStart,
  t,
}: {
  isHost: boolean;
  rounds: number;
  setRounds: (fn: (n: number) => number) => void;
  bankruptcyOn: boolean;
  setBankruptcyOn: (v: boolean) => void;
  limit: number;
  setLimit: (fn: (n: number) => number) => void;
  onStart: () => void;
  t: TFn;
}) => {
  if (!isHost) {
    return (
      <div className="ao-panel ao-setup">
        <h2 className="ao-h">{t("allout.setup.title")}</h2>
        <p className="ao-wait">{t("allout.setup.waitingHost")}</p>
      </div>
    );
  }
  return (
    <div className="ao-panel ao-setup">
      <h2 className="ao-h">{t("allout.setup.title")}</h2>
      <div className="ao-field">
        <span className="ao-field__label">{t("allout.setup.rounds")}</span>
        <div className="ao-stepper">
          <button type="button" className="btn btn--sm" onClick={() => setRounds((n) => Math.max(ALLOUT_ROUNDS_MIN, n - 1))}>
            −
          </button>
          <span className="ao-stepper__v">{rounds}</span>
          <button type="button" className="btn btn--sm" onClick={() => setRounds((n) => Math.min(ALLOUT_ROUNDS_MAX, n + 1))}>
            ＋
          </button>
        </div>
      </div>
      <div className="ao-field">
        <span className="ao-field__label">{t("allout.setup.bankruptcy")}</span>
        <div className="ao-seg">
          <button type="button" className={`ao-seg__btn${!bankruptcyOn ? " is-on" : ""}`} onClick={() => setBankruptcyOn(false)}>
            {t("allout.setup.bankruptcyOff")}
          </button>
          <button type="button" className={`ao-seg__btn${bankruptcyOn ? " is-on" : ""}`} onClick={() => setBankruptcyOn(true)}>
            {t("allout.setup.bankruptcyOn")}
          </button>
        </div>
      </div>
      {bankruptcyOn ? (
        <>
          <p className="ao-hint">{t("allout.setup.bankruptcyDesc")}</p>
          <div className="ao-field">
            <span className="ao-field__label">{t("allout.setup.limit")}</span>
            <div className="ao-stepper">
              <button type="button" className="btn btn--sm" onClick={() => setLimit((n) => Math.max(ALLOUT_BANKRUPT_MIN, n - 1))}>
                −
              </button>
              <span className="ao-stepper__v">{limit}</span>
              <button type="button" className="btn btn--sm" onClick={() => setLimit((n) => Math.min(ALLOUT_BANKRUPT_MAX, n + 1))}>
                ＋
              </button>
            </div>
          </div>
        </>
      ) : null}
      <button type="button" className="btn btn--primary ao-cta" onClick={onStart}>
        {t("allout.setup.start")}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------- play
const PlayView = ({
  pub,
  me,
  currentPlayerId,
  selected,
  firstSelected,
  toggleCard,
  onPlay,
  onDraw,
  onPass,
  nameOf,
  t,
}: {
  pub: AlloutPublicState;
  me: AlloutPrivateState | null;
  currentPlayerId: string | null;
  selected: string[];
  firstSelected: TCard | null;
  toggleCard: (card: TCard) => void;
  onPlay: () => void;
  onDraw: () => void;
  onPass: () => void;
  nameOf: (id: string) => string;
  t: TFn;
}) => {
  const myTurn = pub.currentTurnPlayerId === currentPlayerId;
  const drawn = pub.drawnPendingPlayerId === currentPlayerId;
  const drawnCard = drawn && me ? me.hand.find((c) => c.id === me.drawnCardId) : undefined;
  const underAttack = pub.pendingAttack > 0;
  const turnName = pub.currentTurnPlayerId ? nameOf(pub.currentTurnPlayerId) : "—";

  const pickable = (card: TCard): boolean => {
    if (!myTurn) return false;
    if (selected.includes(card.id)) return true;
    if (selected.length === 0) {
      if (drawn) {
        return (
          card.id === me?.drawnCardId ||
          (card.kind === "number" && drawnCard?.kind === "number" && card.value === drawnCard.value)
        );
      }
      return canStart(card, pub.top, pub.top?.color ?? "red", pub.pendingAttack);
    }
    return firstSelected ? compatible(card, firstSelected) : false;
  };
  const glowing = (card: TCard): boolean =>
    myTurn && selected.length === 0 && !drawn && canStart(card, pub.top, pub.top?.color ?? "red", pub.pendingAttack);

  return (
    <div className="ao-play">
      <div className="ao-center">
        <span className="ao-dir" aria-label={pub.direction === 1 ? t("allout.play.dirCW") : t("allout.play.dirCCW")}>
          {pub.direction === 1 ? "↻" : "↺"}
        </span>
        <div className="ao-pile" data-color={pub.top?.color ?? "wild"}>
          {pub.top ? <AlloutCardFace card={pub.top.card} /> : null}
        </div>
        {underAttack ? <span className="ao-attack">+{pub.pendingAttack}</span> : null}
      </div>

      <div className="ao-status">
        {myTurn ? (
          <span className="ao-status__turn">{t("allout.play.yourTurn")}</span>
        ) : (
          <span className="ao-status__wait">{fill(t("allout.play.turnOf"), { name: turnName })}</span>
        )}
        <span className="ao-status__hint">
          {underAttack ? fill(t("allout.play.attackHint"), { n: pub.pendingAttack }) : t("allout.play.lead")}
        </span>
        <span className="ao-status__hint ao-status__hint--mute">{t("allout.play.multiHint")}</span>
      </div>

      <div className="ao-hand">
        {(me?.hand ?? []).map((card) => {
          const can = pickable(card);
          return (
            <AlloutCardFace
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              glow={glowing(card)}
              dim={myTurn && !can && !selected.includes(card.id)}
              onClick={can ? () => toggleCard(card) : undefined}
            />
          );
        })}
      </div>

      <div className="ao-actions">
        <button type="button" className="btn btn--primary" disabled={!myTurn || selected.length === 0} onClick={onPlay}>
          {selected.length > 1 ? fill(t("allout.play.playN"), { n: selected.length }) : t("allout.play.play")}
        </button>
        {drawn ? (
          <button type="button" className="btn" disabled={!myTurn} onClick={onPass}>
            {t("allout.play.pass")}
          </button>
        ) : underAttack ? (
          <button type="button" className="btn btn--danger" disabled={!myTurn} onClick={onDraw}>
            {fill(t("allout.play.take"), { n: pub.pendingAttack })}
          </button>
        ) : (
          <button type="button" className="btn" disabled={!myTurn} onClick={onDraw}>
            {t("allout.play.draw")} · {pub.drawPileCount}
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- round end
const RoundEndView = ({
  pub,
  isHost,
  onNext,
  nameOf,
  t,
}: {
  pub: AlloutPublicState;
  isHost: boolean;
  onNext: () => void;
  nameOf: (id: string) => string;
  t: TFn;
}) => {
  const ranking = pub.lastRoundRanking ?? pub.order;
  const isFinal = pub.roundNumber >= pub.totalRounds;
  return (
    <div className="ao-panel ao-roundend">
      <h2 className="ao-h">{fill(t("allout.roundEnd.title"), { n: pub.roundNumber })}</h2>
      <div className="ao-table">
        <div className="ao-table__head">
          <span>{t("allout.roundEnd.rankCol")}</span>
          <span />
          <span>{t("allout.roundEnd.scoreCol")}</span>
        </div>
        {ranking.map((id, index) => {
          const p = pub.players.find((x) => x.playerId === id);
          return (
            <div className="ao-table__row" key={id}>
              <span className="ao-table__rank">{index + 1}</span>
              <span className="ao-table__name">{nameOf(id)}</span>
              <span className="ao-table__score">{p?.cumulativeScore ?? 0}</span>
            </div>
          );
        })}
      </div>
      {isHost ? (
        <button type="button" className="btn btn--primary ao-cta" onClick={onNext}>
          {isFinal ? t("allout.roundEnd.finish") : t("allout.roundEnd.next")}
        </button>
      ) : (
        <p className="ao-wait">{t("allout.roundEnd.waitingHost")}</p>
      )}
    </div>
  );
};
