// Roulette(룰렛) — shared wire types.
//
// A pure-luck random picker: everyone in the room gets an equal slice of a
// 360° wheel (360 / playerCount degrees each, in seat order). Starting the
// game immediately decides the winner from the injected seed — there is no
// player input at all, ever. The server broadcasts the winner and a
// `spinStartedAt` timestamp right away; each client runs its own ~ROULETTE_
// SPIN_MS decelerating spin animation that lands on the winner's slice, then
// fires `roulette:reveal` once its local animation finishes so the room can
// advance to the results screen (this engine only re-checks isOver() after an
// action/lifecycle hook, so a single silent signal is required — see
// RouletteModule for why the server itself also gates on elapsed time).
//
// Single round, no configuration, nothing secret: getStateFor() is empty.

export type RouletteOptions = Record<string, never>;
export const defaultRouletteOptions: RouletteOptions = {};

// Shared by server (minimum time before it will honor a reveal) and client
// (how long the local spin animation runs) so both sides agree on the pace.
export const ROULETTE_SPIN_MS = 4200;

export type RouletteSlot = {
  playerId: string;
  seatIndex: number;
  angleStart: number; // degrees, 0 = 12 o'clock (pointer), clockwise
  angleEnd: number;
};

export type RoulettePhase = "spinning" | "ended";

export type RoulettePublicState = {
  phase: RoulettePhase;
  slots: RouletteSlot[]; // seat order, covers the full 360°
  winnerId: string; // decided the instant start() runs — nothing to hide
  spinStartedAt: number; // epoch ms; clients time their local spin from this
};

// No secrets in this game.
export type RoulettePrivateState = Record<string, never>;

export const ROULETTE_ACTIONS = {
  // Sent by any client once its local spin animation finishes. Idempotent —
  // the server ignores repeats and also refuses to resolve before
  // ROULETTE_SPIN_MS has actually elapsed, regardless of when it arrives.
  reveal: "roulette:reveal",
} as const;
