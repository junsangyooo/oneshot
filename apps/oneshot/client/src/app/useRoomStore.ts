import { create } from "zustand";
import type {
  ClientToServerMessage,
  JoinResult,
  PartyRoomState,
  PlayerProfileInput,
  ServerEvent,
} from "@oneshot/shared";
import { ColyseusRoomTransport } from "../transport/ColyseusRoomTransport";
import { storage } from "./storage";

type ConnectionState = "idle" | "connecting" | "connected" | "failed";

type RoomStore = {
  connectionState: ConnectionState;
  joinResult: JoinResult | null;
  roomState: PartyRoomState | null;
  privateGameState: unknown;
  toast: string | null;
  screenError: { message: string; retryable: boolean } | null;
  createRoom: (nickname: string, profile?: PlayerProfileInput) => Promise<void>;
  joinRoom: (roomCode: string, nickname: string, profile?: PlayerProfileInput) => Promise<void>;
  reconnect: () => Promise<void>;
  send: (message: ClientToServerMessage) => void;
  leave: () => Promise<void>;
  clearToast: () => void;
  clearScreenError: () => void;
};

let transport = new ColyseusRoomTransport();
let unsubscribeTransport: (() => void) | null = null;

const bindTransport = (emit: (event: ServerEvent) => void): void => {
  unsubscribeTransport?.();
  unsubscribeTransport = transport.onEvent(emit);
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  connectionState: "idle",
  joinResult: null,
  roomState: null,
  privateGameState: null,
  toast: null,
  screenError: null,

  async createRoom(nickname: string, profile?: PlayerProfileInput) {
    storage.setNickname(nickname);
    set({ connectionState: "connecting", toast: null, screenError: null });
    try {
      transport = new ColyseusRoomTransport();
      bindTransport((event) => handleServerEvent(event, set));
      const result = await transport.createRoom({ nickname, ...profile });
      storage.setReconnectToken(result.reconnectToken);
      set({ connectionState: "connected", joinResult: result });
    } catch (error) {
      set({
        connectionState: "failed",
        screenError: { message: userMessage(error), retryable: true },
      });
    }
  },

  async joinRoom(roomCode: string, nickname: string, profile?: PlayerProfileInput) {
    storage.setNickname(nickname);
    set({ connectionState: "connecting", toast: null, screenError: null });
    try {
      transport = new ColyseusRoomTransport();
      bindTransport((event) => handleServerEvent(event, set));
      const result = await transport.joinByCode({ roomCode, nickname, ...profile });
      storage.setReconnectToken(result.reconnectToken);
      set({ connectionState: "connected", joinResult: result });
    } catch (error) {
      set({
        connectionState: "failed",
        screenError: { message: userMessage(error), retryable: true },
      });
    }
  },

  async reconnect() {
    const reconnectToken = storage.getReconnectToken();
    if (!reconnectToken || get().connectionState === "connected") {
      return;
    }
    set({ connectionState: "connecting", toast: null, screenError: null });
    try {
      transport = new ColyseusRoomTransport();
      bindTransport((event) => handleServerEvent(event, set));
      const result = await transport.reconnect({ reconnectToken });
      storage.setReconnectToken(result.reconnectToken);
      set({ connectionState: "connected", joinResult: result });
    } catch {
      storage.clearReconnectToken();
      set({ connectionState: "idle", joinResult: null, roomState: null, privateGameState: null });
    }
  },

  send(message: ClientToServerMessage) {
    try {
      transport.send(message);
    } catch (error) {
      set({ toast: userMessage(error) });
    }
  },

  async leave() {
    unsubscribeTransport?.();
    unsubscribeTransport = null;
    try {
      await transport.leave();
    } catch (error) {
      console.error("leave failed", error);
    }
    storage.clearReconnectToken();
    set({
      connectionState: "idle",
      joinResult: null,
      roomState: null,
      privateGameState: null,
      toast: null,
      screenError: null,
    });
  },

  clearToast() {
    set({ toast: null });
  },

  clearScreenError() {
    set({ screenError: null, connectionState: "idle" });
  },
}));

const handleServerEvent = (
  event: ServerEvent,
  set: (partial: Partial<RoomStore>) => void,
): void => {
  if (event.type === "room:joined") {
    storage.setReconnectToken(event.result.reconnectToken);
    set({ joinResult: event.result, connectionState: "connected" });
    return;
  }
  if (event.type === "room:state") {
    set({ roomState: event.state, connectionState: "connected" });
    return;
  }
  if (event.type === "game:privateState") {
    set({ privateGameState: event.state });
    return;
  }
  if (event.type === "error") {
    set({ toast: event.message, screenError: { message: event.message, retryable: event.retryable } });
  }
};

const userMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "연결에 실패했습니다.";
};
