import type {
  AlloutCard,
  AlloutColor,
  AlloutKind,
  AlloutPlayerPublic,
  AlloutPrivateState,
  AlloutPublicState,
  AlloutPhase,
  ErrorCode,
  GameResult,
  PublicPlayerState,
} from "@oneshot/shared";
import {
  ALLOUT_BANKRUPT_MAX,
  ALLOUT_BANKRUPT_MIN,
  ALLOUT_COLORS,
  ALLOUT_ROUNDS_DEFAULT,
  ALLOUT_ROUNDS_MAX,
  ALLOUT_ROUNDS_MIN,
  ALLOUT_BANKRUPT_DEFAULT,
  ALLOUT_START_HAND,
  alloutAttackAmount,
  alloutDeckCopies,
} from "@oneshot/shared";
import { Randomizer } from "../../core/Randomizer";
import type { ActionResult } from "../GameModule";

const ok = (): ActionResult => ({ ok: true });
const fail = (code: ErrorCode, message: string): ActionResult => ({ ok: false, code, message });

const COLORLESS: AlloutKind[] = ["plus4", "plus7", "exchange", "reflect", "wild"];
const isColorless = (kind: AlloutKind): boolean => COLORLESS.includes(kind);
const colorOf = (card: AlloutCard): AlloutColor | null =>
  "color" in card ? card.color : null;

// Sort key for stable hand display: number(by color,value) → plus2 → reverse →
// shield → plus4 → plus7 → exchange → reflect → wild.
const KIND_GROUP: Record<AlloutKind, number> = {
  number: 0,
  plus2: 1,
  reverse: 2,
  shield: 3,
  plus4: 4,
  plus7: 5,
  exchange: 6,
  reflect: 7,
  wild: 8,
};
const sortHand = (cards: AlloutCard[]): AlloutCard[] =>
  [...cards].sort((a, b) => {
    if (KIND_GROUP[a.kind] !== KIND_GROUP[b.kind]) return KIND_GROUP[a.kind] - KIND_GROUP[b.kind];
    const ca = colorOf(a);
    const cb = colorOf(b);
    if (ca && cb && ca !== cb) return ALLOUT_COLORS.indexOf(ca) - ALLOUT_COLORS.indexOf(cb);
    const va = a.kind === "number" ? a.value : 0;
    const vb = b.kind === "number" ? b.value : 0;
    return va - vb;
  });

type ParsedSet =
  | { ok: true; kind: AlloutKind; value: number | null; count: number; lastColor: AlloutColor | null }
  | { ok: false; message: string };

// ALL OUT rules engine. Authoritative; hands (and the just-drawn card) leave only
// through getStateFor(). All randomness flows through the injected seed.
export class AlloutCore {
  private players: PublicPlayerState[] = [];
  private randomizer = new Randomizer("allout");
  readonly minPlayers = 2;

  private phase: AlloutPhase = "setup";
  private totalRounds = ALLOUT_ROUNDS_DEFAULT;
  private bankruptcyOn = false;
  private bankruptcyLimit = ALLOUT_BANKRUPT_DEFAULT;
  private roundNumber = 0;
  private doubleDeck = false;

  private hands = new Map<string, AlloutCard[]>();
  private drawPile: AlloutCard[] = [];
  private discardPile: AlloutCard[] = []; // top = last element
  private activeColor: AlloutColor = "red";

  private order: string[] = []; // seat/turn order (reseated by finishing order each round)
  private direction: 1 | -1 = 1;
  private currentTurnId: string | null = null;
  private pendingAttack = 0;
  private attackFromId: string | null = null;
  private drawnPending: { playerId: string; cardId: string } | null = null;

  private finishedNormal: string[] = []; // emptied hand, chronological (best ranks)
  private bankruptOrder: string[] = []; // bankrupt, chronological (earlier = worse)
  private roundRank = new Map<string, number>();
  private cumulative = new Map<string, number>();
  private lastRoundRanking: string[] | null = null;

  private disconnected = new Set<string>();
  private endVote: { proposedBy: string; votes: Map<string, boolean> } | null = null;
  private result: GameResult | null = null;

  start(input: { players: PublicPlayerState[]; randomSeed: string }): void {
    if (input.players.length < this.minPlayers) {
      throw new Error(`ALL OUT requires at least ${this.minPlayers} players`);
    }
    this.players = [...input.players].sort((l, r) => l.seatIndex - r.seatIndex);
    this.randomizer = new Randomizer(input.randomSeed);
    this.doubleDeck = alloutDeckCopies(this.players.length) > 1;
    this.phase = "setup";
    this.totalRounds = ALLOUT_ROUNDS_DEFAULT;
    this.bankruptcyOn = false;
    this.bankruptcyLimit = ALLOUT_BANKRUPT_DEFAULT;
    this.roundNumber = 0;
    this.hands.clear();
    this.drawPile = [];
    this.discardPile = [];
    this.order = this.players.map((p) => p.id);
    this.direction = 1;
    this.currentTurnId = null;
    this.pendingAttack = 0;
    this.attackFromId = null;
    this.drawnPending = null;
    this.finishedNormal = [];
    this.bankruptOrder = [];
    this.roundRank.clear();
    this.cumulative = new Map(this.players.map((p) => [p.id, 0]));
    this.lastRoundRanking = null;
    this.disconnected.clear();
    this.endVote = null;
    this.result = null;
  }

  // ---- host: configure (setup -> play round 1) ----
  configure(isHost: boolean, payload: unknown): ActionResult {
    if (this.phase !== "setup") return fail("INVALID_ACTION", "이미 게임이 시작됐습니다.");
    if (!isHost) return fail("HOST_ONLY", "방장만 게임을 설정할 수 있습니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "설정이 올바르지 않습니다.");
    const rec = payload as { totalRounds?: unknown; bankruptcyOn?: unknown; bankruptcyLimit?: unknown };
    if (typeof rec.totalRounds !== "number" || !Number.isInteger(rec.totalRounds)) {
      return fail("INVALID_ACTION", "판 수가 올바르지 않습니다.");
    }
    if (typeof rec.bankruptcyOn !== "boolean") return fail("INVALID_ACTION", "파산 설정이 올바르지 않습니다.");
    if (typeof rec.bankruptcyLimit !== "number" || !Number.isInteger(rec.bankruptcyLimit)) {
      return fail("INVALID_ACTION", "파산 한도가 올바르지 않습니다.");
    }
    this.totalRounds = Math.min(ALLOUT_ROUNDS_MAX, Math.max(ALLOUT_ROUNDS_MIN, rec.totalRounds));
    this.bankruptcyOn = rec.bankruptcyOn;
    this.bankruptcyLimit = Math.min(ALLOUT_BANKRUPT_MAX, Math.max(ALLOUT_BANKRUPT_MIN, rec.bankruptcyLimit));
    this.beginRound();
    return ok();
  }

  // ---- play a set ----
  play(playerId: string, payload: unknown): ActionResult {
    if (this.phase !== "play") return fail("INVALID_ACTION", "지금은 카드를 낼 수 없습니다.");
    if (playerId !== this.currentTurnId) return fail("NOT_YOUR_TURN", "당신의 차례가 아닙니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "낼 카드가 올바르지 않습니다.");
    const rec = payload as { cards?: unknown; chosenColor?: unknown; exchangeTargetId?: unknown };
    const ids = rec.cards;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
      return fail("INVALID_ACTION", "낼 카드를 골라주세요.");
    }
    const hand = this.hands.get(playerId) ?? [];
    const chosen: AlloutCard[] = [];
    for (const id of ids as string[]) {
      const card = hand.find((c) => c.id === id && !chosen.includes(c));
      if (!card) return fail("INVALID_ACTION", "보유하지 않은 카드입니다.");
      chosen.push(card);
    }

    // After drawing, the play must include the just-drawn card.
    if (this.drawnPending?.playerId === playerId) {
      if (!chosen.some((c) => c.id === this.drawnPending!.cardId)) {
        return fail("INVALID_ACTION", "뽑은 카드를 포함해서 내야 합니다.");
      }
    }

    const parsed = this.parseSet(chosen);
    if (!parsed.ok) return fail("INVALID_ACTION", parsed.message);

    const kind = parsed.kind;
    const chosenColor = ALLOUT_COLORS.includes(rec.chosenColor as AlloutColor)
      ? (rec.chosenColor as AlloutColor)
      : null;
    if (isColorless(kind) && kind !== "reflect" && chosenColor === null) {
      return fail("INVALID_ACTION", "색을 골라야 합니다.");
    }
    if (kind === "reflect" && chosenColor === null) return fail("INVALID_ACTION", "색을 골라야 합니다.");

    const legal = this.checkLegal(parsed, chosen);
    if (!legal.ok) return fail("INVALID_ACTION", legal.message);

    // exchange target validation
    let target: string | null = null;
    if (kind === "exchange") {
      const tid = rec.exchangeTargetId;
      if (typeof tid !== "string" || tid === playerId || !this.players.some((p) => p.id === tid) || !this.isActive(tid)) {
        return fail("INVALID_ACTION", "교환할 상대를 골라야 합니다.");
      }
      target = tid;
    }

    // Commit: remove cards, update discard/active color.
    this.hands.set(
      playerId,
      hand.filter((c) => !chosen.includes(c)),
    );
    const last = chosen[chosen.length - 1]!;
    for (const c of chosen) this.discardPile.push(c);
    this.activeColor = parsed.lastColor ?? chosenColor ?? this.activeColor;

    this.applyEffect(playerId, parsed, target);

    if ((this.hands.get(playerId) ?? []).length === 0) this.markFinished(playerId, false);
    if (target) this.checkBankrupt(target);
    if (this.isActive(playerId)) this.checkBankrupt(playerId);
    this.drawnPending = null;

    this.advanceAfterEffect(playerId, parsed);
    this.checkRoundOver();
    return ok();
  }

  // ---- draw: take the attack pile (under attack) or draw one (normal) ----
  draw(playerId: string): ActionResult {
    if (this.phase !== "play") return fail("INVALID_ACTION", "지금은 뽑을 수 없습니다.");
    if (playerId !== this.currentTurnId) return fail("NOT_YOUR_TURN", "당신의 차례가 아닙니다.");
    if (this.drawnPending?.playerId === playerId) return fail("INVALID_ACTION", "이미 뽑았습니다. 내거나 패스하세요.");

    if (this.pendingAttack > 0) {
      const taken = this.drawFromPile(this.pendingAttack);
      this.hands.set(playerId, sortHand([...(this.hands.get(playerId) ?? []), ...taken]));
      this.pendingAttack = 0;
      this.attackFromId = null;
      this.checkBankrupt(playerId);
      if (this.isActive(playerId)) this.currentTurnId = this.nextActiveAfter(playerId, this.direction);
      else this.currentTurnId = this.nextActiveAfter(playerId, this.direction);
      this.checkRoundOver();
      return ok();
    }

    const [card] = this.drawFromPile(1);
    if (!card) {
      // No cards anywhere to draw — just pass the turn.
      this.currentTurnId = this.nextActiveAfter(playerId, this.direction);
      this.checkRoundOver();
      return ok();
    }
    this.hands.set(playerId, sortHand([...(this.hands.get(playerId) ?? []), card]));
    this.drawnPending = { playerId, cardId: card.id };
    this.checkBankrupt(playerId);
    if (!this.isActive(playerId)) {
      this.drawnPending = null;
      this.currentTurnId = this.nextActiveAfter(playerId, this.direction);
      this.checkRoundOver();
    }
    return ok();
  }

  // ---- pass: only after drawing (kept the drawn card) ----
  pass(playerId: string): ActionResult {
    if (this.phase !== "play") return fail("INVALID_ACTION", "지금은 패스할 수 없습니다.");
    if (playerId !== this.currentTurnId) return fail("NOT_YOUR_TURN", "당신의 차례가 아닙니다.");
    if (this.drawnPending?.playerId !== playerId) {
      return fail("INVALID_ACTION", "카드를 뽑은 뒤에만 패스할 수 있습니다.");
    }
    this.drawnPending = null;
    this.currentTurnId = this.nextActiveAfter(playerId, this.direction);
    this.checkRoundOver();
    return ok();
  }

  // ---- host: roundEnd -> next round ----
  nextRound(isHost: boolean): ActionResult {
    if (this.phase !== "roundEnd") return fail("INVALID_ACTION", "지금은 다음 라운드로 넘어갈 수 없습니다.");
    if (!isHost) return fail("HOST_ONLY", "방장만 다음 라운드를 시작할 수 있습니다.");
    if (this.roundNumber >= this.totalRounds) {
      this.finish("모든 라운드가 끝났어요.");
      return ok();
    }
    this.beginRound();
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
  onPlayerLeave(playerId: string): void {
    this.disconnected.add(playerId);
    if (this.endVote) this.resolveEndVote();
  }

  onPlayerReturn(playerId: string): void {
    this.disconnected.delete(playerId);
  }

  onPlayerRemoved(playerId: string): void {
    const wasCurrent = this.currentTurnId === playerId;
    const replacement = wasCurrent ? this.nextActiveAfter(playerId, this.direction) : null;

    this.players = this.players.filter((p) => p.id !== playerId);
    this.hands.delete(playerId);
    this.cumulative.delete(playerId);
    this.roundRank.delete(playerId);
    this.order = this.order.filter((id) => id !== playerId);
    this.finishedNormal = this.finishedNormal.filter((id) => id !== playerId);
    this.bankruptOrder = this.bankruptOrder.filter((id) => id !== playerId);
    this.disconnected.delete(playerId);
    if (this.attackFromId === playerId) this.attackFromId = null;
    if (this.drawnPending?.playerId === playerId) this.drawnPending = null;
    if (this.endVote) {
      this.endVote.votes.delete(playerId);
      this.resolveEndVote();
    }

    if (this.phase === "play") {
      if (wasCurrent) {
        // Hand the turn (and any pending attack) to the next active seat so the
        // game doesn't freeze waiting on a player who is gone.
        this.currentTurnId = replacement && replacement !== playerId ? replacement : this.nextActiveAfter2();
      }
      this.checkRoundOver();
    }
  }

  isOver(): GameResult | null {
    return this.result;
  }

  getPublicState(): AlloutPublicState {
    const players: AlloutPlayerPublic[] = this.players.map((p) => ({
      playerId: p.id,
      handCount: (this.hands.get(p.id) ?? []).length,
      rank: this.roundRank.get(p.id) ?? null,
      cumulativeScore: this.cumulative.get(p.id) ?? 0,
      finished: !this.isActive(p.id) && (this.phase === "play" || this.phase === "roundEnd"),
      bankrupt: this.bankruptOrder.includes(p.id),
    }));
    const top = this.discardPile.length > 0 && this.phase !== "setup"
      ? { card: this.discardPile[this.discardPile.length - 1]!, color: this.activeColor }
      : null;
    return {
      phase: this.phase,
      roundNumber: this.roundNumber,
      totalRounds: this.totalRounds,
      bankruptcyOn: this.bankruptcyOn,
      bankruptcyLimit: this.bankruptcyLimit,
      doubleDeck: this.doubleDeck,
      drawPileCount: this.drawPile.length,
      order: [...this.order],
      players,
      currentTurnPlayerId: this.currentTurnId,
      direction: this.direction,
      top,
      pendingAttack: this.pendingAttack,
      attackFromId: this.attackFromId,
      drawnPendingPlayerId: this.drawnPending?.playerId ?? null,
      lastRoundRanking: this.lastRoundRanking,
      endVote: this.endVote
        ? { proposedBy: this.endVote.proposedBy, votes: Object.fromEntries(this.endVote.votes) }
        : null,
    };
  }

  getStateFor(playerId: string): AlloutPrivateState {
    return {
      hand: sortHand(this.hands.get(playerId) ?? []),
      drawnCardId: this.drawnPending?.playerId === playerId ? this.drawnPending.cardId : null,
    };
  }

  // ============================ internals ============================

  private buildDeck(): AlloutCard[] {
    const copies = alloutDeckCopies(this.players.length);
    const deck: AlloutCard[] = [];
    for (let c = 0; c < copies; c += 1) {
      for (const color of ALLOUT_COLORS) {
        for (let v = 1; v <= 13; v += 1) deck.push({ id: `num-${color}-${v}-${c}`, kind: "number", color, value: v });
        for (let i = 0; i < 2; i += 1) deck.push({ id: `p2-${color}-${c}-${i}`, kind: "plus2", color });
        deck.push({ id: `rv-${color}-${c}`, kind: "reverse", color });
        deck.push({ id: `sh-${color}-${c}`, kind: "shield", color });
      }
      for (let i = 0; i < 4; i += 1) deck.push({ id: `p4-${c}-${i}`, kind: "plus4" });
      deck.push({ id: `p7-${c}`, kind: "plus7" });
      deck.push({ id: `xc-${c}`, kind: "exchange" });
      for (let i = 0; i < 2; i += 1) deck.push({ id: `rf-${c}-${i}`, kind: "reflect" });
      for (let i = 0; i < 4; i += 1) deck.push({ id: `wd-${c}-${i}`, kind: "wild" });
    }
    return deck;
  }

  private beginRound(): void {
    this.roundNumber += 1;
    this.finishedNormal = [];
    this.bankruptOrder = [];
    this.roundRank.clear();
    this.drawnPending = null;
    this.pendingAttack = 0;
    this.attackFromId = null;
    this.direction = 1;

    const deck = this.randomizer.shuffle(this.buildDeck());
    let idx = 0;
    this.hands = new Map();
    for (const id of this.order) {
      this.hands.set(id, sortHand(deck.slice(idx, idx + ALLOUT_START_HAND)));
      idx += ALLOUT_START_HAND;
    }
    const rest = deck.slice(idx);
    // Start card must be a plain number card (re-home specials to the bottom).
    const startIdx = rest.findIndex((c) => c.kind === "number");
    const start = startIdx >= 0 ? rest.splice(startIdx, 1)[0]! : rest.shift()!;
    this.drawPile = rest;
    this.discardPile = [start];
    this.activeColor = colorOf(start) ?? "red";
    this.currentTurnId = this.order[0]!;
    this.phase = "play";
  }

  private parseSet(cards: AlloutCard[]): ParsedSet {
    if (cards.length === 0) return { ok: false, message: "낼 카드를 골라주세요." };
    const kinds = new Set(cards.map((c) => c.kind));
    const last = cards[cards.length - 1]!;
    if (kinds.size === 1 && cards[0]!.kind === "number") {
      const value = (cards[0] as Extract<AlloutCard, { kind: "number" }>).value;
      if (!cards.every((c) => c.kind === "number" && c.value === value)) {
        return { ok: false, message: "같은 숫자만 함께 낼 수 있습니다." };
      }
      return { ok: true, kind: "number", value, count: cards.length, lastColor: colorOf(last) };
    }
    if (kinds.size > 1) {
      return { ok: false, message: "같은 숫자 또는 같은 기능 카드만 함께 낼 수 있습니다." };
    }
    const kind = cards[0]!.kind;
    return { ok: true, kind, value: null, count: cards.length, lastColor: colorOf(last) };
  }

  private topCard(): AlloutCard {
    return this.discardPile[this.discardPile.length - 1]!;
  }

  private checkLegal(
    parsed: Extract<ParsedSet, { ok: true }>,
    cards: AlloutCard[],
  ): { ok: true } | { ok: false; message: string } {
    const kind = parsed.kind;
    const top = this.topCard();
    const colorMatch = cards.some((c) => colorOf(c) === this.activeColor);

    if (this.pendingAttack > 0) {
      // Under attack: only attacks / shield / reflect may be played.
      if (kind === "plus4" || kind === "plus7" || kind === "reflect") return { ok: true };
      if (kind === "plus2") {
        if (top.kind === "plus2" || colorMatch) return { ok: true };
        return { ok: false, message: "같은 색이거나 +2 위에만 +2를 낼 수 있습니다." };
      }
      if (kind === "shield") {
        if (colorMatch) return { ok: true };
        return { ok: false, message: "현재 색과 같은 실드만 낼 수 있습니다." };
      }
      return { ok: false, message: "공격을 막거나 받아야 합니다." };
    }

    // Not under attack.
    if (kind === "plus4" || kind === "plus7" || kind === "exchange" || kind === "wild") return { ok: true };
    if (kind === "reflect") return { ok: false, message: "리플렉트는 공격받을 때만 낼 수 있습니다." };
    if (kind === "shield") return { ok: false, message: "실드는 공격받을 때만 낼 수 있습니다." };
    if (kind === "number") {
      const numMatch = top.kind === "number" && top.value === parsed.value;
      if (numMatch || colorMatch) return { ok: true };
      return { ok: false, message: "색이나 숫자가 맞아야 합니다." };
    }
    // plus2 / reverse as an opener
    if (top.kind === kind || colorMatch) return { ok: true };
    return { ok: false, message: "색이나 종류가 맞아야 합니다." };
  }

  private applyEffect(playerId: string, parsed: Extract<ParsedSet, { ok: true }>, target: string | null): void {
    switch (parsed.kind) {
      case "plus2":
      case "plus4":
      case "plus7":
        this.pendingAttack += alloutAttackAmount(parsed.kind) * parsed.count;
        this.attackFromId = playerId;
        break;
      case "shield":
        this.pendingAttack = 0;
        this.attackFromId = null;
        break;
      case "exchange":
        if (target) {
          const mine = this.hands.get(playerId) ?? [];
          const theirs = this.hands.get(target) ?? [];
          this.hands.set(playerId, sortHand(theirs));
          this.hands.set(target, sortHand(mine));
        }
        break;
      // number / reverse / reflect / wild: no pending-attack change here
      default:
        break;
    }
  }

  private advanceAfterEffect(playerId: string, parsed: Extract<ParsedSet, { ok: true }>): void {
    if (parsed.kind === "reflect") {
      // Bounce the whole stack back along a reversed order to the last attacker.
      this.direction = (this.direction * -1) as 1 | -1;
      const tgt = this.attackFromId && this.isActive(this.attackFromId)
        ? this.attackFromId
        : this.nextActiveAfter(playerId, this.direction);
      this.attackFromId = playerId;
      this.currentTurnId = tgt;
      return;
    }
    if (parsed.kind === "reverse") {
      if (parsed.count % 2 === 1) this.direction = (this.direction * -1) as 1 | -1;
      const selfAgain = parsed.count % 2 === 0 || this.activeCount() === 2;
      if (selfAgain && this.isActive(playerId)) {
        this.currentTurnId = playerId;
        return;
      }
      this.currentTurnId = this.nextActiveAfter(playerId, this.direction);
      return;
    }
    this.currentTurnId = this.nextActiveAfter(playerId, this.direction);
  }

  private drawFromPile(n: number): AlloutCard[] {
    const out: AlloutCard[] = [];
    for (let i = 0; i < n; i += 1) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length <= 1) break; // nothing to reshuffle
        const top = this.discardPile.pop()!;
        this.drawPile = this.randomizer.shuffle(this.discardPile);
        this.discardPile = [top];
      }
      const card = this.drawPile.pop();
      if (!card) break;
      out.push(card);
    }
    return out;
  }

  private markFinished(id: string, bankrupt: boolean): void {
    if (this.finishedNormal.includes(id) || this.bankruptOrder.includes(id)) return;
    if (bankrupt) this.bankruptOrder.push(id);
    else this.finishedNormal.push(id);
  }

  private checkBankrupt(id: string): void {
    if (!this.bankruptcyOn) return;
    if (!this.isActive(id)) return;
    if ((this.hands.get(id) ?? []).length >= this.bankruptcyLimit) this.markFinished(id, true);
  }

  private isActive(id: string): boolean {
    return !this.finishedNormal.includes(id) && !this.bankruptOrder.includes(id);
  }

  private activeCount(): number {
    return this.order.filter((id) => this.isActive(id)).length;
  }

  private nextActiveAfter(from: string, direction: 1 | -1): string | null {
    const n = this.order.length;
    if (n === 0) return null;
    let idx = this.order.indexOf(from);
    if (idx < 0) idx = 0;
    for (let step = 1; step <= n; step += 1) {
      const cand = this.order[(((idx + step * direction) % n) + n) % n]!;
      if (this.isActive(cand)) return cand;
    }
    return null;
  }

  // First active seat (fallback when the reference player is gone).
  private nextActiveAfter2(): string | null {
    return this.order.find((id) => this.isActive(id)) ?? null;
  }

  private checkRoundOver(): boolean {
    if (this.phase !== "play") return false;
    const active = this.order.filter((id) => this.isActive(id));
    if (active.length > 1) return false;

    const survivor = active[0] ?? null;
    const ranking = [...this.finishedNormal];
    if (survivor) ranking.push(survivor);
    for (const id of [...this.bankruptOrder].reverse()) ranking.push(id); // earliest bankrupt = worst
    for (const id of this.order) if (!ranking.includes(id)) ranking.push(id);

    this.roundRank.clear();
    ranking.forEach((id, i) => {
      this.roundRank.set(id, i + 1);
      this.cumulative.set(id, (this.cumulative.get(id) ?? 0) + i + 1);
    });
    this.lastRoundRanking = ranking;
    this.order = [...ranking];
    this.currentTurnId = null;
    this.pendingAttack = 0;
    this.attackFromId = null;
    this.drawnPending = null;
    this.phase = "roundEnd";
    return true;
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
      this.finish("투표로 게임을 종료했어요.");
      return;
    }
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

  // ----- test-only helpers (deterministic scenarios) -----
  /** @internal test-only */
  forTest_setHand(id: string, cards: AlloutCard[]): void {
    this.hands.set(id, sortHand(cards));
  }
  /** @internal test-only */
  forTest_setTop(card: AlloutCard, color: AlloutColor): void {
    this.discardPile = [card];
    this.activeColor = color;
  }
  /** @internal test-only */
  forTest_setTurn(id: string): void {
    this.currentTurnId = id;
  }
  /** @internal test-only */
  forTest_setPending(amount: number, fromId: string | null): void {
    this.pendingAttack = amount;
    this.attackFromId = fromId;
  }
}
