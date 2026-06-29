// Liar games (라이어 / 바보 라이어) — shared wire types.
//
// Two games share this contract; they differ ONLY in what card the liars get:
//   - "liar"      : every liar gets a { kind: "liar" } card (they KNOW they lie).
//   - "fool-liar" : every liar gets the SAME { kind: "word" } decoy from the same
//                   category as the answer (they do NOT know they are the liar).
//
// Category + liar count are chosen in an in-game SETUP phase (the host sends a
// `configure` game-action), NOT through lobby options — so start() needs no
// options. The answer word is NEVER resolved server-side into a string: the
// server sends a category id (public) + a word INDEX in the private card, and
// each client renders the word in its own language via LIAR_CATEGORIES.

import type { LiarCategoryId } from "./liarCategories";

// No lobby options (configured in-game). Kept as an empty object for the catalog.
export type LiarOptions = Record<string, never>;
export const defaultLiarOptions: LiarOptions = {};

export type LiarPhase = "setup" | "reveal";

// A player's private card. "liar" renders as a localized "라이어"/"LIAR" label;
// "word" references LIAR_CATEGORIES[categoryId][wordIndex], rendered per-language.
export type LiarCard =
  | { kind: "liar" }
  | { kind: "word"; wordIndex: number };

export type LiarPublicState = {
  phase: LiarPhase;
  categoryId: LiarCategoryId | null; // null until configured
  liarCount: number; // 0 until configured. PUBLIC (how many liars exist) — never WHO.
  maxLiars: number; // for the setup picker (scales with player count)
  playerCount: number;
};

// Delivered only via getStateFor(playerId). Never present in public state.
export type LiarPrivateState = {
  categoryId: LiarCategoryId | null; // mirror so the client can resolve the word
  card: LiarCard | null; // null until the reveal phase
};

// --- action payloads (carried on { type: "game:action"; action: GameAction }) ---

export type LiarConfigurePayload = {
  categoryId: LiarCategoryId;
  liarCount: number;
};

// Action type strings. Each game uses its own namespace so a stray action from
// one game module is never accepted by the other.
export const LIAR_ACTIONS = {
  configure: "liar:configure",
  endGame: "liar:endGame",
} as const;

export const FOOL_LIAR_ACTIONS = {
  configure: "fool-liar:configure",
  endGame: "fool-liar:endGame",
} as const;
