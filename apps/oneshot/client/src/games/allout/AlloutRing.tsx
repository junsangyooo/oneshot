import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AlloutTop, AlloutPublicState } from "@oneshot/shared";
import { AvatarImg } from "../../ui/terminal";
import { AlloutCardFace } from "./AlloutCard";
import { computeSeats, placeLabels, labelMaxWidth, type SeatBase } from "./ringLayout";

export interface RingPlayer {
  id: string;
  nickname: string;
  avatarKey: string;
  themeId: string;
  count: number;
  finished: boolean;
  isMe: boolean;
  isTurn: boolean;
  isAttacker: boolean;
}

interface Props {
  players: RingPlayer[]; // in seat/turn order
  meIndex: number; // index of me in `players`, or -1 to anchor seat 0
  top: AlloutTop | null;
  direction: 1 | -1;
  pendingAttack: number;
  shaking: boolean; // pile shakes while auto-taking
  lastPlay: AlloutPublicState["lastPlay"];
  lastDraw: AlloutPublicState["lastDraw"];
  youLabel: string;
}

const CHIP = { w: 30, h: 16 };
const FLOW_DUR = 11000; // ms — a calm ambient current ("speed 2")
const PLAY_DUR = 420;
const DRAW_TOTAL = 520; // total budget for a multi-card draw (stagger compresses)
const EASE = "cubic-bezier(0.05, 0.7, 0.1, 1)"; // M3 emphasized-decelerate

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const AlloutRing = ({
  players,
  meIndex,
  top,
  direction,
  pendingAttack,
  shaking,
  lastPlay,
  lastDraw,
  youLabel,
}: Props) => {
  const arenaRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [layout, setLayout] = useState<{ base: SeatBase; labels: { x: number; y: number }[] } | null>(null);

  const n = players.length;
  const av = dims.w && dims.w < 340 ? 30 : 34;
  const maxLabel = dims.w ? labelMaxWidth(dims.w, dims.h, Math.max(n, 1), av) : 58;
  const sig = players.map((p) => `${p.id}:${p.nickname}:${p.count}`).join("|");

  // track arena size
  useEffect(() => {
    const el = arenaRef.current;
    if (!el) return;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // compute seat geometry + declutter labels (single pass: label sizes don't depend on position)
  useLayoutEffect(() => {
    if (!dims.w || !dims.h || n === 0) {
      setLayout(null);
      return;
    }
    const base = computeSeats({
      width: dims.w,
      height: dims.h,
      count: n,
      meIndex: Math.max(0, meIndex),
      avatar: av,
      chip: CHIP,
    });
    const sizes = players.map((_, i) => {
      const node = labelRefs.current[i];
      return node ? { w: node.offsetWidth, h: node.offsetHeight } : { w: 30, h: 11 };
    });
    setLayout({ base, labels: placeLabels(base, dims.w, dims.h, av, sizes) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.w, dims.h, n, meIndex, av, sig, maxLabel]);

  // direction-flow comet — a bright arc drifting along the true seat ellipse
  useEffect(() => {
    const path = pathRef.current;
    if (!path || !layout || prefersReducedMotion()) return;
    const L = path.getTotalLength();
    const arc = L * 0.26;
    path.style.strokeDasharray = `${arc} ${L - arc}`;
    const anim = path.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -direction * L }], {
      duration: FLOW_DUR,
      iterations: Infinity,
      easing: "linear",
    });
    return () => anim.cancel();
  }, [layout, direction]);

  // seat lookup by player id (for card-travel origins/targets)
  const seatOf = (id: string): { x: number; y: number } | null => {
    if (!layout) return null;
    const idx = players.findIndex((p) => p.id === id);
    return idx >= 0 ? layout.base.seats[idx]! : null;
  };

  // Baseline: adopt whatever seq the server already had AT MOUNT, so a reconnect
  // mid-game doesn't replay an old play/draw. At round start these are null, so the
  // first real event (null -> value) is correctly seen as new and animates.
  const playSeqRef = useRef<number | null>(null);
  const drawSeqRef = useRef<number | null>(null);
  useEffect(() => {
    playSeqRef.current = lastPlay?.seq ?? null;
    drawSeqRef.current = lastDraw?.seq ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- card motion: play (seat -> pile) ---
  useEffect(() => {
    if (!lastPlay || !layout) return;
    if (playSeqRef.current === lastPlay.seq) return;
    playSeqRef.current = lastPlay.seq;
    const from = seatOf(lastPlay.byPlayerId);
    const host = ghostRef.current;
    if (!from || !host) return;
    const to = { x: layout.base.cx, y: layout.base.cy };
    spawnCard(host, from, to, top?.color ?? "wild", PLAY_DUR, 0, prefersReducedMotion());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPlay?.seq, layout]);

  // --- card motion: draw/eat (pile -> seat), staggered, total-time constant ---
  useEffect(() => {
    if (!lastDraw || !layout) return;
    if (drawSeqRef.current === lastDraw.seq) return;
    drawSeqRef.current = lastDraw.seq;
    const to = seatOf(lastDraw.playerId);
    const host = ghostRef.current;
    if (!to || !host) return;
    const from = { x: layout.base.cx, y: layout.base.cy };
    const shown = Math.min(lastDraw.count, 6);
    const stagger = Math.min(90, DRAW_TOTAL / shown);
    const reduced = prefersReducedMotion();
    for (let k = 0; k < shown; k++) spawnCard(host, from, to, "wild", 300, k * stagger, reduced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastDraw?.seq, layout]);

  return (
    <div className="ao-arena" ref={arenaRef}>
      {layout ? (
        <svg className="ao-flow" viewBox={`0 0 ${dims.w} ${dims.h}`} aria-hidden preserveAspectRatio="none">
          <path className="ao-flow__track" d={layout.base.path} />
          <path className="ao-flow__comet" ref={pathRef} d={layout.base.path} />
        </svg>
      ) : null}

      <div
        className={`ao-pile${shaking ? " is-shaking" : ""}`}
        data-color={top?.color ?? "wild"}
        style={layout ? { left: layout.base.cx, top: layout.base.cy } : undefined}
      >
        {top ? <AlloutCardFace key={top.card.id} card={top.card} /> : null}
        {pendingAttack > 0 ? <span className="ao-pile__atk">+{pendingAttack}</span> : null}
      </div>

      {players.map((p, i) => {
        const pos = layout?.base.seats[i];
        const lbl = layout?.labels[i];
        const cls = ["ao-seat", p.isMe ? "is-me" : "", p.isTurn ? "is-turn" : "", p.finished ? "is-out" : ""].filter(Boolean).join(" ");
        return (
          <div key={p.id}>
            <div
              className={cls}
              style={pos ? { left: pos.x, top: pos.y } : { left: -999, top: -999 }}
              aria-current={p.isTurn ? "true" : undefined}
            >
              <span className="ao-seat__av" style={{ width: av, height: av }}>
                <AvatarImg avatarKey={p.avatarKey} themeId={p.themeId} />
              </span>
              <span className={`ao-chip${p.count <= 1 ? " is-win" : ""}`} aria-label={`${p.count}`}>
                <span className="ao-chip__ico" aria-hidden />
                {p.count}
              </span>
            </div>
            <div
              className={`ao-name${p.isMe ? " is-me" : ""}${p.isTurn ? " is-turn" : ""}`}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              style={{
                left: lbl ? lbl.x : -999,
                top: lbl ? lbl.y : -999,
                maxWidth: maxLabel,
              }}
            >
              {p.nickname}
              {p.isMe ? <span className="ao-name__you"> {youLabel}</span> : null}
            </div>
          </div>
        );
      })}

      <div className="ao-ghosts" ref={ghostRef} aria-hidden />
    </div>
  );
};

/** Fly a small card ghost from `from` to `to` within the arena-local coordinate
 *  space. Reduced motion collapses the travel to a short fade at the destination. */
function spawnCard(
  host: HTMLDivElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  duration: number,
  delay: number,
  reduced: boolean,
): void {
  const g = document.createElement("div");
  g.className = "ao-ghost";
  g.dataset.color = color;
  const start = reduced ? to : from;
  g.style.left = `${start.x}px`;
  g.style.top = `${start.y}px`;
  host.appendChild(g);
  const cleanup = (): void => {
    g.remove();
  };
  if (reduced) {
    g.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 200, delay, fill: "forwards" }).onfinish = cleanup;
    return;
  }
  g.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.7) rotate(-8deg)", opacity: 0.9 },
      {
        transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(1) rotate(3deg)`,
        opacity: 1,
      },
    ],
    { duration, delay, easing: EASE, fill: "forwards" },
  ).onfinish = cleanup;
}
