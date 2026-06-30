import type {
  ErrorCode,
  GameResult,
  PublicPlayerState,
  UpstageCard,
  UpstagePhase,
  UpstagePlay,
  UpstagePlayerPublic,
  UpstagePrivateState,
  UpstagePublicState,
} from "@oneshot/shared";
import { upstageCardStrength, upstageMaxRank, UPSTAGE_HANDS_MAX, UPSTAGE_HANDS_MIN } from "@oneshot/shared";
import { Randomizer } from "../../core/Randomizer";
import type { ActionResult } from "../GameModule";

const ok = (): ActionResult => ({ ok: true });
const fail = (code: ErrorCode, message: string): ActionResult => ({ ok: false, code, message });

// Sort a hand strongest-first (lowest value), stars last.
const sortHand = (cards: UpstageCard[], maxRank: number): UpstageCard[] =>
  [...cards].sort((a, b) => upstageCardStrength(a, maxRank) - upstageCardStrength(b, maxRank));

// Upstage rules engine. Authoritative; secrets (hands, star ownership) leave only
// through getStateFor(). All randomness flows through the injected seed.
export class UpstageCore {
  private players: PublicPlayerState[] = [];
  private randomizer = new Randomizer("upstage");
  private minPlayers = 3;

  private phase: UpstagePhase = "setup";
  private penalty = false;
  private totalHands = 5;
  private handNumber = 0;
  private maxRank = 12;

  private hands = new Map<string, UpstageCard[]>();
  private order: string[] = []; // current ranking order, top first
  private cumulative = new Map<string, number>();

  private drawnCards: Map<string, UpstageCard> | null = null;

  // play state
  private currentTurnId: string | null = null;
  private leadId: string | null = null;
  private currentPlay: UpstagePlay | null = null;
  private passed = new Set<string>();
  private finished: string[] = []; // finishing order this hand
  private lastHandRanking: string[] | null = null;

  // declare / tax
  private declarePlayerId: string | null = null;
  private taxReturnCount = new Map<string, number>(); // receiver -> cards still to return
  // Snapshot of the giver↔receiver pairs taken at beginTax. We must NOT recompute
  // these from `this.order` later: a mid-tax removal mutates `order` and would
  // corrupt the mapping (orphaning a receiver's debt and hanging the hand).
  private taxPairsSnapshot: Array<{ giver: string; receiver: string; count: number }> = [];

  // Temporarily disconnected (reconnectable) players. They stay seated but cannot
  // vote, so the early-end vote is resolved against the CONNECTED base only.
  private disconnected = new Set<string>();

  // early end
  private endVote: { proposedBy: string; votes: Map<string, boolean> } | null = null;

  private result: GameResult | null = null;

  start(input: { players: PublicPlayerState[]; randomSeed: string }): void {
    if (input.players.length < this.minPlayers) {
      throw new Error(`Upstage requires at least ${this.minPlayers} players`);
    }
    this.players = [...input.players].sort((l, r) => l.seatIndex - r.seatIndex);
    this.randomizer = new Randomizer(input.randomSeed);
    this.maxRank = upstageMaxRank(this.players.length);
    this.phase = "setup";
    this.penalty = false;
    this.totalHands = 5;
    this.handNumber = 0;
    this.hands.clear();
    this.order = this.players.map((p) => p.id);
    this.cumulative = new Map(this.players.map((p) => [p.id, 0]));
    this.drawnCards = null;
    this.resetPlayState();
    this.declarePlayerId = null;
    this.taxReturnCount.clear();
    this.taxPairsSnapshot = [];
    this.disconnected.clear();
    this.endVote = null;
    this.lastHandRanking = null;
    this.result = null;
  }

  // ---- host: configure (setup -> draw) ----
  configure(isHost: boolean, payload: unknown): ActionResult {
    if (this.phase !== "setup") return fail("INVALID_ACTION", "이미 게임이 시작됐습니다.");
    if (!isHost) return fail("HOST_ONLY", "방장만 게임을 설정할 수 있습니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "설정이 올바르지 않습니다.");
    const record = payload as { penalty?: unknown; totalHands?: unknown };
    if (typeof record.penalty !== "boolean") return fail("INVALID_ACTION", "페널티 설정이 올바르지 않습니다.");
    if (typeof record.totalHands !== "number" || !Number.isInteger(record.totalHands)) {
      return fail("INVALID_ACTION", "판 수가 올바르지 않습니다.");
    }
    this.penalty = record.penalty;
    this.totalHands = Math.min(UPSTAGE_HANDS_MAX, Math.max(UPSTAGE_HANDS_MIN, record.totalHands));
    this.runDraw();
    return ok();
  }

  // ---- host: leave the draw reveal and begin hand 1 ----
  startHand(isHost: boolean): ActionResult {
    if (this.phase !== "draw") return fail("INVALID_ACTION", "지금은 시작할 수 없습니다.");
    if (!isHost) return fail("HOST_ONLY", "방장만 시작할 수 있습니다.");
    this.beginHand();
    return ok();
  }

  // ---- host: handEnd -> next hand ----
  nextHand(isHost: boolean): ActionResult {
    if (this.phase !== "handEnd") return fail("INVALID_ACTION", "지금은 다음 판으로 넘어갈 수 없습니다.");
    if (!isHost) return fail("HOST_ONLY", "방장만 다음 판을 시작할 수 있습니다.");
    if (this.handNumber >= this.totalHands) {
      this.finish("모든 판이 끝났어요.");
      return ok();
    }
    this.beginHand();
    return ok();
  }

  // ---- star-pair holder: declare a revolt (or not) ----
  declare(playerId: string, payload: unknown): ActionResult {
    if (this.phase !== "declare") return fail("INVALID_ACTION", "지금은 선언할 수 없습니다.");
    if (playerId !== this.declarePlayerId) return fail("INVALID_ACTION", "선언 권한이 없습니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "선언이 올바르지 않습니다.");
    const revolt = (payload as { revolt?: unknown }).revolt;
    if (typeof revolt !== "boolean") return fail("INVALID_ACTION", "선언이 올바르지 않습니다.");

    if (revolt) {
      // Greater revolt: the biggest penalty-payer (lowest rank) flips the order.
      if (playerId === this.order[this.order.length - 1]) {
        this.order = [...this.order].reverse();
      }
      this.declarePlayerId = null;
      this.beginPlay(); // revolt skips the tax exchange entirely
    } else {
      this.declarePlayerId = null;
      this.beginTax();
    }
    return ok();
  }

  // ---- tax receiver: choose cards to return ----
  taxReturn(playerId: string, payload: unknown): ActionResult {
    if (this.phase !== "tax") return fail("INVALID_ACTION", "지금은 카드를 돌려줄 수 없습니다.");
    const owed = this.taxReturnCount.get(playerId);
    if (owed == null) return fail("INVALID_ACTION", "돌려줄 카드가 없습니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "선택이 올바르지 않습니다.");
    const ids = (payload as { cards?: unknown }).cards;
    if (!Array.isArray(ids) || ids.length !== owed || !ids.every((id) => typeof id === "string")) {
      return fail("INVALID_ACTION", `정확히 ${owed}장을 골라야 합니다.`);
    }
    const hand = this.hands.get(playerId) ?? [];
    const chosen: UpstageCard[] = [];
    for (const id of ids as string[]) {
      const card = hand.find((c) => c.id === id && !chosen.includes(c));
      if (!card) return fail("INVALID_ACTION", "보유하지 않은 카드입니다.");
      chosen.push(card);
    }
    // Move chosen cards back to the matched giver.
    const giverId = this.taxGiverFor(playerId);
    if (!giverId) return fail("INVALID_ACTION", "상대를 찾을 수 없습니다.");
    this.hands.set(
      playerId,
      hand.filter((c) => !chosen.includes(c)),
    );
    this.hands.set(giverId, sortHand([...(this.hands.get(giverId) ?? []), ...chosen], this.maxRank));
    this.taxReturnCount.delete(playerId);
    this.settleTaxIfReady();
    return ok();
  }

  // ---- play a set ----
  play(playerId: string, payload: unknown): ActionResult {
    if (this.phase !== "play") return fail("INVALID_ACTION", "지금은 카드를 낼 수 없습니다.");
    if (playerId !== this.currentTurnId) return fail("NOT_YOUR_TURN", "당신의 차례가 아닙니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "낼 카드가 올바르지 않습니다.");
    const ids = (payload as { cards?: unknown }).cards;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
      return fail("INVALID_ACTION", "낼 카드를 골라주세요.");
    }
    const hand = this.hands.get(playerId) ?? [];
    const chosen: UpstageCard[] = [];
    for (const id of ids as string[]) {
      const card = hand.find((c) => c.id === id && !chosen.includes(c));
      if (!card) return fail("INVALID_ACTION", "보유하지 않은 카드입니다.");
      chosen.push(card);
    }
    const parsed = this.parseSet(chosen);
    if (!parsed.ok) return fail("INVALID_ACTION", parsed.message);

    if (this.currentPlay) {
      if (parsed.count !== this.currentPlay.count) {
        return fail("INVALID_ACTION", `${this.currentPlay.count}장을 내야 합니다.`);
      }
      if (parsed.value >= this.currentPlay.value) {
        return fail("INVALID_ACTION", "더 낮은 숫자만 낼 수 있습니다.");
      }
    }

    // Commit the play.
    this.hands.set(
      playerId,
      hand.filter((c) => !chosen.includes(c)),
    );
    this.currentPlay = { playerId, cards: chosen, value: parsed.value, count: parsed.count };
    this.leadId = playerId;
    this.passed.clear();

    const empty = (this.hands.get(playerId) ?? []).length === 0;
    if (empty) {
      this.finished.push(playerId);
    }
    this.advanceAfterPlay(playerId);
    return ok();
  }

  // ---- pass ----
  pass(playerId: string): ActionResult {
    if (this.phase !== "play") return fail("INVALID_ACTION", "지금은 패스할 수 없습니다.");
    if (playerId !== this.currentTurnId) return fail("NOT_YOUR_TURN", "당신의 차례가 아닙니다.");
    if (!this.currentPlay) return fail("INVALID_ACTION", "리드는 패스할 수 없습니다.");
    this.passed.add(playerId);
    this.advanceTurn(playerId);
    return ok();
  }

  // ---- early-end vote ----
  proposeEnd(isHost: boolean, playerId: string): ActionResult {
    if (!isHost) return fail("HOST_ONLY", "방장만 종료를 발의할 수 있습니다.");
    if (this.phase === "setup" || this.phase === "ended") return fail("INVALID_ACTION", "지금은 발의할 수 없습니다.");
    if (this.endVote) return fail("INVALID_ACTION", "이미 투표가 진행 중입니다.");
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
  // Temporary disconnect (reconnectable). Hands persist; only the early-end vote
  // base changes, so re-resolve any open vote against the now-smaller connected set.
  onPlayerLeave(playerId: string): void {
    this.disconnected.add(playerId);
    if (this.endVote) this.resolveEndVote();
  }

  onPlayerReturn(playerId: string): void {
    this.disconnected.delete(playerId);
  }

  onPlayerRemoved(playerId: string): void {
    this.players = this.players.filter((p) => p.id !== playerId);
    this.hands.delete(playerId);
    this.cumulative.delete(playerId);
    this.taxReturnCount.delete(playerId);
    this.order = this.order.filter((id) => id !== playerId);
    this.finished = this.finished.filter((id) => id !== playerId);
    this.passed.delete(playerId);
    this.disconnected.delete(playerId);
    if (this.drawnCards) this.drawnCards.delete(playerId);

    // tax: a removed giver OR receiver dissolves their pending exchange so the
    // remaining receivers can still settle (otherwise the hand hangs in `tax`).
    if (this.phase === "tax") {
      for (const pair of this.taxPairsSnapshot) {
        if (pair.giver === playerId || pair.receiver === playerId) {
          this.taxReturnCount.delete(pair.receiver);
        }
      }
      this.taxPairsSnapshot = this.taxPairsSnapshot.filter(
        (p) => p.giver !== playerId && p.receiver !== playerId,
      );
    }

    if (this.declarePlayerId === playerId) {
      this.declarePlayerId = null;
      if (this.phase === "declare") this.penalty ? this.beginTax() : this.beginPlay();
    }
    if (this.endVote) {
      this.endVote.votes.delete(playerId);
      this.resolveEndVote();
    }

    if (this.phase === "play") {
      if (this.leadId === playerId) {
        // The standing lead/pile belonged to the removed player — dissolve the
        // trick (no ghost currentPlay/leadId) and let the next active seat lead.
        this.currentPlay = null;
        this.passed.clear();
        const next = this.nextActiveAfter(playerId);
        this.leadId = next;
        this.currentTurnId = next;
      } else if (this.currentTurnId === playerId) {
        this.advanceTurn(playerId);
      }
      this.checkHandOver();
    }

    this.settleTaxIfReady();
  }

  isOver(): GameResult | null {
    return this.result;
  }

  getPublicState(): UpstagePublicState {
    const players: UpstagePlayerPublic[] = this.players.map((p) => ({
      playerId: p.id,
      handCount: (this.hands.get(p.id) ?? []).length,
      rank: this.rankOf(p.id),
      cumulativeScore: this.cumulative.get(p.id) ?? 0,
      passed: this.passed.has(p.id),
    }));
    return {
      phase: this.phase,
      handNumber: this.handNumber,
      totalHands: this.totalHands,
      penalty: this.penalty,
      maxRank: this.maxRank,
      starSoloValue: this.maxRank + 1,
      order: [...this.order],
      players,
      currentTurnPlayerId: this.currentTurnId,
      leadPlayerId: this.leadId,
      currentPlay: this.currentPlay,
      drawnCards: this.drawnCards ? Object.fromEntries(this.drawnCards) : null,
      declarePlayerId: this.declarePlayerId,
      pendingTaxReceivers: [...this.taxReturnCount.keys()],
      lastHandRanking: this.lastHandRanking,
      endVote: this.endVote
        ? { proposedBy: this.endVote.proposedBy, votes: Object.fromEntries(this.endVote.votes) }
        : null,
    };
  }

  getStateFor(playerId: string): UpstagePrivateState {
    const hand = sortHand(this.hands.get(playerId) ?? [], this.maxRank);
    return {
      hand,
      holdsBothStars: hand.filter((c) => c.value === "star").length === 2,
    };
  }

  // ============================ internals ============================

  private resetPlayState(): void {
    this.currentTurnId = null;
    this.leadId = null;
    this.currentPlay = null;
    this.passed.clear();
    this.finished = [];
  }

  private buildDeck(): UpstageCard[] {
    const deck: UpstageCard[] = [];
    for (let value = 1; value <= this.maxRank; value += 1) {
      for (let i = 0; i < value; i += 1) deck.push({ id: `n${value}-${i}`, value });
    }
    deck.push({ id: "star-0", value: "star" });
    deck.push({ id: "star-1", value: "star" });
    return deck;
  }

  // Hand 1: each player flips one card; lower value (star worst) ranks higher.
  private runDraw(): void {
    const shuffled = this.randomizer.shuffle(this.buildDeck());
    const drawn = new Map<string, UpstageCard>();
    const rankKey = new Map<string, number>();
    this.players.forEach((p, index) => {
      const card = shuffled[index]!;
      drawn.set(p.id, card);
      // tie-break by shuffle position (already random) so equal values vary.
      rankKey.set(p.id, upstageCardStrength(card, this.maxRank) * 1000 + index);
    });
    this.drawnCards = drawn;
    this.order = [...this.players]
      .map((p) => p.id)
      .sort((a, b) => (rankKey.get(a) ?? 0) - (rankKey.get(b) ?? 0));
    this.phase = "draw";
  }

  // Deal a fresh hand to everyone (entire deck, top-of-order gets extras).
  private dealHand(): void {
    const deck = this.randomizer.shuffle(this.buildDeck());
    const fresh = new Map<string, UpstageCard[]>(this.order.map((id) => [id, []]));
    deck.forEach((card, index) => {
      const id = this.order[index % this.order.length]!;
      fresh.get(id)!.push(card);
    });
    this.hands = new Map([...fresh].map(([id, cards]) => [id, sortHand(cards, this.maxRank)]));
  }

  private beginHand(): void {
    this.handNumber += 1;
    this.resetPlayState();
    this.drawnCards = null;
    this.dealHand();
    // Declare window (penalty only): does one player hold both stars?
    if (this.penalty) {
      const holder = this.starPairHolder();
      if (holder) {
        this.declarePlayerId = holder;
        this.phase = "declare";
        return;
      }
      this.beginTax();
      return;
    }
    this.beginPlay();
  }

  private starPairHolder(): string | null {
    for (const [id, cards] of this.hands) {
      if (cards.filter((c) => c.value === "star").length === 2) return id;
    }
    return null;
  }

  // Exchange pairs by player count: 3-5 = 1 pair, 6+ = 2 pairs.
  private taxPairs(): Array<{ giver: string; receiver: string; count: number }> {
    const n = this.order.length;
    const pairs: Array<{ giver: string; receiver: string; count: number }> = [];
    pairs.push({ giver: this.order[n - 1]!, receiver: this.order[0]!, count: 2 });
    if (n >= 6) pairs.push({ giver: this.order[n - 2]!, receiver: this.order[1]!, count: 1 });
    return pairs;
  }

  private taxGiverFor(receiver: string): string | null {
    // Read the snapshot taken at beginTax — never recompute from `this.order`.
    return this.taxPairsSnapshot.find((p) => p.receiver === receiver)?.giver ?? null;
  }

  // Tax only leaves via this check, so every path that settles a receiver's debt
  // (a normal return OR a mid-tax removal) must funnel through here.
  private settleTaxIfReady(): void {
    if (this.phase === "tax" && this.taxReturnCount.size === 0) this.beginPlay();
  }

  private beginTax(): void {
    this.taxReturnCount.clear();
    this.taxPairsSnapshot = this.taxPairs();
    for (const { giver, receiver, count } of this.taxPairsSnapshot) {
      const giverHand = sortHand(this.hands.get(giver) ?? [], this.maxRank);
      const best = giverHand.slice(0, count); // strongest cards
      this.hands.set(
        giver,
        giverHand.filter((c) => !best.includes(c)),
      );
      this.hands.set(receiver, sortHand([...(this.hands.get(receiver) ?? []), ...best], this.maxRank));
      this.taxReturnCount.set(receiver, count);
    }
    this.phase = "tax";
  }

  private beginPlay(): void {
    this.phase = "play";
    this.currentPlay = null;
    this.passed.clear();
    this.finished = [];
    this.leadId = this.order[0]!;
    this.currentTurnId = this.order[0]!;
  }

  // Players still holding cards, in seating/turn order (== this.order).
  private activeIds(): string[] {
    return this.order.filter((id) => (this.hands.get(id) ?? []).length > 0);
  }

  private nextActiveAfter(playerId: string): string | null {
    const active = this.activeIds();
    if (active.length === 0) return null;
    const idx = this.order.indexOf(playerId);
    for (let step = 1; step <= this.order.length; step += 1) {
      const cand = this.order[(idx + step) % this.order.length]!;
      if (active.includes(cand)) return cand;
    }
    return active[0] ?? null;
  }

  // After a play: if it emptied someone or beat everyone, resolve; else next turn.
  private advanceAfterPlay(playerId: string): void {
    if (this.checkHandOver()) return;
    this.advanceTurn(playerId);
  }

  private advanceTurn(fromId: string): void {
    // Trick ends when every other active player has passed since the last play.
    const active = this.activeIds();
    const leaderStillIn = active.includes(this.leadId ?? "");
    const others = active.filter((id) => id !== this.leadId);
    const allPassed = others.length > 0 && others.every((id) => this.passed.has(id));
    if (this.currentPlay && allPassed) {
      // Trick won by the leader (or, if they went out, the next active player).
      this.currentPlay = null;
      this.passed.clear();
      if (this.checkHandOver()) return;
      this.currentTurnId = leaderStillIn ? this.leadId : this.nextActiveAfter(this.leadId!);
      this.leadId = this.currentTurnId;
      return;
    }
    const next = this.nextActiveAfter(fromId);
    this.currentTurnId = next;
    if (next == null) this.checkHandOver();
  }

  // Returns true if the hand is now over (and transitions to handEnd).
  private checkHandOver(): boolean {
    const active = this.activeIds();
    if (active.length > 1) return false;
    // last remaining player finishes last
    for (const id of this.order) {
      if (!this.finished.includes(id)) this.finished.push(id);
    }
    // award per-hand ranks (1-based) into cumulative
    this.finished.forEach((id, index) => {
      this.cumulative.set(id, (this.cumulative.get(id) ?? 0) + index + 1);
    });
    this.lastHandRanking = [...this.finished];
    this.order = [...this.finished]; // reseat by finishing order for next hand
    this.currentTurnId = null;
    this.currentPlay = null;
    this.phase = "handEnd";
    return true;
  }

  private rankOf(playerId: string): number | null {
    const idx = this.finished.indexOf(playerId);
    if (idx < 0) return null;
    // ranks only meaningful once the hand ended; during play show provisional out-order
    return idx + 1;
  }

  private parseSet(cards: UpstageCard[]): { ok: true; value: number; count: number } | { ok: false; message: string } {
    const numbers = cards.filter((c) => c.value !== "star").map((c) => c.value as number);
    const stars = cards.length - numbers.length;
    if (numbers.length === 0) {
      // all stars: counts as a set of (maxRank + 1)
      return { ok: true, value: this.maxRank + 1, count: cards.length };
    }
    const value = numbers[0]!;
    if (!numbers.every((v) => v === value)) {
      return { ok: false, message: "같은 숫자만 함께 낼 수 있습니다." };
    }
    // stars adopt the number; effective value stays `value`, count is total
    void stars;
    return { ok: true, value, count: cards.length };
  }

  private resolveEndVote(): void {
    if (!this.endVote) return;
    // Base = CONNECTED players only (spec §7). Disconnected players can't vote,
    // so counting them would let a single dropout deadlock the vote forever.
    const connected = this.players.filter((p) => !this.disconnected.has(p.id));
    const total = connected.length;
    if (total === 0) {
      this.endVote = null;
      return;
    }
    const cast = [...this.endVote.votes.entries()].filter(([id]) =>
      connected.some((p) => p.id === id),
    );
    const agrees = cast.filter(([, v]) => v).length;
    const rejects = cast.filter(([, v]) => !v).length;
    if (agrees * 2 > total) {
      this.endVote = null;
      this.finish("투표로 게임을 종료했어요.");
      return;
    }
    // Can no longer pass even if all remaining connected players vote yes? -> fail.
    const undecided = total - cast.length;
    if ((agrees + undecided) * 2 <= total || rejects * 2 >= total) {
      this.endVote = null;
    }
  }

  private finish(summary: string): void {
    const ranking = this.players
      .map((p) => ({ playerId: p.id, score: this.cumulative.get(p.id) ?? 0 }))
      .sort((a, b) => a.score - b.score)
      .map((entry, index) => ({ playerId: entry.playerId, rank: index + 1, scoreDelta: entry.score }));
    const best = ranking.length > 0 ? ranking[0]!.scoreDelta : 0;
    const winners = ranking.filter((r) => r.scoreDelta === best).map((r) => r.playerId);
    this.result = { ranking, winnerPlayerIds: winners, summary };
    this.phase = "ended";
    this.endVote = null;
  }
}
