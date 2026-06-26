export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_EXPIRED"
  | "INVALID_NICKNAME"
  | "HOST_ONLY"
  | "GAME_NOT_FOUND"
  | "GAME_ALREADY_RUNNING"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_ACTION"
  | "NOT_YOUR_TURN"
  | "RECONNECT_FAILED"
  | "SERVER_ERROR";

export type ProtocolError = {
  code: ErrorCode;
  message: string;
  retryable: boolean;
};

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  ROOM_NOT_FOUND: "방을 찾을 수 없어요.",
  ROOM_FULL: "방이 가득 찼어요.",
  ROOM_EXPIRED: "만료된 방이에요.",
  INVALID_NICKNAME: "닉네임을 확인해주세요.",
  HOST_ONLY: "방장만 할 수 있어요.",
  GAME_NOT_FOUND: "게임을 찾을 수 없어요.",
  GAME_ALREADY_RUNNING: "이미 게임이 진행 중이에요.",
  NOT_ENOUGH_PLAYERS: "인원이 부족해요.",
  INVALID_ACTION: "지금은 할 수 없는 동작이에요.",
  NOT_YOUR_TURN: "당신 차례가 아니에요.",
  RECONNECT_FAILED: "다시 연결하지 못했어요.",
  SERVER_ERROR: "잠시 후 다시 시도해주세요.",
};

export const RETRYABLE_ERRORS: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "RECONNECT_FAILED",
  "SERVER_ERROR",
]);
