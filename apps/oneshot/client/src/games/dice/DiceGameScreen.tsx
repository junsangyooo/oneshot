import { useEffect, useRef, useState } from "react";
import type { DicePlayerPublic, DicePublicState, DiceRoll, PartyRoomState } from "@oneshot/shared";
import { DICE_ACTIONS, DICE_ROUNDS_DEFAULT, DICE_ROUNDS_MAX, DICE_ROUNDS_MIN } from "@oneshot/shared";
import { useRoomStore } from "../../app/useRoomStore";
import { useT } from "../../i18n";
import { Backdrop, AvatarImg, SettingsModal, RulesModal } from "../../ui/terminal";
import { useCountdown } from "../../ui/useCountdown";

type Props = {
  roomState: PartyRoomState;
  privateState: unknown;
  currentPlayerId: string | null;
};

type TFn = (key: string) => string;

const fill = (s: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

const REDUCED_MOTION =
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

/* dice choreography (ms): die A lands, die B lands, sum + burst, ranks appear */
const DIE_A_MS = 900;
const DIE_B_MS = 1400;
const LAND_MS = 2100;
const SETTLE_MS = 2450;

/* pip layout per face value on a 3×3 grid (cells 1..9, row-major) */
const PIP_CELLS: Record<number, number[]> = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

/* final cube orientation per value, with extra full turns so the settle
   transition reads as one last decelerating tumble into place */
const FACE_TURNS: Record<number, string> = {
  1: "rotateX(720deg) rotateY(720deg)",
  2: "rotateX(720deg) rotateY(630deg)",
  3: "rotateX(630deg) rotateY(720deg)",
  4: "rotateX(810deg) rotateY(720deg)",
  5: "rotateX(720deg) rotateY(810deg)",
  6: "rotateX(720deg) rotateY(900deg)",
};

/* one 3D die. value=null renders the idle (not yet thrown) cube; while a value
   exists but shown=false the cube tumbles; shown=true settles onto the face. */
const Die = ({ value, variant, shown }: { value: number | null; variant: "a" | "b"; shown: boolean }) => {
  const rolling = value != null && !shown;
  const cls = [
    "die",
    `die--${variant}`,
    rolling ? "is-rolling" : "",
    value == null ? "is-idle" : "",
    shown && value != null ? "is-set" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} aria-hidden="true">
      <span className="die__cube" style={shown && value != null ? { transform: FACE_TURNS[value] } : undefined}>
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <span key={face} className={`die__face die__face--${face}`}>
            {PIP_CELLS[face]!.map((cell) => (
              <span
                key={cell}
                className="pip"
                style={{ gridArea: `${Math.ceil(cell / 3)} / ${((cell - 1) % 3) + 1}` }}
              />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
};

/* quick count-up for the revealed sum */
const SumCounter = ({ value }: { value: number }) => {
  const [n, setN] = useState(REDUCED_MOTION ? value : 0);
  useEffect(() => {
    if (REDUCED_MOTION) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 450);
      setN(Math.round(value * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <b className="dice-pod__sum-v">{n}</b>;
};

/* one player's dice pod. Runs the local reveal choreography whenever this
   player's roll first appears; mounting with a roll (reconnect / late join)
   skips straight to the settled state so nothing replays. */
const PlayerPod = ({
  player,
  roll,
  isMe,
  isWaiting,
  showRank,
  name,
  avatarKey,
  themeId,
  t,
}: {
  player: DicePlayerPublic;
  roll: DiceRoll | null;
  isMe: boolean;
  isWaiting: boolean;
  showRank: boolean;
  name: string;
  avatarKey: string | undefined;
  themeId: string | undefined;
  t: TFn;
}) => {
  // stage: 0 idle/tumbling · 1 die A landed · 2 die B landed · 3 sum + burst
  const [stage, setStage] = useState(roll ? 3 : 0);
  const hasRoll = roll != null;
  const hadRoll = useRef(hasRoll);
  useEffect(() => {
    if (!hasRoll) {
      hadRoll.current = false;
      setStage(0);
      return;
    }
    if (hadRoll.current) return;
    hadRoll.current = true;
    if (REDUCED_MOTION) {
      setStage(3);
      return;
    }
    const t1 = setTimeout(() => setStage(1), DIE_A_MS);
    const t2 = setTimeout(() => setStage(2), DIE_B_MS);
    const t3 = setTimeout(() => setStage(3), LAND_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [hasRoll]);

  const rankVisible = showRank && player.roundRank != null;
  const cls = [
    "dice-pod",
    isMe ? "is-me" : "",
    stage >= 3 ? "is-landed" : "",
    rankVisible && player.roundRank === 1 ? "is-first" : "",
    isWaiting ? "is-waiting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      {rankVisible ? (
        <span className={`dice-pod__rank${player.roundRank === 1 ? " is-gold" : ""}`}>
          {player.roundRank === 1 ? "♛ " : ""}
          {fill(t("dice.rankBadge"), { n: player.roundRank! })}
        </span>
      ) : null}
      <div className="dice-pod__head">
        <AvatarImg avatarKey={avatarKey} themeId={themeId} />
        <span className="dice-pod__name">{name}</span>
      </div>
      <div className="dice-pod__dice">
        <Die value={roll?.d1 ?? null} variant="a" shown={stage >= 1} />
        <Die value={roll?.d2 ?? null} variant="b" shown={stage >= 2} />
      </div>
      <div className="dice-pod__foot">
        {stage >= 3 && roll ? (
          <span className="dice-pod__sum">
            <span className="lbl">{t("dice.sum")}</span> <SumCounter value={roll.sum} />
            {roll.auto ? <span className="dice-pod__auto">{t("dice.status.auto")}</span> : null}
          </span>
        ) : hasRoll ? (
          <span className="dice-pod__status">{t("dice.status.rolling")}</span>
        ) : (
          <span className="dice-pod__status">{t("dice.status.waiting")}</span>
        )}
      </div>
    </div>
  );
};

export const DiceGameScreen = ({ roomState, privateState, currentPlayerId }: Props) => {
  void privateState; // dice has no secrets
  const t = useT();
  const send = useRoomStore((s) => s.send);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // setup controls (host)
  const [rounds, setRounds] = useState<number>(DICE_ROUNDS_DEFAULT);
  const [rollPending, setRollPending] = useState(false);

  const pub = roomState.activeGame?.publicState as DicePublicState | undefined;
  const myPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = myPlayer?.isHost ?? false;
  const me = pub?.players.find((p) => p.playerId === currentPlayerId) ?? null;
  const iRolled = me?.roll != null;
  const voteCooldown = useCountdown(pub?.endVoteCooldownUntil);

  const sendAction = (type: string, payload?: unknown) =>
    send({ type: "game:action", action: { type, payload, clientActionId: crypto.randomUUID() } });

  /* settle gate: round ranks/results only appear once every die that started
     tumbling on this screen has landed — the last throw keeps its drama.
     Armed DURING render (not in an effect): the broadcast that carries the
     final roll also flips the phase to roundEnd, so an effect-armed gate
     would let the results paint for one frame before hiding them again. */
  const [settleAt, setSettleAt] = useState(0);
  const [, forceTick] = useState(0);
  // null until the first snapshot: rolls that are already present when the
  // screen mounts (reconnect / late join) must not re-arm the gate.
  const prevHad = useRef<Record<string, boolean> | null>(null);
  if (pub) {
    const first = prevHad.current == null;
    const seen = (prevHad.current ??= {});
    let latest = 0;
    for (const p of pub.players) {
      const had = seen[p.playerId] ?? false;
      const has = p.roll != null;
      if (has && !had && !first && !REDUCED_MOTION) latest = Date.now() + SETTLE_MS;
      seen[p.playerId] = has;
    }
    // render-phase state adjustment (guarded, so it cannot loop): React
    // re-renders before painting, keeping the gate frame-accurate.
    if (latest > settleAt) setSettleAt(latest);
  }
  useEffect(() => {
    const wait = settleAt - Date.now();
    if (wait <= 0) return;
    const timer = setTimeout(() => forceTick((n) => n + 1), wait + 60);
    return () => clearTimeout(timer);
  }, [settleAt]);
  const boardSettled = Date.now() >= settleAt;

  // Also release on a server rejection: an error leaves phase/round/iRolled
  // untouched, and without this the roll button would stay dead all round.
  const errorSeq = useRoomStore((s) => s.errorSeq);
  useEffect(() => {
    setRollPending(false);
  }, [pub?.phase, pub?.roundNumber, iRolled, errorSeq]);

  if (!pub) {
    return (
      <main className="scr scr--dice">
        <Backdrop />
        <div className="dice-loading">{t("dice.loading")}</div>
      </main>
    );
  }

  const nameOf = (id: string): string =>
    id === currentPlayerId ? t("dice.you") : (roomState.players[id]?.nickname ?? "—");

  const voteOpen = pub.endVote != null;
  const iVoted = voteOpen && currentPlayerId != null && currentPlayerId in (pub.endVote?.votes ?? {});
  // mirror the server's quorum: only CONNECTED seats count, both sides of the tally
  const connectedIds = pub.players
    .map((p) => p.playerId)
    .filter((id) => roomState.players[id]?.connectionStatus === "online");
  const isFinal = pub.roundNumber >= pub.totalRounds;
  const showRanks = pub.phase === "roundEnd" && boardSettled;
  const inRound = pub.phase === "rolling" || pub.phase === "roundEnd";

  // Standings mirror the server's final ordering: rank-sum asc, then cumulative
  // pip total desc (the tiebreaker), so mid-game standings match the end result.
  const standings = [...pub.players].sort(
    (a, b) => a.cumulativeScore - b.cumulativeScore || b.pipTotal - a.pipTotal,
  );
  const standingRank = (p: DicePlayerPublic): number =>
    1 +
    pub.players.filter(
      (x) =>
        x.cumulativeScore < p.cumulativeScore ||
        (x.cumulativeScore === p.cumulativeScore && x.pipTotal > p.pipTotal),
    ).length;

  return (
    <main className="scr scr--dice">
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>DICE/2D6/RNG-077</div>
          <div>
            <span className="readout__lbl">SECTOR_ID: </span>
            <span className="hot">#{roomState.roomCode}</span>
          </div>
          <div>MODE: PURE_LUCK</div>
        </div>
        <div className="dice-round">
          <span className="lbl">{t("dice.round")}</span>
          <span className="val">
            {pub.phase === "setup"
              ? "--/--"
              : `${String(pub.roundNumber).padStart(2, "0")}/${String(pub.totalRounds).padStart(2, "0")}`}
          </span>
        </div>
        <div className="dice-toolbar">
          <button className="btn btn--sm" type="button" aria-label={t("rules.help")} onClick={() => setRulesOpen(true)}>
            <span>?</span>
          </button>
          <button
            className="btn btn--sm"
            type="button"
            aria-label={t("settings.title")}
            onClick={() => setSettingsOpen(true)}
          >
            <span>⚙</span>
          </button>
          {me && inRound && pub.roundNumber >= 2 && !voteOpen ? (
            <button
              className="btn btn--sm btn--danger"
              type="button"
              disabled={voteCooldown > 0}
              onClick={() => sendAction(DICE_ACTIONS.proposeEnd)}
            >
              <span>
                ⏻ {voteCooldown > 0 ? fill(t("vote.cooldown"), { s: voteCooldown }) : t("dice.proposeEnd")}
              </span>
            </button>
          ) : null}
        </div>
      </header>

      <section className="dice-stage">
        {pub.phase === "setup" ? (
          isHost ? (
            <div className="dice-panel dice-setup">
              <h2 className="dice-h">{t("dice.setup.title")}</h2>
              <p className="dice-hint">{t("dice.setup.desc")}</p>
              <div className="dice-field">
                <span className="dice-field__label">{t("dice.setup.rounds")}</span>
                <div className="dice-stepper">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => setRounds((n) => Math.max(DICE_ROUNDS_MIN, n - 1))}
                  >
                    −
                  </button>
                  <span className="dice-stepper__v">{rounds}</span>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => setRounds((n) => Math.min(DICE_ROUNDS_MAX, n + 1))}
                  >
                    ＋
                  </button>
                </div>
              </div>
              <p className="dice-hint dice-hint--dim">{t("dice.setup.multiHint")}</p>
              <button
                type="button"
                className="btn btn--primary dice-cta"
                onClick={() => sendAction(DICE_ACTIONS.configure, { totalRounds: rounds })}
              >
                {t("dice.setup.start")}
              </button>
            </div>
          ) : (
            <div className="dice-panel dice-setup">
              <h2 className="dice-h">{t("dice.setup.title")}</h2>
              <div className="dice-wait__pulse">⚄</div>
              <p className="dice-wait">{t("dice.setup.waitingHost")}</p>
            </div>
          )
        ) : inRound ? (
          <>
            <div className="dice-grid">
              {pub.players.map((p) => (
                <PlayerPod
                  key={p.playerId}
                  player={p}
                  roll={p.roll}
                  isMe={p.playerId === currentPlayerId}
                  isWaiting={pub.phase === "rolling" && pub.waitingOn.includes(p.playerId)}
                  showRank={showRanks}
                  name={nameOf(p.playerId)}
                  avatarKey={roomState.players[p.playerId]?.avatarKey}
                  themeId={roomState.players[p.playerId]?.themeId}
                  t={t}
                />
              ))}
            </div>

            {pub.phase === "rolling" ? (
              <div className="dice-actions">
                {me && !iRolled ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--primary dice-cta is-hot"
                      disabled={rollPending}
                      onClick={() => {
                        setRollPending(true);
                        sendAction(DICE_ACTIONS.roll);
                      }}
                    >
                      {t("dice.roll.cta")}
                    </button>
                    <p className="dice-hint dice-hint--dim">{t("dice.roll.hint")}</p>
                  </>
                ) : (
                  <p className="dice-wait">{fill(t("dice.roll.waitingOthers"), { n: pub.waitingOn.length })}</p>
                )}
              </div>
            ) : null}

            {showRanks ? (
              <div className="dice-panel dice-after">
                <h2 className="dice-h">{fill(t("dice.roundEnd.title"), { n: pub.roundNumber })}</h2>
                <div className="dice-table dice-table--pips">
                  <div className="dice-table__head">
                    <span>{t("dice.table.rankCol")}</span>
                    <span />
                    <span>{t("dice.table.pipsCol")}</span>
                    <span>{t("dice.table.scoreCol")}</span>
                  </div>
                  {standings.map((p) => (
                    <div className="dice-table__row" key={p.playerId}>
                      <span className="dice-table__rank">{standingRank(p)}</span>
                      <span className="dice-table__name">{nameOf(p.playerId)}</span>
                      <span className="dice-table__pips">{p.pipTotal}</span>
                      <span className="dice-table__score">{p.cumulativeScore}</span>
                    </div>
                  ))}
                </div>
                <p className="dice-hint dice-hint--dim">{t("dice.tiebreakHint")}</p>
                <button
                  type="button"
                  className="btn btn--primary dice-cta"
                  onClick={() => sendAction(DICE_ACTIONS.nextRound)}
                >
                  {isFinal ? t("dice.roundEnd.finish") : t("dice.roundEnd.next")}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="dice-panel">
            <p className="dice-wait">{t("dice.ended")}</p>
          </div>
        )}
      </section>

      {voteOpen ? (
        <div className="modal-backdrop open" role="presentation">
          <div className="modal dice-vote" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3>{t("dice.vote.title")}</h3>
            </div>
            <div className="modal-body">
              <p className="dice-hint">{t("dice.vote.desc")}</p>
              <p className="dice-vote__tally">
                {fill(t("dice.vote.tally"), {
                  agree: connectedIds.filter((id) => pub.endVote!.votes[id] === true).length,
                  total: connectedIds.length,
                })}
              </p>
              {iVoted ? (
                <p className="dice-wait">{t("dice.vote.waiting")}</p>
              ) : (
                <div className="dice-row">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => sendAction(DICE_ACTIONS.voteEnd, { agree: true })}
                  >
                    {t("dice.vote.agree")}
                  </button>
                  <button type="button" className="btn" onClick={() => sendAction(DICE_ACTIONS.voteEnd, { agree: false })}>
                    {t("dice.vote.reject")}
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
        title={t("dice.rules.title")}
        paragraphs={[
          t("dice.rules.p1"),
          t("dice.rules.p2"),
          t("dice.rules.p3"),
          t("dice.rules.p4"),
          t("dice.rules.p5"),
          t("dice.rules.p6"),
        ]}
      />
    </main>
  );
};
