import type {
  GameAction,
  GameResult,
  PublicPlayerState,
  RummikubOptions,
  RummikubPrivateState,
  RummikubPublicState,
} from "@oneshot/shared";
import { RUMMIKUB_ACTIONS } from "@oneshot/shared";
import type { ActionResult, GameModule } from "../GameModule";
import { RummikubCore } from "./rummikubCore";

// 루미큐브 — Thin adapter over RummikubCore.
export class RummikubModule
  implements GameModule<RummikubOptions, RummikubPublicState, RummikubPrivateState>
{
  readonly id = "rummikub" as const;
  readonly minPlayers = 2;

  private core = new RummikubCore();

  start(input: { players: PublicPlayerState[]; options: RummikubOptions; randomSeed: string }): void {
    this.core.start({ players: input.players, randomSeed: input.randomSeed });
  }

  handleAction(input: { playerId: string; action: GameAction; isHost: boolean }): ActionResult {
    const { playerId, action, isHost } = input;
    switch (action.type) {
      case RUMMIKUB_ACTIONS.configure:
        return this.core.configure(isHost, action.payload);
      case RUMMIKUB_ACTIONS.commit:
        return this.core.commit(playerId, action.payload);
      case RUMMIKUB_ACTIONS.draw:
        return this.core.draw(playerId);
      case RUMMIKUB_ACTIONS.timeout:
        return this.core.timeout(action.payload);
      case RUMMIKUB_ACTIONS.skipTurn:
        return this.core.skipTurn(isHost);
      case RUMMIKUB_ACTIONS.proposeEnd:
        return this.core.proposeEnd(playerId);
      case RUMMIKUB_ACTIONS.voteEnd:
        return this.core.voteEnd(playerId, action.payload);
      default:
        return { ok: false, code: "INVALID_ACTION", message: "지원하지 않는 행동입니다." };
    }
  }

  getPublicState(): RummikubPublicState {
    return this.core.getPublicState();
  }

  getStateFor(playerId: string): RummikubPrivateState {
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
