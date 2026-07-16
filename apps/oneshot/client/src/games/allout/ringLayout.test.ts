import { describe, it, expect } from "vitest";
import { computeRingLayout, labelMaxWidth, type RingInput, type Rect } from "./ringLayout";

/* Ports the browser-verified collision harness into a headless unit test.
   For every (playerCount x arena size x label length) we assert the layout is
   collision-free: no name overlaps an avatar, a count chip, the pile, another
   name, and nothing escapes the arena. Avatars must not overlap each other. */

const rectsOverlap = (a: Rect, b: Rect, m = 0): boolean =>
  !(a.r < b.l - m || a.l > b.r + m || a.b < b.t - m || a.t > b.b + m);
const circleRect = (cx: number, cy: number, rad: number, rc: Rect): boolean => {
  const nx = Math.min(Math.max(cx, rc.l), rc.r);
  const ny = Math.min(Math.max(cy, rc.t), rc.b);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < rad * rad;
};

// approximate a Korean nickname label: ~fontPx per char, capped by fair share
const labelSize = (chars: number, W: number, H: number, N: number, av: number, h = 11) => {
  const raw = chars * 9 + 8; // ~9px/char + padding
  return { w: Math.min(raw, labelMaxWidth(W, H, N, av)), h };
};

const arenaOf = (W: number): { W: number; H: number; av: number } => ({
  W,
  H: Math.round((W * 640) / 360) - 168, // phone aspect minus chrome (topbar+hand+acts)
  av: W < 320 ? 30 : 34,
});

const checkClean = (input: RingInput): string[] => {
  const lay = computeRingLayout(input);
  const fails: string[] = [];
  const pile: Rect = { l: lay.cx - 24, t: lay.cy - 34, r: lay.cx + 24, b: lay.cy + 34 };
  const lrect = (i: number): Rect => {
    const c = lay.labels[i]!;
    const s = input.labels[i]!;
    return { l: c.x - s.w / 2, t: c.y - s.h / 2, r: c.x + s.w / 2, b: c.y + s.h / 2 };
  };
  for (let i = 0; i < input.count; i++) {
    const ra = lrect(i);
    if (ra.l < -0.5 || ra.t < -0.5 || ra.r > input.width + 0.5 || ra.b > input.height + 0.5)
      fails.push(`offscreen@${i}`);
    for (let s = 0; s < input.count; s++) {
      if (circleRect(lay.seats[s]!.x, lay.seats[s]!.y, input.avatar / 2 - 1, ra)) fails.push(`label${i}-on-avatar${s}`);
      if (rectsOverlap(ra, lay.seats[s]!.chip)) fails.push(`label${i}-on-chip${s}`);
    }
    if (rectsOverlap(ra, pile)) fails.push(`label${i}-on-pile`);
    for (let j = i + 1; j < input.count; j++) if (rectsOverlap(ra, lrect(j))) fails.push(`label${i}-label${j}`);
  }
  for (let a = 0; a < input.count; a++)
    for (let b = a + 1; b < input.count; b++) {
      const A = lay.seats[a]!;
      const B = lay.seats[b]!;
      if ((A.x - B.x) ** 2 + (A.y - B.y) ** 2 < (input.avatar - 2) ** 2) fails.push(`avatar${a}-avatar${b}`);
    }
  return fails;
};

describe("computeRingLayout — collision-free across the matrix", () => {
  const widths = [280, 300, 320, 360, 412];
  const counts = Array.from({ length: 15 }, (_, i) => i + 2); // 2..16
  const nameLens = [2, 5]; // short + long nicknames

  for (const W of widths) {
    for (const chars of nameLens) {
      it(`W=${W}, ${chars}-char names: every player count 2..16 is clean`, () => {
        const { H, av } = arenaOf(W);
        for (const N of counts) {
          const chip = { w: 26, h: 15 };
          const labels = Array.from({ length: N }, () => labelSize(chars, W, H, N, av));
          const input: RingInput = { width: W, height: H, count: N, meIndex: 0, avatar: av, chip, labels };
          const fails = checkClean(input);
          expect(fails, `N=${N} W=${W} chars=${chars}: ${fails.slice(0, 4).join(", ")}`).toEqual([]);
        }
      });
    }
  }

  it("anchors me (index 0) at the bottom-centre of the ellipse", () => {
    const { H, av } = arenaOf(360);
    const labels = Array.from({ length: 8 }, () => ({ w: 30, h: 11 }));
    const lay = computeRingLayout({ width: 360, height: H, count: 8, meIndex: 0, avatar: av, chip: { w: 26, h: 15 }, labels });
    const me = lay.seats[0]!;
    expect(Math.abs(me.x - lay.cx)).toBeLessThan(1); // horizontally centred
    expect(me.y).toBeGreaterThan(lay.cy); // in the bottom half
    expect(Math.abs(me.y - (lay.cy + lay.ry))).toBeLessThan(2); // at the bottom vertex
  });
});
