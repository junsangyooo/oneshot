// Client-side staging model for a Rummikub turn.
//
// The player edits a LOCAL working copy of the board + hand; the server only
// sees it on commit (as tile ids) and re-validates. This module mirrors the
// server's rules so the UI can gate the "End turn" button and never send a
// commit the server would reject.

import type { BoardMeld, Meld, Tile } from "@oneshot/shared";
import {
  RUMMIKUB_INITIAL_MELD_MIN,
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

  // Before the initial meld: cannot touch tiles that are already on the board.
  if (!canManipulateBoard && ids.some((id) => stage.locked.has(id))) return null;

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
      board: [...base.board, { id: newMeldId(), tiles }],
    };
  }
  // target.zone === "meld"
  const board = base.board.map((m) => {
    if (m.id !== target.meldId) return m;
    const at = target.index == null ? m.tiles.length : Math.max(0, Math.min(target.index, m.tiles.length));
    const next = [...m.tiles.slice(0, at), ...tiles, ...m.tiles.slice(at)];
    return { ...m, tiles: next };
  });
  // If the target meld vanished (was emptied by the move), fall back to a new meld.
  if (!board.some((m) => m.id === target.meldId)) {
    return { ...stage, hand: base.hand, board: [...base.board, { id: newMeldId(), tiles }] };
  }
  return { ...stage, hand: base.hand, board };
};

// Tiles moved from hand onto the board this turn (not originally on the board).
export const playedTileIds = (stage: Stage): string[] =>
  stage.board.flatMap((m) => m.tiles.map((t) => t.id)).filter((id) => !stage.locked.has(id));

export type CommitCheck =
  | { ok: true }
  | { ok: false; reason: "empty" | "invalidMeld" | "initialLow"; points?: number };

// Mirrors the server's commit validation so the UI can enable/disable End Turn.
export const checkCommit = (stage: Stage, didInitial: boolean): CommitCheck => {
  const played = playedTileIds(stage);
  if (played.length === 0) return { ok: false, reason: "empty" };
  for (const m of stage.board) {
    if (!isValidMeld(m.tiles)) return { ok: false, reason: "invalidMeld" };
  }
  if (!didInitial) {
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
