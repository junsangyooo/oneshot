// King Game (왕게임) — shared wire types.
//
// Four modes. The mode is chosen in an in-game SETUP phase (the host sends a
// `kinggame:configure` game-action), NOT through lobby options — so start()
// needs no options.
//
// Mission text is NEVER resolved server-side into a single language. The server
// sends either a `missionId` (a preset, looked up in KING_MISSIONS) or a
// `missionRaw` (a host-typed custom mission). Each client renders the mission in
// ITS OWN language, so a Korean viewer and an English viewer in the same room
// each read their language. See ./kingMissions for the bilingual preset pack and
// the render/parse helpers.

export type KingGameMode = "free" | "mild" | "spicy" | "custom";

// Mode + custom pool are configured in-game via `kinggame:configure`, so the
// game takes no lobby options. Kept as an (empty) object type for the catalog.
export type KingGameOptions = Record<string, never>;

export const defaultKingGameOptions: KingGameOptions = {};

export type KingGamePhase = "setup" | "command" | "revealed";

export type KingGameTarget = {
  number: number;
  playerId: string;
};

export type KingGameCommand = {
  // Exactly one of missionId / missionRaw is set.
  missionId?: string; // preset id — look up in KING_MISSIONS and render per-language
  missionRaw?: string; // host-typed custom mission — shown as-is (single language)
  slots: number; // 1 or 2 — how many players the mission targets
  targets: KingGameTarget[]; // king-assigned, in slot order [A] or [A, B]
  revealAt: number; // epoch ms; clients animate the 3s reveal locally from this
};

export type KingGamePublicState = {
  mode: KingGameMode | null; // null while still in setup (before configure)
  phase: KingGamePhase;
  round: number;
  kingPlayerId: string | null;
  availableNumbers: number[];
  command: KingGameCommand | null;
  customMissionCount: number; // size of the custom pool (custom mode HUD)
};

// The mission the KING privately sees during the "command" phase (random/custom
// modes). Never present in public state — delivered only via getStateFor(king).
export type KingGamePendingMission = {
  missionId?: string;
  missionRaw?: string;
  slots: number;
};

export type KingGamePrivateState = {
  role: "king" | "subject";
  number: number | null;
  pendingMission: KingGamePendingMission | null; // king-only, command phase, random/custom
};

// --- action payloads (carried on { type: "game:action"; action: GameAction }) ---

// A custom-mode pool entry: reference a preset by id, or a host-typed mission.
export type KingCustomEntry =
  | { kind: "preset"; missionId: string }
  | { kind: "custom"; text: string; slots: 1 | 2 };

export type KingGameConfigurePayload = {
  mode: KingGameMode;
  customMissions?: KingCustomEntry[]; // required & non-empty when mode === "custom"
};

export type KingGameRevealPayload = {
  targetNumbers: number[]; // length must equal the pending mission's slots
};

// Bounds for host-typed custom missions (shared by client + server validation).
export const KING_CUSTOM_TEXT_MIN = 2;
export const KING_CUSTOM_TEXT_MAX = 120;
export const KING_CUSTOM_POOL_MAX = 40;

// How long the targeted players' "reveal your number!" prompt shows before the
// full mission text appears. The server stamps command.revealAt; each client
// animates this window locally (no server timer).
export const KING_REVEAL_DELAY_MS = 3000;

// Action type strings (use these everywhere to avoid typos).
export const KING_ACTIONS = {
  configure: "kinggame:configure",
  reveal: "kinggame:reveal",
  nextTurn: "kinggame:nextTurn",
  endGame: "kinggame:endGame",
} as const;
