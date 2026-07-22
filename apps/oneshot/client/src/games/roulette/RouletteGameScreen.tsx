import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PartyRoomState, RoulettePublicState } from "@oneshot/shared";
import { ROULETTE_ACTIONS, ROULETTE_SPIN_MS } from "@oneshot/shared";
import { useRoomStore } from "../../app/useRoomStore";
import { useT } from "../../i18n";
import { Backdrop, AvatarImg, SettingsModal, RulesModal } from "../../ui/terminal";

type Props = {
  roomState: PartyRoomState;
  privateState: unknown;
  currentPlayerId: string | null;
};

const REDUCED_MOTION =
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

// extra full turns so the deceleration into the winner's slice reads as one
// long, satisfying spin rather than a short flick
const FULL_SPINS = 6;
// beyond this many slices, per-player nicknames stop fitting — avatar only
const NAME_VISIBLE_MAX = 12;
// cycling wedge palette — shared tokens, themed for free, never adjacent-equal
const SLICE_COLORS = ["--card-red", "--card-yellow", "--card-blue", "--card-green", "--card-violet"];

const fill = (s: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

export const RouletteGameScreen = ({ roomState, privateState, currentPlayerId }: Props) => {
  void privateState; // roulette has no secrets — everything is public
  const t = useT();
  const send = useRoomStore((s) => s.send);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const pub = roomState.activeGame?.publicState as RoulettePublicState | undefined;

  const sliceCount = pub?.slots.length ?? 0;
  const sliceSize = sliceCount > 0 ? 360 / sliceCount : 360;
  const winnerSlot = pub ? (pub.slots.find((s) => s.playerId === pub.winnerId) ?? null) : null;

  // Tiny cosmetic jitter within the winning slice so the pin doesn't always
  // rest at the exact geometric center. Purely decorative — the outcome is
  // already fixed server-side — and stable per round (keyed by spinStartedAt).
  const jitterRef = useRef<{ key: number; value: number } | null>(null);
  if (pub && jitterRef.current?.key !== pub.spinStartedAt) {
    jitterRef.current = { key: pub.spinStartedAt, value: (Math.random() - 0.5) * 0.7 };
  }
  const jitter = jitterRef.current?.value ?? 0;

  const targetRotation = useMemo(() => {
    if (!winnerSlot) return 0;
    const center = winnerSlot.angleStart + sliceSize / 2 + jitter * sliceSize;
    return FULL_SPINS * 360 - center;
  }, [winnerSlot, sliceSize, jitter]);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  // Which round (by spinStartedAt) this mount has already armed the
  // animation/reveal timers for — guards against re-arming on every render
  // and against replaying the tumble on a reconnect/late mount.
  const armedFor = useRef<number | null>(null);
  const revealSent = useRef<number | null>(null);

  useEffect(() => {
    if (!pub || armedFor.current === pub.spinStartedAt) return;
    armedFor.current = pub.spinStartedAt;
    const wait = pub.spinStartedAt + ROULETTE_SPIN_MS - Date.now();
    const settled = wait <= 0 || pub.phase === "ended" || REDUCED_MOTION;

    setCelebrate(false);
    if (settled) {
      setRotation(targetRotation);
      setSpinning(false);
    } else {
      setRotation(0);
      setSpinning(true);
      // one tick so the browser paints rotation:0 before animating to target
      const raf = requestAnimationFrame(() => setRotation(targetRotation));
      const settle = setTimeout(() => {
        setSpinning(false);
        setCelebrate(true);
      }, wait);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(settle);
      };
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub?.spinStartedAt, pub?.phase]);

  // Tell the server once THIS client's local spin visually finishes — the
  // engine only re-checks isOver() after an action, and this game has no
  // other input (see RouletteModule for why the server also time-gates it).
  useEffect(() => {
    if (!pub || pub.phase === "ended" || revealSent.current === pub.spinStartedAt) return;
    const wait = pub.spinStartedAt + ROULETTE_SPIN_MS - Date.now();
    const fire = () => {
      revealSent.current = pub.spinStartedAt;
      send({ type: "game:action", action: { type: ROULETTE_ACTIONS.reveal, clientActionId: crypto.randomUUID() } });
    };
    if (wait <= 0) {
      fire();
      return;
    }
    const timer = setTimeout(fire, wait + 80);
    return () => clearTimeout(timer);
  }, [pub?.spinStartedAt, pub?.phase, send]);

  if (!pub) {
    return (
      <main className="scr scr--roulette">
        <Backdrop />
        <div className="rl-loading">{t("roulette.loading")}</div>
      </main>
    );
  }

  const nameOf = (id: string): string =>
    id === currentPlayerId ? t("roulette.you") : (roomState.players[id]?.nickname ?? "—");
  const showNames = sliceCount <= NAME_VISIBLE_MAX;
  const winner = roomState.players[pub.winnerId];

  // Alternating wedge colors from the shared card-color tokens — themed for
  // free (neon on cyber, warm-saturated on cozy) and never adjacent-equal.
  const wheelBackground =
    sliceCount <= 1
      ? "var(--card-red)"
      : `conic-gradient(${pub.slots
          .map((_, i) => `var(${SLICE_COLORS[i % SLICE_COLORS.length]}) ${i * sliceSize}deg ${(i + 1) * sliceSize}deg`)
          .join(", ")})`;

  return (
    <main className="scr scr--roulette">
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>RNG/WHEEL-360</div>
          <div>
            <span className="readout__lbl">SECTOR_ID: </span>
            <span className="hot">#{roomState.roomCode}</span>
          </div>
          <div>MODE: PURE_LUCK</div>
        </div>
        <div className="rl-title">
          <span className="lbl">{fill(t("roulette.playerCount"), { n: sliceCount })}</span>
        </div>
        <div className="rl-toolbar">
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
        </div>
      </header>

      <section className="rl-stage">
        <p className="rl-status">{spinning ? t("roulette.spinning") : celebrate ? t("roulette.congrats") : t("roulette.settling")}</p>

        <div className={`rl-wheel-wrap${celebrate ? " is-celebrating" : ""}`} style={{ "--rl-slices": sliceCount } as CSSProperties}>
          <div className="rl-pin" aria-hidden="true" />

          <div
            className={`rl-wheel${spinning ? " is-spinning" : ""}`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: spinning ? `${ROULETTE_SPIN_MS}ms` : "0ms",
              background: wheelBackground,
            }}
          />

          <div
            className="rl-labels"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: spinning ? `${ROULETTE_SPIN_MS}ms` : "0ms",
            }}
          >
            {pub.slots.map((slot) => {
              const center = slot.angleStart + sliceSize / 2;
              const isWinner = !spinning && celebrate && slot.playerId === pub.winnerId;
              return (
                <div key={slot.playerId} className="rl-label-arm" style={{ "--arm-deg": `${center}deg` } as CSSProperties}>
                  <div
                    className={`rl-label-counter${isWinner ? " is-winner" : ""}`}
                    style={{
                      transform: `rotate(${-rotation - center}deg)`,
                      transitionDuration: spinning ? `${ROULETTE_SPIN_MS}ms` : "0ms",
                    }}
                  >
                    <AvatarImg avatarKey={roomState.players[slot.playerId]?.avatarKey} themeId={roomState.players[slot.playerId]?.themeId} />
                    {showNames ? <span className="rl-label-name">{nameOf(slot.playerId)}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rl-hub" aria-hidden="true" />

          {celebrate ? (
            <div className="rl-fx" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => (
                <span key={i} className="rl-fx-piece" style={{ "--i": i } as CSSProperties} />
              ))}
            </div>
          ) : null}
        </div>

        {celebrate && winner ? (
          <div className="rl-winner-card">
            <span className="rl-winner-crown">♛</span>
            <AvatarImg avatarKey={winner.avatarKey} themeId={winner.themeId} />
            <span className="rl-winner-name">
              <span className="rl-winner-label">{t("roulette.winner")}</span>
              <span className="rl-winner-nick">{nameOf(pub.winnerId)}</span>
            </span>
          </div>
        ) : null}
      </section>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t("roulette.rules.title")}
        paragraphs={[t("roulette.rules.p1"), t("roulette.rules.p2"), t("roulette.rules.p3"), t("roulette.rules.p4")]}
      />
    </main>
  );
};
