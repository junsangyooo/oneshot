import type {
  DiceOptions,
  DicePhase,
  DicePlayerPublic,
  DicePrivateState,
  DicePublicState,
  DiceRoll,
  ErrorCode,
  GameAction,
  GameResult,
  PublicPlayerState,
} from "@oneshot/shared";
import {
  DICE_ACTIONS,
  DICE_ROUNDS_DEFAULT,
  DICE_ROUNDS_MAX,
  DICE_ROUNDS_MIN,
  END_VOTE_COOLDOWN_MS,
} from "@oneshot/shared";
import { Randomizer } from "../../core/Randomizer";
import type { ActionResult, GameModule } from "../GameModule";

const ok = (): ActionResult => ({ ok: true });
const fail = (code: ErrorCode, message: string): ActionResult => ({ ok: false, code, message });

// Dice(주사위) — pure-luck dice race. Authoritative: every roll comes from the
// injected seed, never the client. Nothing is secret, so getStateFor() is empty.
//
// Round loop: everyone connected presses roll; once every CONNECTED player has
// rolled, the server auto-rolls any disconnected seats (pure luck stays fair and
// the round can never deadlock on a dropout) and resolves the round ranking
// (higher sum = better rank, ties share). Cumulative score = sum of round ranks,
// lower wins — same convention as upstage/allout.
export class DiceModule implements GameModule<DiceOptions, DicePublicState, DicePrivateState> {
  readonly id = "dice" as const;
  readonly minPlayers = 1; // solo luck-checking is allowed

  private players: PublicPlayerState[] = [];
  private randomizer = new Randomizer("dice");

  private phase: DicePhase = "setup";
  private totalRounds = DICE_ROUNDS_DEFAULT;
  private roundNumber = 0;

  private rolls = new Map<string, DiceRoll>();
  private roundRanks = new Map<string, number>();
  private cumulative = new Map<string, number>();
  // Cumulative pip total across rounds — breaks rank-sum ties (higher wins).
  private pipTotal = new Map<string, number>();
  private lastRoundRanking: string[] | null = null;
  private voteCooldownUntil = 0;

  // Temporarily disconnected (reconnectable) players. They stay seated but the
  // round-completion quorum and the early-end vote count CONNECTED players only.
  private disconnected = new Set<string>();

  private endVote: { proposedBy: string; votes: Map<string, boolean> } | null = null;

  private result: GameResult | null = null;

  start(input: { players: PublicPlayerState[]; options: DiceOptions; randomSeed: string }): void {
    if (input.players.length < this.minPlayers) {
      throw new Error(`Dice requires at least ${this.minPlayers} players`);
    }
    this.players = [...input.players].sort((l, r) => l.seatIndex - r.seatIndex);
    this.randomizer = new Randomizer(input.randomSeed);
    this.phase = "setup";
    this.totalRounds = DICE_ROUNDS_DEFAULT;
    this.roundNumber = 0;
    this.rolls.clear();
    this.roundRanks.clear();
    this.cumulative = new Map(this.players.map((p) => [p.id, 0]));
    this.pipTotal = new Map(this.players.map((p) => [p.id, 0]));
    this.lastRoundRanking = null;
    this.disconnected.clear();
    this.endVote = null;
    this.voteCooldownUntil = 0;
    this.result = null;
  }

  handleAction(input: { playerId: string; action: GameAction; isHost: boolean }): ActionResult {
    const { playerId, action, isHost } = input;
    switch (action.type) {
      case DICE_ACTIONS.configure:
        return this.configure(isHost, action.payload);
      case DICE_ACTIONS.roll:
        return this.roll(playerId);
      case DICE_ACTIONS.nextRound:
        return this.nextRound(playerId);
      case DICE_ACTIONS.proposeEnd:
        return this.proposeEnd(playerId);
      case DICE_ACTIONS.voteEnd:
        return this.voteEnd(playerId, action.payload);
      default:
        return fail("INVALID_ACTION", "지원하지 않는 행동입니다.");
    }
  }

  // ---- host: configure (setup -> round 1) ----
  private configure(isHost: boolean, payload: unknown): ActionResult {
    if (this.phase !== "setup") return fail("INVALID_ACTION", "이미 게임이 시작됐습니다.");
    if (!isHost) return fail("HOST_ONLY", "방장만 게임을 설정할 수 있습니다.");
    if (typeof payload !== "object" || payload === null) return fail("INVALID_ACTION", "설정이 올바르지 않습니다.");
    const totalRounds = (payload as { totalRounds?: unknown }).totalRounds;
    if (typeof totalRounds !== "number" || !Number.isInteger(totalRounds)) {
      return fail("INVALID_ACTION", "라운드 수가 올바르지 않습니다.");
    }
    this.totalRounds = Math.min(DICE_ROUNDS_MAX, Math.max(DICE_ROUNDS_MIN, totalRounds));
    this.beginRound();
    return ok();
  }

  // ---- throw my two dice ----
  private roll(playerId: string): ActionResult {
    if (this.phase !== "rolling") return fail("INVALID_ACTION", "지금은 주사위를 굴릴 수 없습니다.");
    if (!this.players.some((p) => p.id === playerId)) return fail("INVALID_ACTION", "참가자가 아닙니다.");
    if (this.rolls.has(playerId)) return fail("INVALID_ACTION", "이미 주사위를 굴렸습니다.");
    this.rolls.set(playerId, this.makeRoll(false));
    this.checkRoundComplete();
    return ok();
  }

  // ---- anyone: roundEnd -> next round (or finish after the last) ----
  private nextRound(playerId: string): ActionResult {
    if (this.phase !== "roundEnd") return fail("INVALID_ACTION", "지금은 다음 라운드로 넘어갈 수 없습니다.");
    if (!this.players.some((p) => p.id === playerId)) return fail("INVALID_ACTION", "참가자가 아닙니다.");
    if (this.roundNumber >= this.totalRounds) {
      this.finish("모든 라운드가 끝났어요.");
      return ok();
    }
    this.beginRound();
    return ok();
  }

  // ---- anyone: early-end vote (from round 2 on; rejected votes start a cooldown) ----
  private proposeEnd(playerId: string): ActionResult {
    if (!this.players.some((p) => p.id === playerId)) return fail("INVALID_ACTION", "참가자가 아닙니다.");
    if (this.phase === "setup" || this.phase === "ended") return fail("INVALID_ACTION", "지금은 발의할 수 없습니다.");
    if (this.roundNumber < 2) return fail("INVALID_ACTION", "2라운드부터 종료 투표를 열 수 있습니다.");
    if (this.endVote) return fail("INVALID_ACTION", "이미 투표가 진행 중입니다.");
    if (Date.now() < this.voteCooldownUntil) {
      const s = Math.ceil((this.voteCooldownUntil - Date.now()) / 1000);
      return fail("INVALID_ACTION", `부결된 지 얼마 안 됐어요. ${s}초 후 다시 발의할 수 있어요.`);
    }
    this.endVote = { proposedBy: playerId, votes: new Map([[playerId, true]]) };
    this.resolveEndVote();
    return ok();
  }

  private voteEnd(playerId: string, payload: unknown): ActionResult {
    if (!this.endVote) return fail("INVALID_ACTION", "진행 중인 투표가 없습니다.");
    if (!this.players.some((p) => p.id === playerId)) return fail("INVALID_ACTION", "참가자가 아닙니다.");
    const agree = (payload as { agree?: unknown })?.agree;
    if (typeof agree !== "boolean") return fail("INVALID_ACTION", "투표가 올바르지 않습니다.");
    this.endVote.votes.set(playerId, agree);
    this.resolveEndVote();
    return ok();
  }

  // ---- lifecycle hooks ----
  // Temporary disconnect (reconnectable). The rolling quorum and any open vote
  // are both resolved against the CONNECTED base, so re-check them here.
  onPlayerLeave(playerId: string): void {
    this.disconnected.add(playerId);
    if (this.endVote) this.resolveEndVote();
    this.checkRoundComplete();
  }

  onPlayerReturn(playerId: string): void {
    this.disconnected.delete(playerId);
    // A returning player re-enters both quorums: their standing vote counts
    // again (which can push an open vote over the majority), and their earlier
    // roll may complete the round — re-resolve both.
    if (this.endVote) this.resolveEndVote();
    this.checkRoundComplete();
  }

  onPlayerRemoved(playerId: string): void {
    this.players = this.players.filter((p) => p.id !== playerId);
    this.rolls.delete(playerId);
    this.roundRanks.delete(playerId);
    this.cumulative.delete(playerId);
    this.pipTotal.delete(playerId);
    this.disconnected.delete(playerId);
    if (this.lastRoundRanking) {
      this.lastRoundRanking = this.lastRoundRanking.filter((id) => id !== playerId);
    }
    if (this.endVote) {
      this.endVote.votes.delete(playerId);
      this.resolveEndVote();
    }
    // The removed player may have been the last one we were waiting on.
    this.checkRoundComplete();
  }

  isOver(): GameResult | null {
    return this.result;
  }

  getPublicState(): DicePublicState {
    const players: DicePlayerPublic[] = this.players.map((p) => ({
      playerId: p.id,
      roll: this.rolls.get(p.id) ?? null,
      roundRank: this.roundRanks.get(p.id) ?? null,
      cumulativeScore: this.cumulative.get(p.id) ?? 0,
      pipTotal: this.pipTotal.get(p.id) ?? 0,
    }));
    const waitingOn =
      this.phase === "rolling"
        ? this.players
            .filter((p) => !this.disconnected.has(p.id) && !this.rolls.has(p.id))
            .map((p) => p.id)
        : [];
    return {
      phase: this.phase,
      roundNumber: this.roundNumber,
      totalRounds: this.totalRounds,
      players,
      waitingOn,
      lastRoundRanking: this.lastRoundRanking ? [...this.lastRoundRanking] : null,
      endVote: this.endVote
        ? { proposedBy: this.endVote.proposedBy, votes: Object.fromEntries(this.endVote.votes) }
        : null,
      endVoteCooldownUntil: this.voteCooldownUntil > Date.now() ? this.voteCooldownUntil : null,
    };
  }

  getStateFor(_playerId: string): DicePrivateState {
    return {};
  }

  // ============================ internals ============================

  private makeRoll(auto: boolean): DiceRoll {
    const d1 = this.randomizer.integer(1, 6);
    const d2 = this.randomizer.integer(1, 6);
    return { d1, d2, sum: d1 + d2, auto };
  }

  private beginRound(): void {
    this.roundNumber += 1;
    this.rolls.clear();
    this.roundRanks.clear();
    this.phase = "rolling";
  }

  // The round completes once every CONNECTED player has rolled; disconnected
  // seats get a fair server roll so a dropout can never stall the round. With
  // zero connected players we wait — someone returning re-triggers this check.
  private checkRoundComplete(): void {
    if (this.phase !== "rolling" || this.players.length === 0) return;
    const connected = this.players.filter((p) => !this.disconnected.has(p.id));
    if (connected.length === 0) return;
    if (!connected.every((p) => this.rolls.has(p.id))) return;
    for (const p of this.players) {
      if (!this.rolls.has(p.id)) this.rolls.set(p.id, this.makeRoll(true));
    }
    this.resolveRound();
  }

  private resolveRound(): void {
    // Standard competition ranking on the sum: rank = 1 + players strictly above.
    // Ties share a rank (two 10s are both rank 1, the next sum is rank 3).
    const sums = this.players.map((p) => this.rolls.get(p.id)?.sum ?? 0);
    this.players.forEach((p, index) => {
      const mySum = sums[index] ?? 0;
      const rank = 1 + sums.filter((s) => s > mySum).length;
      this.roundRanks.set(p.id, rank);
      this.cumulative.set(p.id, (this.cumulative.get(p.id) ?? 0) + rank);
      this.pipTotal.set(p.id, (this.pipTotal.get(p.id) ?? 0) + mySum);
    });
    this.lastRoundRanking = [...this.players]
      .map((p) => p.id)
      .sort((a, b) => (this.roundRanks.get(a) ?? 0) - (this.roundRanks.get(b) ?? 0));
    this.phase = "roundEnd";
  }

  private resolveEndVote(): void {
    if (!this.endVote) return;
    // Base = CONNECTED players only — a single dropout must not deadlock the vote.
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
      this.finish("투표로 게임을 종료했어요.", true);
      return;
    }
    // Can no longer pass even if all remaining connected players vote yes? -> fail.
    // A rejected vote starts a cooldown so nobody can spam re-proposals.
    const undecided = total - cast.length;
    if ((agrees + undecided) * 2 <= total || rejects * 2 >= total) {
      this.endVote = null;
      this.voteCooldownUntil = Date.now() + END_VOTE_COOLDOWN_MS;
    }
  }

  private finish(summary: string, canceled = false): void {
    // Rank-sum asc; ties break by cumulative pip total (higher wins); a full tie
    // on both shares the rank (and the win).
    const entries = this.players
      .map((p) => ({
        playerId: p.id,
        score: this.cumulative.get(p.id) ?? 0,
        pips: this.pipTotal.get(p.id) ?? 0,
      }))
      .sort((a, b) => a.score - b.score || b.pips - a.pips);
    let lastRank = 0;
    const ranking = entries.map((entry, index) => {
      const prev = entries[index - 1];
      const rank = prev && prev.score === entry.score && prev.pips === entry.pips ? lastRank : index + 1;
      lastRank = rank;
      return { playerId: entry.playerId, rank, scoreDelta: entry.score };
    });
    const winners = ranking.filter((r) => r.rank === 1).map((r) => r.playerId);
    this.result = { ranking, winnerPlayerIds: winners, summary, canceled };
    this.phase = "ended";
    this.endVote = null;
  }
}
