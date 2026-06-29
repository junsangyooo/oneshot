import type {
  ErrorCode,
  GameAction,
  GameId,
  GameResult,
  PublicPlayerState,
} from "@oneshot/shared";

export type ActionResult =
  | { ok: true; events?: GameEvent[] }
  | { ok: false; code: ErrorCode; message: string };

export type GameEvent = {
  type: string;
  payload?: unknown;
};

export interface GameModule<TOptions, TPublicState, TPrivateState> {
  readonly id: GameId;
  readonly minPlayers: number;

  start(input: {
    players: PublicPlayerState[];
    options: TOptions;
    randomSeed: string;
  }): void;

  handleAction(input: { playerId: string; action: GameAction }): ActionResult;
  getPublicState(): TPublicState;
  getStateFor(playerId: string): TPrivateState;
  onPlayerLeave(playerId: string): void;
  onPlayerReturn(playerId: string): void;
  isOver(): GameResult | null;
}

export type GameModuleFactory = () => GameModule<unknown, unknown, unknown>;
