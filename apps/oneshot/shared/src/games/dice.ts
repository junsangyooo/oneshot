// Dice(주사위) — shared wire types.
//
// A pure-luck dice race. Every round each player rolls TWO dice; the round
// ranking is by sum (higher = better, ties share the rank). Across rounds the
// LOWEST sum of per-round ranks wins — same scoring convention as upstage /
// allout. The number of rounds is chosen in an in-game `setup` phase via
// `dice:configure` (NOT lobby options), so start() needs no options. The server
// is authoritative for every roll (seeded Randomizer); nothing is secret, so
// getStateFor() carries no private data.

// Configured in-game via `dice:configure`, so the game takes no lobby
// options. Kept as an (empty) object type for the catalog.
export type DiceOptions = Record<string, never>;
export const defaultDiceOptions: DiceOptions = {};

export const DICE_ROUNDS_MIN = 1;
export const DICE_ROUNDS_MAX = 10;
export const DICE_ROUNDS_DEFAULT = 1;

export type DicePhase =
  | "setup" // host picks the number of rounds
  | "rolling" // everyone throws their two dice
  | "roundEnd" // round ranking revealed, host advances
  | "ended"; // whole game finished (isOver returns the result)

// One player's throw for the current round. Fully public — pure luck.
export type DiceRoll = {
  d1: number; // 1..6
  d2: number; // 1..6
  sum: number; // d1 + d2
  auto: boolean; // true when the server rolled for a disconnected player
};

export type DicePlayerPublic = {
  playerId: string;
  roll: DiceRoll | null; // this round's throw (null until rolled)
  roundRank: number | null; // rank in the just-resolved round (ties share)
  cumulativeScore: number; // sum of round ranks across rounds (lower is better)
};

export type DiceEndVote = {
  proposedBy: string;
  votes: Record<string, boolean>; // playerId -> agree
};

export type DicePublicState = {
  phase: DicePhase;
  roundNumber: number; // 1-based; 0 during setup
  totalRounds: number;
  players: DicePlayerPublic[]; // seat order
  waitingOn: string[]; // connected players who have not rolled yet (rolling phase)
  lastRoundRanking: string[] | null; // resolved round order, rank 1 first (ties by seat)
  endVote: DiceEndVote | null;
};

// No secrets in this game.
export type DicePrivateState = Record<string, never>;

// --- action payloads (carried on { type: "game:action"; action: GameAction }) ---

export type DiceConfigurePayload = {
  totalRounds: number; // clamped to [DICE_ROUNDS_MIN, DICE_ROUNDS_MAX]
};

export type DiceVoteEndPayload = { agree: boolean };

export const DICE_ACTIONS = {
  configure: "dice:configure",
  roll: "dice:roll",
  nextRound: "dice:nextRound", // host: roundEnd -> next round (or finish after the last)
  proposeEnd: "dice:proposeEnd", // host: open an early-end vote (from round 2 on)
  voteEnd: "dice:voteEnd",
} as const;
