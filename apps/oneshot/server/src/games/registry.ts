import type { GameId } from "@oneshot/shared";
import type { GameModuleFactory } from "./GameModule";
import { KingGameModule } from "./kinggame/KingGameModule";

const registry = new Map<GameId, GameModuleFactory>([["kinggame", () => new KingGameModule()]]);

export const getGameModule = (gameId: GameId) => registry.get(gameId)?.();

export const isGameAvailable = (gameId: GameId): boolean => registry.has(gameId);

export const availableGameIds = (): GameId[] => [...registry.keys()];
