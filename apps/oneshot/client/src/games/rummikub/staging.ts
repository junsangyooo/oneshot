// Client-side staging model for a Rummikub turn.
//
// The player edits a LOCAL working copy of the board + hand; the server only
// sees it on commit (as tile ids) and re-validates. This module mirrors the
// server's rules so the UI can gate the "End turn" button and never send a
// commit the server would reject.

import type { BoardMeld, Meld, Tile, TileColor } from "@oneshot/shared";
import {
  RUMMIKUB_COLORS,
  RUMMIKUB_INITIAL_MELD_MIN,
  classifyMeld,
  isValidMeld,
  meldValue,
} from "@oneshot/shared";

export type StageMeld = { id: string; tiles: Tile[] };

export type Stage = {
  board: StageMeld[];
  hand: Tile[];
  locked: Set<string>; // tile ids that were on the server board at turn start
};

export type DropTarget =
  | { zone: "hand" }
  | { zone: "new" }
  | { zone: "meld"; meldId: string; index?: number };

let seq = 0;
const newMeldId = (): string => `stage-${seq++}`;

export const stageFromServer = (board: BoardMeld[], hand: Tile[]): Stage => ({
  board: board.map((m) => ({ id: m.id, tiles: [...m.tiles] })),
  hand: [...hand],
  locked: new Set(board.flatMap((m) => m.tiles.map((t) => t.id))),
});

// ---------------------------------------------------------------------------
// Convenience: normalize + auto-split
// ---------------------------------------------------------------------------

// Reorder a VALID meld into the way a human would lay it out: a run ascending
// by the value each tile represents (jokers sit in the gap they fill), a group
// in the canonical colour order with jokers last. Invalid melds are left alone
// so the player can still see exactly what they built while fixing it.
export const normalizeMeld = (tiles: Tile[]): Tile[] => {
  const cls = classifyMeld(tiles);
  if (!cls.valid) return tiles;
  if (cls.kind === "run") {
    const value = (t: Tile): number => (t.kind === "num" ? t.num : (cls.jokerValues[t.id] ?? 99));
    return [...tiles].sort((a, b) => value(a) - value(b));
  }
  const colorIdx = (t: Tile): number =>
    t.kind === "num" ? RUMMIKUB_COLORS.indexOf(t.color as TileColor) : RUMMIKUB_COLORS.length;
  return [...tiles].sort((a, b) => colorIdx(a) - colorIdx(b));
};

// What each joker in a meld currently stands for, so the board can show it.
// Runs also yield the colour the joker is standing in for; a group's joker fills
// whichever colour is missing, which is ambiguous, so only the number is given.
export type JokerInfo = { num: number; color?: TileColor };

export const jokerInfo = (tiles: Tile[]): Record<string, JokerInfo> => {
  const cls = classifyMeld(tiles);
  if (!cls.valid) return {};
  const runColor =
    cls.kind === "run"
      ? (tiles.find((t): t is Extract<Tile, { kind: "num" }> => t.kind === "num")?.color ?? undefined)
      : undefined;
  const out: Record<string, JokerInfo> = {};
  for (const [id, num] of Object.entries(cls.jokerValues)) out[id] = { num, color: runColor };
  return out;
};

// Split a meld that a drop just made invalid into two valid melds, e.g. dropping
// a second red 7 into red 5-6-7-8-9 yields 5-6-7 + 7-8-9. Split points are tried
// nearest-first to `preferAt` so the cut lands where the player dropped.
// Returns null when no single cut makes both halves valid.
export const autoSplit = (tiles: Tile[], preferAt: number): Tile[][] | null => {
  if (isValidMeld(tiles)) return [tiles];
  const cuts = [];
  for (let k = 1; k < tiles.length; k += 1) cuts.push(k);
  cuts.sort((a, b) => Math.abs(a - preferAt) - Math.abs(b - preferAt));
  for (const k of cuts) {
    const left = tiles.slice(0, k);
    const right = tiles.slice(k);
    if (isValidMeld(left) && isValidMeld(right)) return [left, right];
  }
  return null;
};

const findTile = (stage: Stage, id: string): Tile | null => {
  const inHand = stage.hand.find((t) => t.id === id);
  if (inHand) return inHand;
  for (const m of stage.board) {
    const t = m.tiles.find((x) => x.id === id);
    if (t) return t;
  }
  return null;
};

const removeEverywhere = (stage: Stage, ids: Set<string>): { hand: Tile[]; board: StageMeld[] } => ({
  hand: stage.hand.filter((t) => !ids.has(t.id)),
  board: stage.board
    .map((m) => ({ ...m, tiles: m.tiles.filter((t) => !ids.has(t.id)) }))
    .filter((m) => m.tiles.length > 0),
});

// Move a set of tiles to a target. Returns a new stage, or null if illegal
// (e.g. returning a locked board tile to hand, or manipulating the board before
// the initial meld). `canManipulateBoard` = the player has done their initial meld.
export const place = (
  stage: Stage,
  tileIds: string[],
  target: DropTarget,
  canManipulateBoard: boolean,
): Stage | null => {
  const ids = tileIds.filter((id) => findTile(stage, id));
  if (ids.length === 0) return null;
  const idSet = new Set(ids);
  const tiles = ids.map((id) => findTile(stage, id)!);

  // Before the initial meld: cannot touch tiles that are already on the board —
  // neither by MOVING a board tile nor by dropping a hand tile INTO a board set
  // (the server rejects any pre-initial meld mixing locked and played tiles).
  if (!canManipulateBoard) {
    if (ids.some((id) => stage.locked.has(id))) return null;
    if (target.zone === "meld") {
      const targetMeld = stage.board.find((m) => m.id === target.meldId);
      if (targetMeld?.tiles.some((t) => stage.locked.has(t.id))) return null;
    }
  }

  if (target.zone === "hand") {
    // Locked (server-board) tiles can never go back to hand.
    if (ids.some((id) => stage.locked.has(id))) return null;
  }

  const base = removeEverywhere(stage, idSet);

  if (target.zone === "hand") {
    return { ...stage, hand: [...base.hand, ...tiles], board: base.board };
  }
  if (target.zone === "new") {
    return {
      ...stage,
      hand: base.hand,
      board: [...base.board, { id: newMeldId(), tiles: normalizeMeld(tiles) }],
    };
  }

  // target.zone === "meld" — insert, then auto-split if the insert broke the set
  // (5-6-7-8-9 + a second 7 becomes 5-6-7 and 7-8-9) and normalize the order.
  const board: StageMeld[] = [];
  let hitTarget = false;
  for (const m of base.board) {
    if (m.id !== target.meldId) {
      board.push(m);
      continue;
    }
    hitTarget = true;
    const at = target.index == null ? m.tiles.length : Math.max(0, Math.min(target.index, m.tiles.length));
    const merged = [...m.tiles.slice(0, at), ...tiles, ...m.tiles.slice(at)];
    const parts = autoSplit(merged, at + tiles.length) ?? [merged];
    parts.forEach((part, i) => {
      board.push(i === 0 ? { ...m, tiles: normalizeMeld(part) } : { id: newMeldId(), tiles: normalizeMeld(part) });
    });
  }
  // If the target meld vanished (was emptied by the move), fall back to a new meld.
  if (!hitTarget) {
    return { ...stage, hand: base.hand, board: [...base.board, { id: newMeldId(), tiles: normalizeMeld(tiles) }] };
  }
  return { ...stage, hand: base.hand, board };
};

// Tiles moved from hand onto the board this turn (not originally on the board).
export const playedTileIds = (stage: Stage): string[] =>
  stage.board.flatMap((m) => m.tiles.map((t) => t.id)).filter((id) => !stage.locked.has(id));

export type CommitCheck =
  | { ok: true }
  | { ok: false; reason: "empty" | "invalidMeld" | "initialLow" | "lockedTouched"; points?: number };

// Mirrors the server's commit validation so the UI can enable/disable End Turn.
export const checkCommit = (stage: Stage, didInitial: boolean): CommitCheck => {
  const played = playedTileIds(stage);
  if (played.length === 0) return { ok: false, reason: "empty" };
  for (const m of stage.board) {
    if (!isValidMeld(m.tiles)) return { ok: false, reason: "invalidMeld" };
  }
  if (!didInitial) {
    // Server rule: pre-initial, every meld is either all-new (from hand) or an
    // untouched board set. A mixed meld would bounce off the server, so the
    // green check must never light up for one.
    for (const m of stage.board) {
      const lockedCount = m.tiles.filter((t) => stage.locked.has(t.id)).length;
      if (lockedCount > 0 && lockedCount < m.tiles.length) {
        return { ok: false, reason: "lockedTouched" };
      }
    }
    const playedSet = new Set(played);
    const newMelds = stage.board.filter((m) => m.tiles.every((t) => playedSet.has(t.id)));
    const points = newMelds.reduce((s, m) => s + meldValue(m.tiles), 0);
    if (points < RUMMIKUB_INITIAL_MELD_MIN) return { ok: false, reason: "initialLow", points };
  }
  return { ok: true };
};

export const toCommitPayload = (stage: Stage): { board: Meld[] } => ({
  board: stage.board.map((m) => ({ id: m.id, tiles: m.tiles.map((t) => t.id) })),
});

// Which staged melds are invalid (for red highlighting).
export const invalidMeldIds = (stage: Stage): Set<string> =>
  new Set(stage.board.filter((m) => m.tiles.length > 0 && !isValidMeld(m.tiles)).map((m) => m.id));
