import type { GameId } from "@oneshot/shared";
import type { GameModuleFactory } from "./GameModule";
import { AlloutModule } from "./allout/AlloutModule";
import { FoolLiarModule } from "./fool-liar/FoolLiarModule";
import { KingGameModule } from "./kinggame/KingGameModule";
import { LiarModule } from "./liar/LiarModule";
import { UpstageModule } from "./upstage/UpstageModule";

const registry = new Map<GameId, GameModuleFactory>([
  ["kinggame", () => new KingGameModule()],
  ["liar", () => new LiarModule()],
  ["fool-liar", () => new FoolLiarModule()],
  ["upstage", () => new UpstageModule()],
  ["allout", () => new AlloutModule()],
]);

export const getGameModule = (gameId: GameId) => registry.get(gameId)?.();

export const isGameAvailable = (gameId: GameId): boolean => registry.has(gameId);

export const availableGameIds = (): GameId[] => [...registry.keys()];
