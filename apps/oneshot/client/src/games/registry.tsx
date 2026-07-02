import type { ComponentType } from "react";
import type { GameId, PartyRoomState } from "@oneshot/shared";
import { AlloutGameScreen } from "./allout/AlloutGameScreen";
import { DiceGameScreen } from "./dice/DiceGameScreen";
import { KingGameScreen } from "./kinggame/KingGameScreen";
import { LiarGameScreen } from "./liar/LiarGameScreen";
import { UpstageGameScreen } from "./upstage/UpstageGameScreen";

/* Common props every in-game screen receives. Keep this in sync with the
   individual *GameScreen components. */
export type GameScreenProps = {
  roomState: PartyRoomState;
  privateState: unknown;
  currentPlayerId: string | null;
};

/* Maps a gameId to its in-game screen component. To wire up a new game, add a
   single entry here — App.tsx looks the active game up in this map and renders
   it, so no routing edits are needed. */
export const GAME_SCREENS: Partial<Record<GameId, ComponentType<GameScreenProps>>> = {
  kinggame: KingGameScreen,
  liar: LiarGameScreen,
  "fool-liar": LiarGameScreen,
  upstage: UpstageGameScreen,
  allout: AlloutGameScreen,
  dice: DiceGameScreen,
};
