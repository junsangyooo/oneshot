import type {
  GameAction,
  GameResult,
  LiarOptions,
  LiarPrivateState,
  LiarPublicState,
  PublicPlayerState,
} from "@oneshot/shared";
import { FOOL_LIAR_ACTIONS } from "@oneshot/shared";
import type { ActionResult, GameModule } from "../GameModule";
import { FOOL_DECOY_STRATEGY, LiarCore } from "../liar/liarCore";

// 바보 라이어 — liars all receive the SAME different word from the same category,
// so they cannot tell they are the liar.
export class FoolLiarModule
  implements GameModule<LiarOptions, LiarPublicState, LiarPrivateState>
{
  readonly id = "fool-liar" as const;
  readonly minPlayers = 3;

  private core = new LiarCore(FOOL_DECOY_STRATEGY, this.minPlayers, "바보 라이어 게임을 마쳤어요.");

  start(input: { players: PublicPlayerState[]; options: LiarOptions; randomSeed: string }): void {
    this.core.start({ players: input.players, randomSeed: input.randomSeed });
  }

  handleAction(input: { playerId: string; action: GameAction; isHost: boolean }): ActionResult {
    switch (input.action.type) {
      case FOOL_LIAR_ACTIONS.configure:
        return this.core.configure(input.isHost, input.action.payload);
      case FOOL_LIAR_ACTIONS.endGame:
        return this.core.endGame(input.isHost);
      default:
        return { ok: false, code: "INVALID_ACTION", message: "지원하지 않는 행동입니다." };
    }
  }

  getPublicState(): LiarPublicState {
    return this.core.getPublicState();
  }

  getStateFor(playerId: string): LiarPrivateState {
    return this.core.getStateFor(playerId);
  }

  onPlayerLeave(_playerId: string): void {
    // No auto-skip; assignments live in memory and survive reconnects.
  }

  onPlayerReturn(_playerId: string): void {
    // No-op — the returning player's card is still in memory.
  }

  onPlayerRemoved(playerId: string): void {
    this.core.onPlayerRemoved(playerId);
  }

  isOver(): GameResult | null {
    return this.core.isOver();
  }
}
