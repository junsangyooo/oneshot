/* =========================================================
   ALL OUT — ring layout (pure geometry, no DOM)

   Seats sit on an ellipse sized to the arena. "Me" is anchored at the
   bottom-centre; the rest are spread by EQUAL ARC LENGTH (not equal angle),
   so a wide desktop ellipse lines players along the long top/bottom runs
   instead of bunching them at the narrow left/right ends.

   Name labels are pushed off the ring into empty margin:
     - top/bottom seats  -> vertically (out into the top/bottom margin)
     - left/right seats   -> inward, into the gap between the ring and the pile
   then a declutter pass resolves overlaps against avatars, count chips, the
   central pile, and other labels. Each label is capped to its fair share of
   the perimeter (ellipsis handled by the caller via maxWidth).

   This file is intentionally DOM-free so it can be unit-tested for
   collision-freeness without a browser (see ringLayout.test.ts).
   ========================================================= */

export interface Size {
  w: number;
  h: number;
}
export interface RingInput {
  width: number;
  height: number;
  count: number;
  meIndex: number;
  avatar: number; // avatar diameter (px)
  chip: Size; // count chip size, attached just below the avatar
  labels: Size[]; // measured name-label sizes, indexed by seat
}
export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}
export interface RingSeat {
  x: number;
  y: number;
  chip: Rect; // count-chip box (below avatar)
}
export interface RingLayout {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  path: string; // svg path `d` for the direction-flow ellipse
  seats: RingSeat[];
  labels: { x: number; y: number }[]; // label centres (transform-origin: centre)
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// --- ellipse arc-length table (analytic, replaces SVG getPointAtLength) ---
interface ArcTable {
  cum: number[];
  dt: number;
  total: number;
  steps: number;
}
const arcTable = (rx: number, ry: number, steps = 1440): ArcTable => {
  const dt = (2 * Math.PI) / steps;
  const speed = (t: number): number => Math.hypot(rx * Math.sin(t), ry * Math.cos(t));
  const cum = [0];
  let s = 0;
  for (let i = 0; i < steps; i++) {
    const t0 = i * dt;
    s += ((speed(t0) + speed(t0 + dt)) / 2) * dt; // trapezoid
    cum.push(s);
  }
  return { cum, dt, total: s, steps };
};
const tAtArc = (tbl: ArcTable, sIn: number): number => {
  const { cum, dt, total, steps } = tbl;
  const s = ((sIn % total) + total) % total;
  let lo = 0;
  let hi = steps;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (cum[m]! < s) lo = m + 1;
    else hi = m;
  }
  const i = Math.max(1, lo);
  const s0 = cum[i - 1]!;
  const s1 = cum[i]!;
  const frac = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
  return (i - 1 + frac) * dt;
};

const rectsOverlap = (a: Rect, b: Rect, m = 0): boolean =>
  !(a.r < b.l - m || a.l > b.r + m || a.b < b.t - m || a.t > b.b + m);
const circleRect = (cx: number, cy: number, rad: number, rc: Rect): boolean => {
  const nx = clamp(cx, rc.l, rc.r);
  const ny = clamp(cy, rc.t, rc.b);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < rad * rad;
};

interface LabelState {
  i: number;
  x: number;
  y: number; // anchor = avatar centre
  dirx: number;
  diry: number;
  w: number;
  h: number;
  off: number;
  cross: number;
  lx: number;
  ly: number;
}
const place = (la: LabelState): void => {
  la.lx = la.x + la.dirx * la.off + -la.diry * la.cross;
  la.ly = la.y + la.diry * la.off + la.dirx * la.cross;
};

export interface SeatBase {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  path: string;
  seats: RingSeat[];
}
export type SeatInput = Omit<RingInput, "labels">;

/** Seat + pile + flow-path geometry. Independent of label text, so the caller
 *  can render avatars, measure the labels, then call placeLabels. */
export function computeSeats(input: SeatInput): SeatBase {
  const { width: W, height: H, count: N, meIndex, avatar: av, chip } = input;
  const cx = W / 2;
  const cy = H / 2;
  const rx = Math.max(30, cx - (av * 0.7 + 18));
  const ry = Math.max(24, cy - (av * 0.6 + 34));
  const tbl = arcTable(rx, ry);
  const L = tbl.total;
  const point = (t: number): { x: number; y: number } => ({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  const idxBottom = Math.round(Math.PI / 2 / tbl.dt);
  const sBot = tbl.cum[idxBottom]!;

  const seats: RingSeat[] = [];
  for (let i = 0; i < N; i++) {
    const rel = (((i - meIndex) % N) + N) % N;
    const t = tAtArc(tbl, sBot + (rel / N) * L);
    const { x, y } = point(t);
    const chy = y + av / 2 + chip.h / 2 + 1;
    seats.push({ x, y, chip: { l: x - chip.w / 2, t: chy - chip.h / 2, r: x + chip.w / 2, b: chy + chip.h / 2 } });
  }
  const path = `M ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} Z`;
  return { cx, cy, rx, ry, path, seats };
}

/** Places name labels off the ring and declutters them collision-free. */
export function placeLabels(base: SeatBase, W: number, H: number, av: number, labelSizes: Size[]): { x: number; y: number }[] {
  const { cx, cy, seats } = base;
  const pile: Rect = { l: cx - 24, t: cy - 34, r: cx + 24, b: cy + 34 };
  const labels: LabelState[] = [];
  for (let i = 0; i < seats.length; i++) {
    const { x, y } = seats[i]!;
    const size = labelSizes[i] ?? { w: 30, h: 11 };
    const w = size.w;
    const h = size.h;
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const isSide = Math.abs(uy) < 0.45;
    let dirx: number;
    let diry: number;
    let baseOff: number;
    const chipProtrudeDown = seats[i]!.chip.b - y + 4;
    if (isSide) {
      dirx = -(Math.sign(ux) || 1);
      diry = 0;
      baseOff = av / 2 + w / 2 + 6;
    } else {
      dirx = 0;
      diry = y < cy ? -1 : 1;
      baseOff = av / 2 + (diry > 0 ? chipProtrudeDown : 0) + h / 2 + 6;
    }
    const la: LabelState = { i, x, y, dirx, diry, w, h, off: baseOff, cross: 0, lx: x, ly: y };
    place(la);
    labels.push(la);
  }

  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let a = 0; a < labels.length; a++) {
      const la = labels[a]!;
      const ra = (): Rect => ({ l: la.lx - la.w / 2, t: la.ly - la.h / 2, r: la.lx + la.w / 2, b: la.ly + la.h / 2 });
      for (let s = 0; s < seats.length; s++) {
        if (circleRect(seats[s]!.x, seats[s]!.y, av / 2, ra())) {
          la.off += 3;
          place(la);
          moved = true;
        }
        if (rectsOverlap(ra(), seats[s]!.chip)) {
          la.off += 3;
          place(la);
          moved = true;
        }
      }
      if (rectsOverlap(ra(), pile)) {
        la.off = Math.max(6, la.off - 3);
        place(la);
        moved = true;
      }
      for (let b = 0; b < labels.length; b++) {
        if (b === a) continue;
        const lb = labels[b]!;
        const rb: Rect = { l: lb.lx - lb.w / 2, t: lb.ly - lb.h / 2, r: lb.lx + lb.w / 2, b: lb.ly + lb.h / 2 };
        if (rectsOverlap(ra(), rb, 1)) {
          la.cross += (la.i < lb.i ? -1 : 1) * 2.5;
          place(la);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  const pad = 4;
  return labels.map((la) => ({
    x: clamp(la.lx, pad + la.w / 2, W - pad - la.w / 2),
    y: clamp(la.ly, pad + la.h / 2, H - pad - la.h / 2),
  }));
}

export function computeRingLayout(input: RingInput): RingLayout {
  const base = computeSeats(input);
  const maxLabel = labelMaxWidth(input.width, input.height, input.count, input.avatar);
  const sizes = input.labels.map((s) => ({ w: Math.min(s.w, maxLabel), h: s.h }));
  const labels = placeLabels(base, input.width, input.height, input.avatar, sizes);
  return { ...base, labels };
}

/** Fair-share label width cap (px) for a given ring — caller uses it as maxWidth. */
export function labelMaxWidth(W: number, H: number, N: number, av: number): number {
  const cx = W / 2;
  const cy = H / 2;
  const rx = Math.max(30, cx - (av * 0.7 + 18));
  const ry = Math.max(24, cy - (av * 0.6 + 34));
  const L = arcTable(rx, ry, 360).total;
  return Math.max(22, Math.min(58, (L / N) * 0.8));
}
