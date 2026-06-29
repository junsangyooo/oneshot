import type { ErrorCode } from "./errors";
import type { GameId, PartyRoomState } from "../schema/domain";

export type GameAction = {
  type: string;
  payload?: unknown;
  clientActionId: string;
};

export type ClientToServerMessage =
  | { type: "room:updateNickname"; nickname: string }
  | { type: "room:updateProfile"; nickname?: string; avatarKey?: string; themeId?: string }
  | { type: "room:selectGame"; gameId: GameId; options?: Record<string, unknown> }
  | { type: "room:startGame" }
  | { type: "room:returnToLobby" }
  | { type: "room:close" }
  | { type: "room:kickPlayer"; playerId: string }
  | { type: "game:action"; action: GameAction };

export type JoinResult = {
  roomId: string;
  roomCode: string;
  playerId: string;
  reconnectToken: string;
};

export type ServerEvent =
  | { type: "room:joined"; result: JoinResult }
  | { type: "room:state"; state: PartyRoomState }
  | { type: "game:privateState"; state: unknown }
  | { type: "error"; code: ErrorCode; message: string; retryable: boolean };

export const MESSAGE_CHANNEL = {
  clientToServer: "message",
  hello: "hello",
  event: "event",
} as const;

export type PlayerProfileInput = { avatarKey?: string; themeId?: string };

export type RoomTransport = {
  createRoom(input: { nickname: string } & PlayerProfileInput): Promise<JoinResult>;
  joinByCode(input: { roomCode: string; nickname: string } & PlayerProfileInput): Promise<JoinResult>;
  joinByLink(input: { roomCode: string; nickname?: string } & PlayerProfileInput): Promise<JoinResult>;
  reconnect(input: { reconnectToken: string }): Promise<JoinResult>;
  send(message: ClientToServerMessage): void;
  onEvent(handler: (event: ServerEvent) => void): () => void;
  leave(): Promise<void>;
};
