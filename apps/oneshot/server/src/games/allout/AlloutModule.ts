import type {
  AlloutOptions,
  AlloutPrivateState,
  AlloutPublicState,
  GameAction,
  GameResult,
  PublicPlayerState,
} from "@oneshot/shared";
import { ALLOUT_ACTIONS } from "@oneshot/shared";
import type { ActionResult, GameModule } from "../GameModule";
import { AlloutCore } from "./alloutCore";

// ALL OUT (올아웃) — 색 기반 UNO 변형 셰딩 게임. Thin adapter over AlloutCore.
export class AlloutModule
  implements GameModule<AlloutOptions, AlloutPublicState, AlloutPrivateState>
{
  readonly id = "allout" as const;
  readonly minPlayers = 2;

  private core = new AlloutCore();

  start(input: { players: PublicPlayerState[]; options: AlloutOptions; randomSeed: string }): void {
    this.core.start({ players: input.players, randomSeed: input.randomSeed });
  }

  handleAction(input: { playerId: string; action: GameAction; isHost: boolean }): ActionResult {
    const { playerId, action, isHost } = input;
    switch (action.type) {
      case ALLOUT_ACTIONS.configure:
        return this.core.configure(isHost, action.payload);
      case ALLOUT_ACTIONS.play:
        return this.core.play(playerId, action.payload);
      case ALLOUT_ACTIONS.draw:
        return this.core.draw(playerId);
      case ALLOUT_ACTIONS.pass:
        return this.core.pass(playerId);
      case ALLOUT_ACTIONS.nextRound:
        return this.core.nextRound(playerId);
      case ALLOUT_ACTIONS.proposeEnd:
        return this.core.proposeEnd(playerId);
      case ALLOUT_ACTIONS.voteEnd:
        return this.core.voteEnd(playerId, action.payload);
      default:
        return { ok: false, code: "INVALID_ACTION", message: "지원하지 않는 행동입니다." };
    }
  }

  getPublicState(): AlloutPublicState {
    return this.core.getPublicState();
  }

  getStateFor(playerId: string): AlloutPrivateState {
    return this.core.getStateFor(playerId);
  }

  onPlayerLeave(playerId: string): void {
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
