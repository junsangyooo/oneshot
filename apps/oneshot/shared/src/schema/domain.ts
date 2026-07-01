export type PlayerId = string;
export type SessionId = string;
export type GameId = "kinggame" | "upstage" | "liar" | "fool-liar" | "arithmetic" | "allout";

export type RoomPhase = "lobby" | "game" | "results";
export type ConnectionStatus = "online" | "reconnecting" | "offline";

export type PublicPlayerState = {
  id: PlayerId;
  nickname: string;
  avatarKey: string;
  themeId: string;
  seatIndex: number;
  isHost: boolean;
  connectionStatus: ConnectionStatus;
  joinedAt: number;
  lastSeenAt: number;
};

export type GameCatalogItem = {
  id: GameId;
  title: string;
  minPlayers: number;
  maxPlayers: number | null;
  complexity: 1 | 2 | 3;
  supportsJoinInProgress: boolean;
  defaultOptions: Record<string, unknown>;
  status: "available" | "coming_soon";
};

export type GameResult = {
  ranking: Array<{
    playerId: PlayerId;
    rank: number;
    scoreDelta?: number;
  }>;
  winnerPlayerIds: PlayerId[];
  summary: string;
  /** True when the game was stopped early by a vote (cancel) rather than
   * finishing naturally. The room returns straight to the lobby (team kept)
   * instead of showing the results/ranking screen. */
  canceled?: boolean;
};

export type ActiveGameState = {
  gameId: GameId;
  startedAt: number;
  publicState: unknown;
  result: GameResult | null;
};

export type PartyRoomState = {
  roomId: string;
  roomCode: string;
  phase: RoomPhase;
  hostPlayerId: string;
  temporaryHostPlayerId: string | null;
  selectedGameId: GameId;
  players: Record<PlayerId, PublicPlayerState>;
  activeGame: ActiveGameState | null;
  catalog: GameCatalogItem[];
  createdAt: number;
  updatedAt: number;
};

export type PrivatePlayerSession = {
  playerId: PlayerId;
  sessionId: SessionId;
  reconnectTokenHash: string;
  roomId: string;
  createdAt: number;
  lastSeenAt: number;
};
