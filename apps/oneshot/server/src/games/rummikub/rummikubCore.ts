import type {
  BoardMeld,
  ErrorCode,
  GameResult,
  PublicPlayerState,
  RummikubDeckCount,
  RummikubLastEvent,
  RummikubPhase,
  RummikubPrivateState,
  RummikubPublicPlayer,
  RummikubPublicState,
  Tile,
  TurnSeconds,
} from "@oneshot/shared";
import {
  END_VOTE_COOLDOWN_MS,
  RUMMIKUB_DEFAULT_TURN_SECONDS,
  RUMMIKUB_INITIAL_MELD_MIN,
  RUMMIKUB_START_HAND,
  RUMMIKUB_TURN_SECONDS,
  buildRummikubDeck,
  handSum,
  isValidMeld,
  meldValue,
  rummikubDeckCount,
} from "@oneshot/shared";
import { Randomizer } from "../../core/Randomizer";
import type { ActionResult } from "../GameModule";

const ok = (): ActionResult => ({ ok: true });
const fail = (code: ErrorCode, message: string): ActionResult => ({ ok: false, code, message });

// Stable sort key for a player's hand: numbers by (color, num), jokers last.
const COLOR_ORDER = ["red", "blue", "orange", "black"];
const sortHand = (tiles: Tile[]): Tile[] =>
  [...tiles].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "joker" ? 1 : -1; // jokers last
    if (a.kind === "num" && b.kind === "num") {
      if (a.color !== b.color) return COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color);
      return a.num - b.num;
    }
    return a.id.localeCompare(b.id);
  });

// Canonical key of a meld = its sorted tile-id set (grouping identity).
const meldKey = (tileIds: string[]): string => [...tileIds].sort().join(",");

// RUMMIKUB rules engine. Server-authoritative. Hands leave only via
// getStateFor(); the board is public. All randomness flows through the seed.
//
// The heart is commit(): the client stages board edits locally and sends the
// WHOLE proposed board (tile ids). The server re-derives everything —
// conservation, meld validity, hand shrink, initial-meld >= 30 — so board
// rearrangement and joker retrieval need no special handling.
export class RummikubCore {
  private players: PublicPlayerState[] = [];
  private randomizer = new Randomizer("rummikub");
  readonly minPlayers = 2;

  private phase: RummikubPhase = "setup";
  private turnSeconds: TurnSeconds = RUMMIKUB_DEFAULT_TURN_SECONDS;
  private deckCount: RummikubDeckCount = 1;

  private hands = new Map<string, Tile[]>();
  private pool: Tile[] = [];
  private board: BoardMeld[] = [];
  private didInitial = new Map<string, boolean>();
  private meldSeq = 0;

  private order: string[] = [];
  private currentTurnId: string | null = null;
  private turnNumber = 0;
  private turnDeadline: number | null = null;
  private passStreak = 0;
  private lastEvent: RummikubLastEvent | null = null;
  private eventSeq = 0;

  private disconnected = new Set<string>();
  private endVote: { proposedBy: string; votes: Map<string, boolean> } | null = null;
  private voteCooldownUntil = 0;
  private result: GameResult | null = null;

  start(input: { players: PublicPlayerState[]; randomSeed: string }): void {
    if (input.players.length < this.minPlayers) {
      throw new Error(`Rummikub requires at least ${this.minPlayers} players`);
    }
    this.players = [...input.players].sort((l, r) => l.seatIndex - r.seatIndex);
    this.randomizer = new Randomizer(input.randomSeed);
    this.phase = "setup";
    this.turnSeconds = RUMMIKUB_DEFAULT_TURN_SECONDS;
    this.deckCount = 1;
    this.hands.clear();
    this.pool = [];
    this.board = [];
    this.didInitial = new Map(this.players.map((p) => [p.id, false]));
    this.meldSeq = 0;
    this.order = this.players.map((p) => p.id);
    this.currentTurnId = null;
    this.turnNumber = 0;
    this.turnDeadline = null;
    this.passStreak = 0;
    this.lastEvent = null;
    this.eventSeq = 0;
    this.disconnected.clear();
    this.endVote = null;
    this.voteCooldownUntil = 0;
    this.result = null;
  }

  // ---- host: configure (setup -> deal -> play) ----
  configure(isHost: boolean, payload: unknown): ActionResult {
    if (this.phase !== "setup") return fail("INVALID_ACTION", "이미 게임이 시작됐습니다.");
    if (!isHost) return fail("HOST_ONLY", "방장만 게임을 설정할 수 있습니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "설정이 올바르지 않습니다.");
    const raw = (payload as { turnSeconds?: unknown }).turnSeconds;
    if (typeof raw !== "number" || !RUMMIKUB_TURN_SECONDS.includes(raw as TurnSeconds)) {
      return fail("INVALID_ACTION", "제한 시간이 올바르지 않습니다.");
    }
    this.turnSeconds = raw as TurnSeconds;
    this.deal();
    return ok();
  }

  private deal(): void {
    this.deckCount = rummikubDeckCount(this.order.length);
    const deck = this.randomizer.shuffle(buildRummikubDeck(this.deckCount));
    let idx = 0;
    this.hands = new Map();
    for (const id of this.order) {
      this.hands.set(id, sortHand(deck.slice(idx, idx + RUMMIKUB_START_HAND)));
      idx += RUMMIKUB_START_HAND;
    }
    this.pool = deck.slice(idx);
    this.board = [];
    this.didInitial = new Map(this.order.map((id) => [id, false]));
    this.passStreak = 0;
    this.phase = "play";
    this.turnNumber = 1;
    this.currentTurnId = this.order[0] ?? null;
    this.resetDeadline();
  }

  private resetDeadline(): void {
    this.turnDeadline = this.turnSeconds === 0 ? null : Date.now() + this.turnSeconds * 1000;
  }

  private bumpEvent(kind: RummikubLastEvent["kind"], playerId: string, meldIds?: string[]): void {
    this.eventSeq += 1;
    this.lastEvent = { kind, playerId, meldIds, seq: this.eventSeq };
  }

  // ---- current player: commit a proposed board ----
  commit(playerId: string, payload: unknown): ActionResult {
    if (this.phase !== "play") return fail("INVALID_ACTION", "지금은 낼 수 없습니다.");
    if (playerId !== this.currentTurnId) return fail("NOT_YOUR_TURN", "당신의 차례가 아닙니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "제출이 올바르지 않습니다.");

    const rawBoard = (payload as { board?: unknown }).board;
    if (!Array.isArray(rawBoard)) return fail("INVALID_ACTION", "보드가 올바르지 않습니다.");

    // Parse into id-lists; reject malformed shapes.
    const proposed: string[][] = [];
    for (const m of rawBoard) {
      if (typeof m !== "object" || m === null) return fail("INVALID_ACTION", "보드가 올바르지 않습니다.");
      const tiles = (m as { tiles?: unknown }).tiles;
      if (!Array.isArray(tiles) || !tiles.every((t) => typeof t === "string")) {
        return fail("INVALID_ACTION", "보드가 올바르지 않습니다.");
      }
      if (tiles.length > 0) proposed.push(tiles as string[]);
    }

    // Authoritative face lookup: only my board + my hand are legal sources.
    const boardTiles = new Map<string, Tile>();
    for (const m of this.board) for (const t of m.tiles) boardTiles.set(t.id, t);
    const hand = this.hands.get(playerId) ?? [];
    const handTiles = new Map<string, Tile>(hand.map((t) => [t.id, t]));

    const proposedIds = proposed.flat();
    // No tile placed twice.
    if (new Set(proposedIds).size !== proposedIds.length) {
      return fail("INVALID_ACTION", "같은 타일을 두 번 놓을 수 없습니다.");
    }
    // Every proposed tile must come from the board or my hand (no forging/stealing).
    for (const id of proposedIds) {
      if (!boardTiles.has(id) && !handTiles.has(id)) {
        return fail("INVALID_ACTION", "가지고 있지 않은 타일입니다.");
      }
    }
    const proposedSet = new Set(proposedIds);
    // Board tiles cannot be taken back into a hand: old board ⊆ proposed.
    for (const id of boardTiles.keys()) {
      if (!proposedSet.has(id)) return fail("INVALID_ACTION", "보드의 타일을 다시 가져올 수 없습니다.");
    }
    // played = proposed − oldBoard ; must be non-empty and all from my hand.
    const played = proposedIds.filter((id) => !boardTiles.has(id));
    if (played.length === 0) return fail("INVALID_ACTION", "최소 한 장은 내야 합니다.");
    // (played ⊆ hand is guaranteed: proposed ⊆ board∪hand, and played ∉ board.)

    // Resolve every meld to authoritative faces and check validity.
    const resolve = (ids: string[]): Tile[] => ids.map((id) => boardTiles.get(id) ?? handTiles.get(id)!);
    const resolvedMelds = proposed.map(resolve);
    for (const tiles of resolvedMelds) {
      if (!isValidMeld(tiles)) return fail("INVALID_ACTION", "유효하지 않은 세트가 있습니다.");
    }

    const playedSet = new Set(played);
    // Initial meld rule: before your first meld you may not touch the board, and
    // your brand-new melds (hand-only) must total >= 30.
    if (!this.didInitial.get(playerId)) {
      const newMelds: Tile[][] = [];
      for (const ids of proposed) {
        const allNew = ids.every((id) => playedSet.has(id));
        const noneNew = ids.every((id) => !playedSet.has(id));
        if (!allNew && !noneNew) {
          return fail("INVALID_ACTION", "첫 등록에서는 이미 놓인 세트를 건드릴 수 없습니다.");
        }
        if (allNew) newMelds.push(resolve(ids));
      }
      // Untouched melds must exactly reproduce the existing board grouping.
      const untouchedKeys = proposed.filter((ids) => !ids.every((id) => playedSet.has(id))).map(meldKey).sort();
      const oldKeys = this.board.map((m) => meldKey(m.tiles.map((t) => t.id))).sort();
      if (untouchedKeys.length !== oldKeys.length || untouchedKeys.some((k, i) => k !== oldKeys[i])) {
        return fail("INVALID_ACTION", "첫 등록에서는 이미 놓인 세트를 건드릴 수 없습니다.");
      }
      const total = newMelds.reduce((s, tiles) => s + meldValue(tiles), 0);
      if (total < RUMMIKUB_INITIAL_MELD_MIN) {
        return fail("INVALID_ACTION", `첫 등록은 30점 이상이어야 합니다. (현재 ${total}점)`);
      }
    }

    // ---- commit ----
    this.hands.set(playerId, sortHand(hand.filter((t) => !playedSet.has(t.id))));
    this.didInitial.set(playerId, true);
    const gainedMeldIds: string[] = [];
    this.board = proposed.map((ids) => {
      const id = `m-${this.meldSeq++}`;
      if (ids.some((tid) => playedSet.has(tid))) gainedMeldIds.push(id);
      return { id, tiles: resolve(ids) };
    });
    this.passStreak = 0;
    this.bumpEvent("commit", playerId, gainedMeldIds);

    if ((this.hands.get(playerId) ?? []).length === 0) {
      this.finishByWinner(playerId);
      return ok();
    }
    this.advanceTurn();
    return ok();
  }

  // ---- current player: draw one and end turn ----
  draw(playerId: string): ActionResult {
    if (this.phase !== "play") return fail("INVALID_ACTION", "지금은 뽑을 수 없습니다.");
    if (playerId !== this.currentTurnId) return fail("NOT_YOUR_TURN", "당신의 차례가 아닙니다.");
    this.doDraw(playerId);
    return ok();
  }

  private doDraw(playerId: string): void {
    const tile = this.pool.pop();
    if (tile) {
      this.hands.set(playerId, sortHand([...(this.hands.get(playerId) ?? []), tile]));
      this.passStreak = 0;
      this.bumpEvent("draw", playerId);
    } else {
      // Pool empty -> this is a pass toward the stalemate end.
      this.passStreak += 1;
      this.bumpEvent("draw", playerId);
    }
    if (!this.checkStallOver()) this.advanceTurn();
  }

  // ---- any client: turn timed out ----
  timeout(payload: unknown): ActionResult {
    if (this.phase !== "play") return ok(); // idempotent no-op
    if (this.turnDeadline === null) return ok(); // unlimited: no timeouts
    const turnNumber = (payload as { turnNumber?: unknown })?.turnNumber;
    if (typeof turnNumber !== "number" || turnNumber !== this.turnNumber) return ok(); // stale
    if (Date.now() < this.turnDeadline) return ok(); // too early
    const current = this.currentTurnId;
    if (!current) return ok();
    this.bumpEvent("timeout", current);
    this.doDraw(current);
    return ok();
  }

  // ---- host: force-skip a disconnected current player (unlimited-mode safety) ----
  skipTurn(isHost: boolean): ActionResult {
    if (this.phase !== "play") return fail("INVALID_ACTION", "지금은 넘길 수 없습니다.");
    if (!isHost) return fail("HOST_ONLY", "방장만 넘길 수 있습니다.");
    const current = this.currentTurnId;
    if (!current) return fail("INVALID_ACTION", "현재 차례가 없습니다.");
    if (!this.disconnected.has(current)) return fail("INVALID_ACTION", "접속이 끊긴 플레이어만 넘길 수 있습니다.");
    this.bumpEvent("skip", current);
    this.doDraw(current);
    return ok();
  }

  // ---- early-end vote ----
  proposeEnd(playerId: string): ActionResult {
    if (!this.players.some((p) => p.id === playerId)) return fail("INVALID_ACTION", "참가자가 아닙니다.");
    if (this.phase === "setup" || this.phase === "ended") return fail("INVALID_ACTION", "지금은 발의할 수 없습니다.");
    if (this.endVote) return fail("INVALID_ACTION", "이미 투표가 진행 중입니다.");
    if (Date.now() < this.voteCooldownUntil) {
      const s = Math.ceil((this.voteCooldownUntil - Date.now()) / 1000);
      return fail("INVALID_ACTION", `부결된 지 얼마 안 됐어요. ${s}초 후 다시 발의할 수 있어요.`);
    }
    this.endVote = { proposedBy: playerId, votes: new Map([[playerId, true]]) };
    this.resolveEndVote();
    return ok();
  }

  voteEnd(playerId: string, payload: unknown): ActionResult {
    if (!this.endVote) return fail("INVALID_ACTION", "진행 중인 투표가 없습니다.");
    if (!this.players.some((p) => p.id === playerId)) return fail("INVALID_ACTION", "참가자가 아닙니다.");
    const agree = (payload as { agree?: unknown })?.agree;
    if (typeof agree !== "boolean") return fail("INVALID_ACTION", "투표가 올바르지 않습니다.");
    this.endVote.votes.set(playerId, agree);
    this.resolveEndVote();
    return ok();
  }

  // ---- lifecycle hooks ----
  onPlayerLeave(playerId: string): void {
    this.disconnected.add(playerId);
    if (this.endVote) this.resolveEndVote();
  }

  onPlayerReturn(playerId: string): void {
    this.disconnected.delete(playerId);
  }

  onPlayerRemoved(playerId: string): void {
    const wasCurrent = this.currentTurnId === playerId;
    const replacement = wasCurrent ? this.nextAfter(playerId) : null;

    // Return the kicked player's tiles to the pool (keeps conservation/scoring sane).
    const theirHand = this.hands.get(playerId) ?? [];
    if (theirHand.length > 0) this.pool = this.randomizer.shuffle([...this.pool, ...theirHand]);
    this.hands.delete(playerId);
    this.didInitial.delete(playerId);
    this.players = this.players.filter((p) => p.id !== playerId);
    this.order = this.order.filter((id) => id !== playerId);
    this.disconnected.delete(playerId);
    if (this.endVote) {
      this.endVote.votes.delete(playerId);
      this.resolveEndVote();
    }

    if (this.phase === "play") {
      if (wasCurrent) {
        this.currentTurnId = replacement && replacement !== playerId ? replacement : (this.order[0] ?? null);
        this.turnNumber += 1;
        this.passStreak = 0;
        this.resetDeadline();
      }
      this.checkLastOneStanding();
    }
  }

  isOver(): GameResult | null {
    return this.result;
  }

  getPublicState(): RummikubPublicState {
    const players: RummikubPublicPlayer[] = this.players.map((p) => ({
      playerId: p.id,
      handCount: (this.hands.get(p.id) ?? []).length,
      hasDoneInitialMeld: this.didInitial.get(p.id) ?? false,
      connected: !this.disconnected.has(p.id),
    }));
    return {
      phase: this.phase,
      turnSeconds: this.turnSeconds,
      deckCount: this.deckCount,
      board: this.board.map((m) => ({ id: m.id, tiles: [...m.tiles] })),
      poolCount: this.pool.length,
      order: [...this.order],
      players,
      currentTurnPlayerId: this.currentTurnId,
      turnNumber: this.turnNumber,
      turnDeadline: this.turnDeadline,
      lastEvent: this.lastEvent,
      endVote: this.endVote
        ? { proposedBy: this.endVote.proposedBy, votes: Object.fromEntries(this.endVote.votes) }
        : null,
      endVoteCooldownUntil: this.voteCooldownUntil > Date.now() ? this.voteCooldownUntil : null,
    };
  }

  getStateFor(playerId: string): RummikubPrivateState {
    return {
      hand: sortHand(this.hands.get(playerId) ?? []),
      hasDoneInitialMeld: this.didInitial.get(playerId) ?? false,
    };
  }

  // ============================ internals ============================

  private advanceTurn(): void {
    const next = this.currentTurnId ? this.nextAfter(this.currentTurnId) : (this.order[0] ?? null);
    this.currentTurnId = next;
    this.turnNumber += 1;
    this.resetDeadline();
  }

  private nextAfter(from: string): string | null {
    const n = this.order.length;
    if (n === 0) return null;
    let idx = this.order.indexOf(from);
    if (idx < 0) idx = -1;
    return this.order[(idx + 1 + n) % n] ?? null;
  }

  // Stalemate: pool empty and everyone passed once around -> lowest hand wins.
  private checkStallOver(): boolean {
    if (this.phase !== "play") return true;
    if (this.pool.length === 0 && this.passStreak >= this.order.length && this.order.length > 0) {
      this.finishByLowest();
      return true;
    }
    return false;
  }

  // Kick can leave a single player -> they win.
  private checkLastOneStanding(): void {
    if (this.phase !== "play") return;
    if (this.order.length <= 1) {
      const survivor = this.order[0] ?? null;
      if (survivor) this.finishByWinner(survivor);
    }
  }

  private finishByWinner(winnerId: string): void {
    const others = this.order.filter((id) => id !== winnerId);
    const othersSum = others.reduce((s, id) => s + handSum(this.hands.get(id) ?? []), 0);
    const entries = this.order.map((id) => ({
      playerId: id,
      scoreDelta: id === winnerId ? othersSum : -handSum(this.hands.get(id) ?? []),
    }));
    this.finalize(entries, [winnerId], "손패를 모두 비웠어요!");
  }

  private finishByLowest(): void {
    const sums = new Map(this.order.map((id) => [id, handSum(this.hands.get(id) ?? [])]));
    const min = Math.min(...this.order.map((id) => sums.get(id) ?? 0));
    const winners = this.order.filter((id) => (sums.get(id) ?? 0) === min);
    const othersSumFor = (winner: string) =>
      this.order.filter((id) => id !== winner).reduce((s, id) => s + (sums.get(id) ?? 0), 0);
    const entries = this.order.map((id) => ({
      playerId: id,
      scoreDelta: winners.includes(id) ? othersSumFor(id) : -(sums.get(id) ?? 0),
    }));
    this.finalize(entries, winners, "더 이상 낼 수 없어 게임이 끝났어요. 남은 타일이 가장 적은 사람이 승리!");
  }

  private finalize(
    entries: Array<{ playerId: string; scoreDelta: number }>,
    winners: string[],
    summary: string,
    canceled = false,
  ): void {
    const ranking = [...entries]
      .sort((a, b) => b.scoreDelta - a.scoreDelta)
      .map((entry, index) => ({ playerId: entry.playerId, rank: index + 1, scoreDelta: entry.scoreDelta }));
    this.result = { ranking, winnerPlayerIds: winners, summary, canceled };
    this.phase = "ended";
    this.currentTurnId = null;
    this.turnDeadline = null;
    this.endVote = null;
  }

  private resolveEndVote(): void {
    if (!this.endVote) return;
    const connected = this.players.filter((p) => !this.disconnected.has(p.id));
    const total = connected.length;
    if (total === 0) {
      this.endVote = null;
      return;
    }
    const cast = [...this.endVote.votes.entries()].filter(([id]) => connected.some((p) => p.id === id));
    const agrees = cast.filter(([, v]) => v).length;
    const rejects = cast.filter(([, v]) => !v).length;
    if (agrees * 2 > total) {
      this.endVote = null;
      const entries = this.order.map((id) => ({ playerId: id, scoreDelta: 0 }));
      this.finalize(entries, [], "투표로 게임을 종료했어요.", true);
      return;
    }
    const undecided = total - cast.length;
    if ((agrees + undecided) * 2 <= total || rejects * 2 >= total) {
      this.endVote = null;
      this.voteCooldownUntil = Date.now() + END_VOTE_COOLDOWN_MS;
    }
  }

  // ----- test-only helpers (deterministic scenarios) -----
  /** @internal test-only */
  forTest_setHand(id: string, tiles: Tile[]): void {
    this.hands.set(id, sortHand(tiles));
  }
  /** @internal test-only */
  forTest_setBoard(melds: Tile[][]): void {
    this.board = melds.map((tiles) => ({ id: `m-${this.meldSeq++}`, tiles }));
  }
  /** @internal test-only */
  forTest_setPool(tiles: Tile[]): void {
    this.pool = tiles;
  }
  /** @internal test-only */
  forTest_setTurn(id: string): void {
    this.currentTurnId = id;
  }
  /** @internal test-only */
  forTest_setInitial(id: string, done: boolean): void {
    this.didInitial.set(id, done);
  }
  /** @internal test-only */
  forTest_phasePlay(): void {
    this.phase = "play";
  }
}
