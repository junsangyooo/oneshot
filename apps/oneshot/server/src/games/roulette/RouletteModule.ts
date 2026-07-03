import type {
  ErrorCode,
  GameAction,
  GameResult,
  PublicPlayerState,
  RouletteOptions,
  RoulettePrivateState,
  RoulettePublicState,
  RouletteSlot,
} from "@oneshot/shared";
import { ROULETTE_ACTIONS, ROULETTE_SPIN_MS } from "@oneshot/shared";
import { Randomizer } from "../../core/Randomizer";
import type { ActionResult, GameModule } from "../GameModule";

const ok = (): ActionResult => ({ ok: true });
const fail = (code: ErrorCode, message: string): ActionResult => ({ ok: false, code, message });

// Roulette(룰렛) — pure-luck single-round picker. Everyone gets an equal
// 360°/N slice in seat order; the winner is decided the instant start() runs
// from the injected seed, never the client. Nothing is secret, so
// getStateFor() is empty (same convention as dice).
//
// There is no player input, ever — so nothing would normally trigger this
// engine's isOver() re-check (PartyRoomCore only sweeps it after a
// handleAction/lifecycle hook, see settleGameOutcome). Every client fires a
// single ROULETTE_ACTIONS.reveal action once its own local spin animation
// finishes; this module only lets isOver() return the result once
// ROULETTE_SPIN_MS has actually elapsed since start(), regardless of when
// that action arrives — a spoofed/early reveal from one client cannot
// truncate the spin (and the suspense) for the rest of the room.
export class RouletteModule implements GameModule<RouletteOptions, RoulettePublicState, RoulettePrivateState> {
  readonly id = "roulette" as const;
  readonly minPlayers = 1; // solo spins are a valid way to play, mirrors dice

  private players: PublicPlayerState[] = [];
  private slots: RouletteSlot[] = [];
  private winnerId = "";
  private spinStartedAt = 0;
  private result: GameResult | null = null;

  start(input: { players: PublicPlayerState[]; options: RouletteOptions; randomSeed: string }): void {
    if (input.players.length < this.minPlayers) {
      throw new Error(`Roulette requires at least ${this.minPlayers} player`);
    }
    this.players = [...input.players].sort((l, r) => l.seatIndex - r.seatIndex);
    const randomizer = new Randomizer(input.randomSeed);
    const slice = 360 / this.players.length;
    this.slots = this.players.map((p, index) => ({
      playerId: p.id,
      seatIndex: p.seatIndex,
      angleStart: index * slice,
      angleEnd: (index + 1) * slice,
    }));
    this.winnerId = randomizer.pick(this.players.map((p) => p.id));
    this.spinStartedAt = Date.now();
    this.result = null;
  }

  handleAction(input: { playerId: string; action: GameAction; isHost: boolean }): ActionResult {
    switch (input.action.type) {
      case ROULETTE_ACTIONS.reveal:
        return this.reveal();
      default:
        return fail("INVALID_ACTION", "지원하지 않는 행동입니다.");
    }
  }

  // Temporary disconnect / reconnect: the spin is already decided against a
  // fixed seat snapshot, so there is no live quorum to re-resolve.
  onPlayerLeave(_playerId: string): void {}
  onPlayerReturn(_playerId: string): void {}

  // The round already resolved deterministically against the seat snapshot
  // taken in start() — a later removal (even of the winner) can't reshuffle
  // the wheel or change who won; this is a finished single-round record, not
  // live game state waiting on that player. Nothing here can block the phase
  // transition (it's gated purely on elapsed time), so there's no stall risk.
  onPlayerRemoved(_playerId: string): void {}

  isOver(): GameResult | null {
    return this.result;
  }

  getPublicState(): RoulettePublicState {
    return {
      phase: this.result ? "ended" : "spinning",
      slots: this.slots.map((s) => ({ ...s })),
      winnerId: this.winnerId,
      spinStartedAt: this.spinStartedAt,
    };
  }

  getStateFor(_playerId: string): RoulettePrivateState {
    return {};
  }

  // ============================ internals ============================

  private reveal(): ActionResult {
    // Idempotent no-op once already resolved — harmless when several
    // clients' local timers all fire within a few ms of each other.
    if (this.result) return ok();
    // Too early: ignored rather than an error, since a legitimate client
    // should simply never call this before its own animation finishes.
    if (Date.now() - this.spinStartedAt < ROULETTE_SPIN_MS) return ok();
    const ranking = this.players.map((p) => ({
      playerId: p.id,
      rank: p.id === this.winnerId ? 1 : 2,
    }));
    this.result = {
      ranking,
      winnerPlayerIds: [this.winnerId],
      summary: "룰렛이 멈췄어요 — 100% 운으로 당첨자가 정해졌어요.",
    };
    return ok();
  }
}
