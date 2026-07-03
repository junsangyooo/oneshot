import type { GameCatalogItem } from "../schema/domain";
import { defaultAlloutOptions } from "./allout";
import { defaultDiceOptions } from "./dice";
import { defaultKingGameOptions } from "./kinggame";
import { defaultRouletteOptions } from "./roulette";
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
    id: "allout",
    title: "올아웃",
    minPlayers: 2,
    maxPlayers: 16,
    complexity: 3,
    supportsJoinInProgress: false,
    defaultOptions: defaultAlloutOptions,
    status: "available",
  },
  {
    id: "dice",
    title: "주사위",
    minPlayers: 1, // solo luck-checking is a valid way to play

    maxPlayers: null,
    complexity: 1,
    supportsJoinInProgress: false,
    defaultOptions: defaultDiceOptions,
    status: "available",
  },
  {
    id: "roulette",
    title: "룰렛",
    minPlayers: 1, // solo spins are a valid way to play, mirrors dice
    maxPlayers: 24, // beyond this the wheel's slices/labels stop being legible
    complexity: 1,
    supportsJoinInProgress: false,
    defaultOptions: defaultRouletteOptions,
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
