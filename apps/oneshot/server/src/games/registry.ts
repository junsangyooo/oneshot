import type { GameId } from "@oneshot/shared";
import type { GameModuleFactory } from "./GameModule";
import { FoolLiarModule } from "./fool-liar/FoolLiarModule";
import { KingGameModule } from "./kinggame/KingGameModule";
import { LiarModule } from "./liar/LiarModule";

const registry = new Map<GameId, GameModuleFactory>([
  ["kinggame", () => new KingGameModule()],
  ["liar", () => new LiarModule()],
  ["fool-liar", () => new FoolLiarModule()],
]);

export const getGameModule = (gameId: GameId) => registry.get(gameId)?.();

export const isGameAvailable = (gameId: GameId): boolean => registry.has(gameId);

export const availableGameIds = (): GameId[] => [...registry.keys()];
