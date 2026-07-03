import type {
  GameAction,
  GameResult,
  PublicPlayerState,
  UpstageOptions,
  UpstagePrivateState,
  UpstagePublicState,
} from "@oneshot/shared";
import { UPSTAGE_ACTIONS } from "@oneshot/shared";
import type { ActionResult, GameModule } from "../GameModule";
import { UpstageCore } from "./upstageCore";

// Upstage(업스테이지) — number-card shedding game. Thin adapter over UpstageCore.
export class UpstageModule
  implements GameModule<UpstageOptions, UpstagePublicState, UpstagePrivateState>
{
  readonly id = "upstage" as const;
  readonly minPlayers = 3;

  private core = new UpstageCore();

  start(input: { players: PublicPlayerState[]; options: UpstageOptions; randomSeed: string }): void {
    this.core.start({ players: input.players, randomSeed: input.randomSeed });
  }

  handleAction(input: { playerId: string; action: GameAction; isHost: boolean }): ActionResult {
    const { playerId, action, isHost } = input;
    switch (action.type) {
      case UPSTAGE_ACTIONS.configure:
        return this.core.configure(isHost, action.payload);
      case UPSTAGE_ACTIONS.startHand:
        return this.core.startHand(playerId);
      case UPSTAGE_ACTIONS.declare:
        return this.core.declare(playerId, action.payload);
      case UPSTAGE_ACTIONS.taxReturn:
        return this.core.taxReturn(playerId, action.payload);
      case UPSTAGE_ACTIONS.play:
        return this.core.play(playerId, action.payload);
      case UPSTAGE_ACTIONS.pass:
        return this.core.pass(playerId);
      case UPSTAGE_ACTIONS.nextHand:
        return this.core.nextHand(playerId);
      case UPSTAGE_ACTIONS.proposeEnd:
        return this.core.proposeEnd(playerId);
      case UPSTAGE_ACTIONS.voteEnd:
        return this.core.voteEnd(playerId, action.payload);
      default:
        return { ok: false, code: "INVALID_ACTION", message: "지원하지 않는 행동입니다." };
    }
  }

  getPublicState(): UpstagePublicState {
    return this.core.getPublicState();
  }

  getStateFor(playerId: string): UpstagePrivateState {
    return this.core.getStateFor(playerId);
  }

  onPlayerLeave(playerId: string): void {
    // Hands live in memory and survive reconnects. We only flag the disconnect so
    // an open early-end vote resolves against the connected base.
    this.core.onPlayerLeave(playerId);
  }

  onPlayerReturn(playerId: string): void {
    this.core.onPlayerReturn(playerId);
  }

  onPlayerRemoved(playerId: string): void {
    this.core.onPlayerRemoved(playerId);
  }

  isOver(): GameResult | null {
    return this.core.isOver();
  }
}
