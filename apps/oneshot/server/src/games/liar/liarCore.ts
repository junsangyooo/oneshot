import type {
  GameResult,
  LiarCard,
  LiarCategoryId,
  LiarPhase,
  LiarPrivateState,
  LiarPublicState,
  PublicPlayerState,
} from "@oneshot/shared";
import { LIAR_CATEGORIES, isLiarCategoryId, maxLiarsFor } from "@oneshot/shared";
import { Randomizer } from "../../core/Randomizer";
import { SecretDealer } from "../../core/SecretDealer";
import type { ActionResult } from "../GameModule";

// Decides the single card EVERY liar receives, given the chosen answer.
export type LiarCardStrategy = (input: {
  answerIndex: number;
  wordCount: number;
  randomizer: Randomizer;
}) => LiarCard;

// "liar" game: liars get a "라이어" card — they know they are the liar.
export const LIAR_KNOWS_STRATEGY: LiarCardStrategy = () => ({ kind: "liar" });

// "fool-liar" game: liars all get the SAME different word from the same category
// — they cannot tell themselves apart from a citizen (they don't know they lie).
export const FOOL_DECOY_STRATEGY: LiarCardStrategy = ({ answerIndex, wordCount, randomizer }) => {
  // Pick uniformly among the (wordCount - 1) indices that are NOT the answer.
  let index = randomizer.integer(0, wordCount - 2);
  if (index >= answerIndex) index += 1;
  return { kind: "word", wordIndex: index };
};

// Shared rules for both liar games. A module wires in its card strategy + the
// end-of-game summary line and delegates its GameModule methods here.
export class LiarCore {
  private players: PublicPlayerState[] = [];
  private randomizer = new Randomizer("liar");
  private phase: LiarPhase = "setup";
  private categoryId: LiarCategoryId | null = null;
  private liarCount = 0;
  private cards = new Map<string, LiarCard>();
  private result: GameResult | null = null;

  constructor(
    private readonly buildLiarCard: LiarCardStrategy,
    private readonly minPlayers: number,
    private readonly endSummary: string,
  ) {}

  start(input: { players: PublicPlayerState[]; randomSeed: string }): void {
    if (input.players.length < this.minPlayers) {
      throw new Error(`Liar game requires at least ${this.minPlayers} players`);
    }
    this.players = [...input.players].sort((left, right) => left.seatIndex - right.seatIndex);
    this.randomizer = new Randomizer(input.randomSeed);
    this.phase = "setup";
    this.categoryId = null;
    this.liarCount = 0;
    this.cards.clear();
    this.result = null;
  }

  configure(isHost: boolean, payload: unknown): ActionResult {
    if (this.phase !== "setup") {
      return { ok: false, code: "INVALID_ACTION", message: "이미 게임이 시작됐습니다." };
    }
    if (!isHost) {
      return { ok: false, code: "HOST_ONLY", message: "방장만 게임을 설정할 수 있습니다." };
    }
    const parsed = this.parseConfigure(payload);
    if (!parsed.ok) {
      return parsed;
    }
    this.categoryId = parsed.categoryId;
    this.liarCount = parsed.liarCount;
    this.deal();
    this.phase = "reveal";
    return { ok: true };
  }

  endGame(isHost: boolean): ActionResult {
    if (!isHost) {
      return { ok: false, code: "HOST_ONLY", message: "방장만 게임을 종료할 수 있습니다." };
    }
    // No scoring/winner — an empty ranking renders the clean end screen, then the
    // room returns to the lobby (answer & liars stay secret, as designed).
    this.result = { ranking: [], winnerPlayerIds: [], summary: this.endSummary };
    return { ok: true };
  }

  getPublicState(): LiarPublicState {
    return {
      phase: this.phase,
      categoryId: this.categoryId,
      liarCount: this.liarCount,
      maxLiars: maxLiarsFor(this.players.length),
      playerCount: this.players.length,
    };
  }

  getStateFor(playerId: string): LiarPrivateState {
    return {
      categoryId: this.categoryId,
      card: this.cards.get(playerId) ?? null,
    };
  }

  onPlayerRemoved(playerId: string): void {
    // A kick is permanent: drop the player and their secret card. Roles were
    // dealt once at configure time; we don't re-deal a running round.
    this.players = this.players.filter((player) => player.id !== playerId);
    this.cards.delete(playerId);
  }

  isOver(): GameResult | null {
    return this.result;
  }

  // --- internals ---

  private deal(): void {
    if (this.categoryId == null) {
      return;
    }
    const category = LIAR_CATEGORIES[this.categoryId];
    const answerIndex = this.randomizer.integer(0, category.length - 1);
    const liarCard = this.buildLiarCard({
      answerIndex,
      wordCount: category.length,
      randomizer: this.randomizer,
    });
    const citizenCard: LiarCard = { kind: "word", wordIndex: answerIndex };

    // liarCount liar cards + the rest citizen cards, then dealt fairly.
    const roles: LiarCard[] = [
      ...Array.from({ length: this.liarCount }, () => liarCard),
      ...Array.from({ length: this.players.length - this.liarCount }, () => citizenCard),
    ];

    const dealer = new SecretDealer(this.randomizer);
    this.cards.clear();
    for (const { playerId, secret } of dealer.assignOneEach(
      this.players.map((player) => player.id),
      roles,
    )) {
      this.cards.set(playerId, secret);
    }
  }

  private parseConfigure(
    payload: unknown,
  ):
    | { ok: true; categoryId: LiarCategoryId; liarCount: number }
    | { ok: false; code: "INVALID_ACTION"; message: string } {
    if (typeof payload !== "object" || payload === null) {
      return { ok: false, code: "INVALID_ACTION", message: "설정이 올바르지 않습니다." };
    }
    const record = payload as { categoryId?: unknown; liarCount?: unknown };

    if (!isLiarCategoryId(record.categoryId)) {
      return { ok: false, code: "INVALID_ACTION", message: "알 수 없는 카테고리입니다." };
    }

    const liarCount = record.liarCount;
    if (typeof liarCount !== "number" || !Number.isInteger(liarCount)) {
      return { ok: false, code: "INVALID_ACTION", message: "라이어 수가 올바르지 않습니다." };
    }
    const max = maxLiarsFor(this.players.length);
    if (liarCount < 1 || liarCount > max) {
      return {
        ok: false,
        code: "INVALID_ACTION",
        message: `라이어 수는 1명에서 ${max}명 사이여야 합니다.`,
      };
    }

    return { ok: true, categoryId: record.categoryId, liarCount };
  }
}
