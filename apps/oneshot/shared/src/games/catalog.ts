import type { GameCatalogItem } from "../schema/domain";
import { defaultKingGameOptions } from "./kinggame";
import { defaultUpstageOptions } from "./upstage";

export const gameCatalog: GameCatalogItem[] = [
  {
    id: "kinggame",
    title: "왕게임",
    minPlayers: 2,
    maxPlayers: null,
    complexity: 1,
    supportsJoinInProgress: false,
    defaultOptions: defaultKingGameOptions,
    status: "available",
  },
  {
    id: "upstage",
    title: "업스테이지",
    minPlayers: 3,
    maxPlayers: null,
    complexity: 3,
    supportsJoinInProgress: false,
    defaultOptions: defaultUpstageOptions,
    status: "available",
  },
  {
    id: "liar",
    title: "라이어",
    minPlayers: 3,
    maxPlayers: null,
    complexity: 2,
    supportsJoinInProgress: false,
    defaultOptions: {},
    status: "available",
  },
  {
    id: "fool-liar",
    title: "바보 라이어",
    minPlayers: 3,
    maxPlayers: null,
    complexity: 1,
    supportsJoinInProgress: false,
    defaultOptions: {},
    status: "available",
  },
  {
    id: "arithmetic",
    title: "사칙연산",
    minPlayers: 2,
    maxPlayers: null,
    complexity: 2,
    supportsJoinInProgress: false,
    defaultOptions: {},
    status: "coming_soon",
  },
];
