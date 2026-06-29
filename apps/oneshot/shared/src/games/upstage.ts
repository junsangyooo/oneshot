// Upstage(업스테이지) — shared wire types.
//
// A pure number-card shedding game. Players shed same-number sets on their turn;
// first to empty their hand wins the hand. Across several hands, the LOWEST sum
// of per-hand ranks wins. Options (penalty, number of hands) are chosen in an
// in-game `setup` phase via `upstage:configure` (NOT lobby options), so start()
// needs no options. Server is authoritative for deck/deal/validation/scoring;
// hands are delivered only via getStateFor(playerId).

// A single card. value 1..maxRank for number cards (lower = stronger), or
// "star" for the two wild cards. A star played alone counts as (maxRank + 1).
export type UpstageCard = { id: string; value: number | "star" };

// Configured in-game via `upstage:configure`, so the game takes no lobby
// options. Kept as an (empty) object type for the catalog.
export type UpstageOptions = Record<string, never>;
export const defaultUpstageOptions: UpstageOptions = {};

export const UPSTAGE_HANDS_MIN = 1;
export const UPSTAGE_HANDS_MAX = 10;
export const UPSTAGE_HANDS_DEFAULT = 5;

export type UpstagePhase =
  | "setup" // host picks penalty + totalHands
  | "draw" // first hand only: everyone flips one card to set initial order
  | "declare" // a star-pair holder may declare a revolt (penalty on)
  | "tax" // penalty exchange: receivers pick cards to return
  | "play" // the shedding trick loop
  | "handEnd" // show this hand's ranking, host advances
  | "ended"; // whole game finished (isOver returns the result)

// The standing play at the top of the current trick (also each discard).
export type UpstagePlay = {
  playerId: string;
  cards: UpstageCard[];
  value: number; // effective value of the set (stars adopt it; star-alone = maxRank+1)
  count: number; // set size
};

export type UpstagePlayerPublic = {
  playerId: string;
  handCount: number; // number of cards held — NEVER the contents
  rank: number | null; // finishing rank this hand (1 = first out); null while in
  cumulativeScore: number; // sum of ranks across completed hands (lower is better)
  passed: boolean; // has passed since the last play in the current trick
};

export type UpstageEndVote = {
  proposedBy: string;
  votes: Record<string, boolean>; // playerId -> agree
};

export type UpstagePublicState = {
  phase: UpstagePhase;
  handNumber: number; // 1-based current hand
  totalHands: number;
  penalty: boolean;
  maxRank: number; // 12 or 13 depending on player count
  starSoloValue: number; // maxRank + 1
  order: string[]; // current ranking order, top (rank 1) first
  players: UpstagePlayerPublic[]; // keyed view, in seat order
  currentTurnPlayerId: string | null;
  leadPlayerId: string | null; // who holds the lead (fresh trick) or led the trick
  currentPlay: UpstagePlay | null; // null at a fresh lead
  drawnCards: Record<string, UpstageCard> | null; // draw phase reveal (hand 1)
  declarePlayerId: string | null; // who may declare (holds both stars)
  pendingTaxReceivers: string[]; // receivers who still owe a taxReturn
  lastHandRanking: string[] | null; // previous hand finishing order (display)
  endVote: UpstageEndVote | null;
};

export type UpstagePrivateState = {
  hand: UpstageCard[]; // my cards, sorted strongest-first
  holdsBothStars: boolean;
};

// --- action payloads (carried on { type: "game:action"; action: GameAction }) ---

export type UpstageConfigurePayload = {
  penalty: boolean;
  totalHands: number; // clamped to [UPSTAGE_HANDS_MIN, UPSTAGE_HANDS_MAX]
};

export type UpstagePlayPayload = { cards: string[] }; // card ids
export type UpstageTaxReturnPayload = { cards: string[] }; // card ids to give back
export type UpstageDeclarePayload = { revolt: boolean };
export type UpstageVoteEndPayload = { agree: boolean };

export const UPSTAGE_ACTIONS = {
  configure: "upstage:configure",
  startHand: "upstage:startHand", // host: leave draw reveal, deal & begin hand 1
  declare: "upstage:declare",
  taxReturn: "upstage:taxReturn",
  play: "upstage:play",
  pass: "upstage:pass",
  nextHand: "upstage:nextHand", // host: handEnd -> deal next hand
  proposeEnd: "upstage:proposeEnd", // host: open an early-end vote
  voteEnd: "upstage:voteEnd",
} as const;

// Deck shape helpers (shared so client can render the same expectations).
export const upstageMaxRank = (playerCount: number): number => (playerCount >= 9 ? 13 : 12);

// Strength of a card for sorting/comparison: lower is stronger. A star is the
// weakest possible (maxRank + 1) when judged alone or for "best card" picks.
export const upstageCardStrength = (card: UpstageCard, maxRank: number): number =>
  card.value === "star" ? maxRank + 1 : card.value;
