// Rummikub(루미큐브) — shared wire types + the meld validator.
//
// Full standard rules. Tiles 1..13 in four colors, two copies per DECK, plus
// jokers. 2..4 players use one deck (106 tiles), 5..8 players use two decks
// (212 tiles) — decided at deal time from the seated count. On your turn you
// either COMMIT a rearrangement of the whole board (playing >=1 tile from hand)
// or DRAW one tile. First to empty their hand wins.
//
// Authority model: the client stages board/hand edits locally and sends the
// WHOLE proposed board on commit; the server re-validates atomically (tile
// conservation + every meld valid + hand shrinks + initial-meld >= 30). Because
// board rearrangement and joker retrieval are just "the final board is still
// valid and conserved", there is no special action for them — this one
// validator is the whole game. It lives here so client (live highlight) and
// server (authority) run the SAME code.

export type TileColor = "red" | "blue" | "orange" | "black";

export type Tile =
  | { id: string; kind: "num"; color: TileColor; num: number } // num 1..13
  | { id: string; kind: "joker" };

// A set as sent on the wire (client -> server commit): tile IDS only. The
// server IGNORES any client-sent faces and resolves each id against its own
// authoritative tiles, so a client can never lie about what a tile is.
export type Meld = { id: string; tiles: string[] };

// A set as rendered (public state + client staging): full tile FACES. The board
// is public, so every client needs the faces to draw it.
export type BoardMeld = { id: string; tiles: Tile[] };

export type TurnSeconds = 15 | 30 | 60 | 90 | 120 | 0; // 0 = unlimited
export const RUMMIKUB_TURN_SECONDS: readonly TurnSeconds[] = [15, 30, 60, 90, 120, 0];
export const RUMMIKUB_DEFAULT_TURN_SECONDS: TurnSeconds = 60;

export const RUMMIKUB_START_HAND = 14;
export const RUMMIKUB_INITIAL_MELD_MIN = 30;
export const RUMMIKUB_MIN_MELD = 3;
export const RUMMIKUB_MAX_NUM = 13;
export const RUMMIKUB_JOKER_PENALTY = 30; // a joker held at game end counts 30
export const RUMMIKUB_COLORS: readonly TileColor[] = ["red", "blue", "orange", "black"];

// Configured in-game via `rummikub:configure`, so no lobby options.
export type RummikubOptions = Record<string, never>;
export const defaultRummikubOptions: RummikubOptions = {};

export type RummikubPhase = "setup" | "play" | "ended";

export type RummikubDeckCount = 1 | 2;

// One deck per <=4 players, two decks for 5..8. Decided when the game deals.
export const rummikubDeckCount = (playerCount: number): RummikubDeckCount =>
  playerCount >= 5 ? 2 : 1;

// -------------------------------------------------------------------------
// Deck
// -------------------------------------------------------------------------

export const buildRummikubDeck = (deckCount: RummikubDeckCount): Tile[] => {
  const tiles: Tile[] = [];
  const copies = deckCount * 2; // two copies of every numbered tile PER deck
  for (const color of RUMMIKUB_COLORS) {
    for (let num = 1; num <= RUMMIKUB_MAX_NUM; num += 1) {
      for (let copy = 0; copy < copies; copy += 1) {
        tiles.push({ id: `${color}-${num}-${copy}`, kind: "num", color, num });
      }
    }
  }
  const jokerCount = deckCount * 2; // two jokers per deck
  for (let copy = 0; copy < jokerCount; copy += 1) {
    tiles.push({ id: `joker-${copy}`, kind: "joker" });
  }
  return tiles;
};

// -------------------------------------------------------------------------
// Validator (pure) — group / run classification with joker inference
// -------------------------------------------------------------------------

export type MeldClass =
  | { valid: true; kind: "group" | "run"; jokerValues: Record<string, number> }
  | { valid: false };

const isJoker = (t: Tile): t is { id: string; kind: "joker" } => t.kind === "joker";

// Try to classify `tiles` as a valid group or run, inferring what number each
// joker represents. Deterministic: group is tried first, then run; within a run
// the smallest valid window is chosen.
export const classifyMeld = (tiles: Tile[]): MeldClass => {
  if (tiles.length < RUMMIKUB_MIN_MELD || tiles.length > 13) return { valid: false };
  const jokers = tiles.filter(isJoker);
  const reals = tiles.filter((t): t is Extract<Tile, { kind: "num" }> => t.kind === "num");
  const j = jokers.length;

  // --- GROUP: same number, distinct colors, length 3..4 ---
  const asGroup = (): MeldClass => {
    if (tiles.length > 4) return { valid: false };
    let num = RUMMIKUB_MAX_NUM; // all-joker fallback value (deterministic)
    if (reals.length > 0) {
      num = reals[0]!.num;
      if (!reals.every((t) => t.num === num)) return { valid: false };
      const colors = new Set(reals.map((t) => t.color));
      if (colors.size !== reals.length) return { valid: false }; // duplicate color
    }
    // reals.length + j <= 4 is guaranteed by tiles.length <= 4 here.
    const jokerValues: Record<string, number> = {};
    for (const joker of jokers) jokerValues[joker.id] = num;
    return { valid: true, kind: "group", jokerValues };
  };

  // --- RUN: same color, consecutive ascending, length >= 3, within 1..13 ---
  const asRun = (): MeldClass => {
    const L = tiles.length;
    if (reals.length > 0) {
      const color = reals[0]!.color;
      if (!reals.every((t) => t.color === color)) return { valid: false };
      const nums = reals.map((t) => t.num);
      if (new Set(nums).size !== nums.length) return { valid: false }; // dup number
      const minReal = Math.min(...nums);
      const maxReal = Math.max(...nums);
      if (maxReal - minReal > L - 1) return { valid: false }; // can't fit in window
      // Find the smallest window start s in [1, 13-L+1] containing every real.
      for (let s = 1; s <= RUMMIKUB_MAX_NUM - L + 1; s += 1) {
        const end = s + L - 1;
        if (minReal < s || maxReal > end) continue;
        const occupied = new Set(nums);
        const jokerValues: Record<string, number> = {};
        let idx = 0;
        for (let n = s; n <= end; n += 1) {
          if (!occupied.has(n)) {
            const joker = jokers[idx];
            if (!joker) return { valid: false };
            jokerValues[joker.id] = n;
            idx += 1;
          }
        }
        if (idx === j) return { valid: true, kind: "run", jokerValues };
      }
      return { valid: false };
    }
    // all-joker run: place 1..L
    if (L > RUMMIKUB_MAX_NUM) return { valid: false };
    const jokerValues: Record<string, number> = {};
    jokers.forEach((joker, i) => (jokerValues[joker.id] = i + 1));
    return { valid: true, kind: "run", jokerValues };
  };

  const group = asGroup();
  if (group.valid) return group;
  return asRun();
};

export const isValidMeld = (tiles: Tile[]): boolean => classifyMeld(tiles).valid;

// Sum of tile values in a valid meld (jokers count as the value they represent).
// Returns 0 for an invalid meld.
export const meldValue = (tiles: Tile[]): number => {
  const cls = classifyMeld(tiles);
  if (!cls.valid) return 0;
  let sum = 0;
  for (const t of tiles) {
    if (t.kind === "num") sum += t.num;
    else sum += cls.jokerValues[t.id] ?? 0;
  }
  return sum;
};

// Value of a tile still held in hand at game end (joker = 30 penalty).
export const handTileValue = (tile: Tile): number =>
  tile.kind === "joker" ? RUMMIKUB_JOKER_PENALTY : tile.num;

export const handSum = (tiles: Tile[]): number => tiles.reduce((s, t) => s + handTileValue(t), 0);

// -------------------------------------------------------------------------
// Public / private state
// -------------------------------------------------------------------------

export type RummikubPublicPlayer = {
  playerId: string;
  handCount: number; // number of tiles held — NEVER the contents
  hasDoneInitialMeld: boolean;
  connected: boolean;
};

// For one-shot client effects. meldIds = melds that gained tiles this commit.
export type RummikubLastEvent = {
  kind: "draw" | "commit" | "skip" | "timeout";
  playerId: string;
  meldIds?: string[];
  seq: number; // bumps every event so the client can key animations
};

export type RummikubEndVote = {
  proposedBy: string;
  votes: Record<string, boolean>; // playerId -> agree
};

export type RummikubPublicState = {
  phase: RummikubPhase;
  turnSeconds: TurnSeconds;
  deckCount: RummikubDeckCount;
  board: BoardMeld[]; // the board is PUBLIC (tile faces included)
  poolCount: number;
  order: string[]; // seat order
  players: RummikubPublicPlayer[];
  currentTurnPlayerId: string | null;
  turnNumber: number;
  turnDeadline: number | null; // epoch ms; null when unlimited
  lastEvent: RummikubLastEvent | null;
  endVote: RummikubEndVote | null;
  endVoteCooldownUntil: number | null;
};

export type RummikubPrivateState = {
  hand: Tile[]; // my tiles only
  hasDoneInitialMeld: boolean;
};

// -------------------------------------------------------------------------
// Action payloads (carried on { type: "game:action"; action: GameAction })
// -------------------------------------------------------------------------

export type RummikubConfigurePayload = { turnSeconds: TurnSeconds };
export type RummikubCommitPayload = { board: Meld[] }; // the whole proposed board
export type RummikubTimeoutPayload = { turnNumber: number };
export type RummikubVoteEndPayload = { agree: boolean };

export const RUMMIKUB_ACTIONS = {
  configure: "rummikub:configure",
  commit: "rummikub:commit",
  draw: "rummikub:draw",
  timeout: "rummikub:timeout",
  skipTurn: "rummikub:skipTurn",
  proposeEnd: "rummikub:proposeEnd",
  voteEnd: "rummikub:voteEnd",
} as const;
