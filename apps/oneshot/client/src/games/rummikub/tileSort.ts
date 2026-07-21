// Hand sorting (777 / 789) and long-press auto-select for Rummikub.

import type { Tile, TileColor } from "@oneshot/shared";
import { RUMMIKUB_COLORS, isValidMeld } from "@oneshot/shared";

const colorIdx = (c: TileColor): number => RUMMIKUB_COLORS.indexOf(c);

const isNum = (t: Tile): t is Extract<Tile, { kind: "num" }> => t.kind === "num";

// "777" — group by NUMBER, then color. Puts same-numbers side by side so groups
// are easy to spot. Jokers last.
export const sort777 = (hand: Tile[]): Tile[] =>
  [...hand].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "joker" ? 1 : -1;
    if (isNum(a) && isNum(b)) {
      if (a.num !== b.num) return a.num - b.num;
      return colorIdx(a.color) - colorIdx(b.color);
    }
    return a.id.localeCompare(b.id);
  });

// "789" — group by COLOR, then number. Lines up consecutive runs within a color.
// Jokers last.
export const sort789 = (hand: Tile[]): Tile[] =>
  [...hand].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "joker" ? 1 : -1;
    if (isNum(a) && isNum(b)) {
      if (a.color !== b.color) return colorIdx(a.color) - colorIdx(b.color);
      return a.num - b.num;
    }
    return a.id.localeCompare(b.id);
  });

// Long-press: grab the set in `hand` that the pressed tile can actually be laid
// down with — a legal run or group. Anything short of a playable set (a lone
// 7-8, a number in only two colours) is NOT dragged along: you get just the
// tile you pressed. Prefers the longer of {run continuation, group}.
// Jokers are not auto-pulled (kept for manual use).
export const autoExtend = (hand: Tile[], tileId: string): string[] => {
  const pressed = hand.find((t) => t.id === tileId);
  if (!pressed || pressed.kind !== "num") return [tileId];

  // --- run: same color, consecutive around the pressed number ---
  const sameColor = hand.filter((t): t is Extract<Tile, { kind: "num" }> => isNum(t) && t.color === pressed.color);
  const byNum = new Map<number, Extract<Tile, { kind: "num" }>>();
  for (const t of sameColor) if (!byNum.has(t.num)) byNum.set(t.num, t);
  const runIds: string[] = [pressed.id];
  for (let v = pressed.num - 1; byNum.has(v); v -= 1) runIds.unshift(byNum.get(v)!.id);
  for (let v = pressed.num + 1; byNum.has(v); v += 1) runIds.push(byNum.get(v)!.id);
  const runTiles = runIds.map((id) => hand.find((t) => t.id === id)!);
  const runOk = runIds.length >= 3 && isValidMeld(runTiles);

  // --- group: same number, distinct colors ---
  const sameNum = hand.filter((t): t is Extract<Tile, { kind: "num" }> => isNum(t) && t.num === pressed.num);
  const seen = new Set<TileColor>();
  const groupTiles: Extract<Tile, { kind: "num" }>[] = [];
  for (const t of sameNum) {
    if (!seen.has(t.color)) {
      seen.add(t.color);
      groupTiles.push(t);
    }
  }
  const groupIds = groupTiles.map((t) => t.id);
  const groupOk = groupIds.length >= 3 && isValidMeld(groupTiles);

  if (runOk && (!groupOk || runIds.length >= groupIds.length)) return runIds;
  if (groupOk) return groupIds;
  return [tileId];
};
