// Hand sorting (777 / 789) and long-press auto-select for Rummikub.

import type { Tile, TileColor } from "@oneshot/shared";
import { RUMMIKUB_COLORS } from "@oneshot/shared";

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

// Long-press: the chain the grab walks along, rightwards from the pressed tile.
//
// `rack` must be the hand in the order it is DISPLAYED, because the player is
// reaching for "the one next to it" on screen, not in some internal order.
// The first neighbour decides whether we're following a run (same colour, +1)
// or a group (same number, a new colour); the chain then extends while that
// keeps holding, and stops at the first tile that breaks it. A group tops out
// at four colours, a run at 13.
//
// The caller reveals this chain one tile at a time — see GRAB_FIRST_MS /
// GRAB_STEP_MS — so how long you hold decides how much you pick up.
// Jokers are never auto-pulled (kept for manual use).
export const grabChain = (rack: Tile[], tileId: string): string[] => {
  const start = rack.findIndex((t) => t.id === tileId);
  const pressed = rack[start];
  if (!pressed || pressed.kind !== "num") return [tileId];

  const chain: Extract<Tile, { kind: "num" }>[] = [pressed];
  const colors = new Set<TileColor>([pressed.color]);
  let mode: "run" | "group" | null = null;

  for (let i = start + 1; i < rack.length; i += 1) {
    const next = rack[i]!;
    if (!isNum(next)) break;
    const last = chain[chain.length - 1]!;

    if (mode === null) {
      if (next.color === pressed.color && next.num === pressed.num + 1) mode = "run";
      else if (next.num === pressed.num && !colors.has(next.color)) mode = "group";
      else break;
    }

    if (mode === "run") {
      if (next.color !== last.color || next.num !== last.num + 1) break;
    } else {
      if (next.num !== pressed.num || colors.has(next.color)) break;
      if (chain.length >= RUMMIKUB_COLORS.length) break; // a group is 4 tiles at most
    }
    chain.push(next);
    colors.add(next.color);
  }

  return chain.map((t) => t.id);
};
