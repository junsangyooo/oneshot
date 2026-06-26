import { Client } from "colyseus.js";
import type { Room } from "colyseus.js";
import type {
  ClientToServerMessage,
  JoinResult,
  RoomTransport,
  ServerEvent,
} from "@oneshot/shared";
import { MESSAGE_CHANNEL, readRoomCodeFromReconnectToken } from "@oneshot/shared";
import { clientConfig } from "../config/env";

type EventHandler = (event: ServerEvent) => void;

export class ColyseusRoomTransport implements RoomTransport {
  private readonly client = new Client(clientConfig.wsUrl);
  private room: Room | null = null;
  private readonly handlers = new Set<EventHandler>();
  private readonly joinResolvers = new Set<(result: JoinResult) => void>();
  private lastJoinResult: JoinResult | null = null;

  async createRoom(input: { nickname: string; avatarKey?: string; themeId?: string }): Promise<JoinResult> {
    const response = await fetch(`${clientConfig.apiUrl}/api/rooms`, { method: "POST" });
    if (!response.ok) {
      throw new Error("방을 만들 수 없습니다.");
    }
    const createdRoom = (await response.json()) as { roomCode?: unknown };
    if (typeof createdRoom.roomCode !== "string") {
      throw new Error("방 코드를 받지 못했습니다.");
    }
    return this.joinByCode({ ...input, roomCode: createdRoom.roomCode });
  }

  async joinByCode(input: {
    roomCode: string;
    nickname: string;
    avatarKey?: string;
    themeId?: string;
  }): Promise<JoinResult> {
    const room = await this.client.join("party", {
      roomCode: input.roomCode.toUpperCase(),
      nickname: input.nickname,
      avatarKey: input.avatarKey,
      themeId: input.themeId,
    });
    return this.bindAndWaitForJoin(room);
  }

  async joinByLink(input: {
    roomCode: string;
    nickname?: string;
    avatarKey?: string;
    themeId?: string;
  }): Promise<JoinResult> {
    return this.joinByCode({ ...input, nickname: input.nickname ?? "Guest" });
  }

  async reconnect(input: { reconnectToken: string }): Promise<JoinResult> {
    const roomCode = readRoomCodeFromReconnectToken(input.reconnectToken);
    if (!roomCode) {
      throw new Error("Reconnect token is invalid");
    }
    const room = await this.client.join("party", {
      roomCode,
      reconnectToken: input.reconnectToken,
    });
    return this.bindAndWaitForJoin(room);
  }

  send(message: ClientToServerMessage): void {
    if (!this.room) {
      throw new Error("Room is not connected");
    }
    this.room.send(MESSAGE_CHANNEL.clientToServer, message);
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async leave(): Promise<void> {
    await this.room?.leave();
    this.room = null;
    this.lastJoinResult = null;
  }

  private bindAndWaitForJoin(room: Room): Promise<JoinResult> {
    this.room = room;
    this.lastJoinResult = null;
    room.onMessage(MESSAGE_CHANNEL.event, (event: ServerEvent) => {
      if (event.type === "room:joined") {
        this.lastJoinResult = event.result;
        for (const resolve of this.joinResolvers) {
          resolve(event.result);
        }
        this.joinResolvers.clear();
      }
      for (const handler of this.handlers) {
        handler(event);
      }
    });
    room.send(MESSAGE_CHANNEL.hello);

    return new Promise<JoinResult>((resolve) => {
      if (this.lastJoinResult) {
        resolve(this.lastJoinResult);
        return;
      }
      this.joinResolvers.add(resolve);
    });
  }
}
