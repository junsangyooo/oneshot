import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import type { ClientToServerMessage, ErrorCode, JoinResult, ServerEvent } from "@oneshot/shared";
import { ERROR_MESSAGES, MESSAGE_CHANNEL, RETRYABLE_ERRORS } from "@oneshot/shared";
import { getServerConfig } from "../config/env";
import { PartyRoomCore } from "./PartyRoomCore";
import { roomRegistry, type RoomSummary } from "./RoomRegistry";

const KICK_CLOSE_CODE = 4006;
const ROOM_CLOSE_CODE = 4007;

type PartyRoomCreateOptions = {
  roomCode?: string;
};

type PartyRoomJoinOptions = {
  roomCode?: string;
  nickname?: string;
  avatarKey?: string;
  themeId?: string;
  reconnectToken?: string;
};

export const reserveAvailableRoomCode = (): string => roomRegistry().reserveCode();

export const releaseReservedRoomCode = (roomCode: string): void => {
  roomRegistry().releaseReservedCode(roomCode);
};

export const getRoomSummaryByCode = (roomCode: string): RoomSummary | null =>
  roomRegistry().summary(roomCode);

export class PartyRoom extends Room {
  override maxClients = Number.MAX_SAFE_INTEGER;
  override autoDispose = false;

  private core!: PartyRoomCore;
  private roomCode = "";
  private readonly playerIdBySessionId = new Map<string, string>();
  private readonly sessionIdByPlayerId = new Map<string, string>();
  private readonly pendingJoinBySessionId = new Map<string, JoinResult>();
  private emptyRoomTimer: NodeJS.Timeout | null = null;
  private closing = false;

  override async onCreate(options: PartyRoomCreateOptions): Promise<void> {
    this.roomCode = options.roomCode?.toUpperCase() ?? reserveAvailableRoomCode();
    this.core = new PartyRoomCore({
      roomId: this.roomId,
      roomCode: this.roomCode,
      sessionSecret: getServerConfig().SESSION_SECRET,
    });
    this.core.setCallbacks({
      broadcastRoomState: (state) => {
        this.broadcast(MESSAGE_CHANNEL.event, { type: "room:state", state } satisfies ServerEvent);
      },
      sendPrivateState: (playerId, state) => {
        const client = this.clientForPlayer(playerId);
        client?.send(MESSAGE_CHANNEL.event, { type: "game:privateState", state } satisfies ServerEvent);
      },
      sendError: (playerId, code, devMessage) => {
        this.sendErrorToClient(this.clientForPlayer(playerId), code, devMessage);
      },
      kickPlayer: (playerId) => {
        const client = this.clientForPlayer(playerId);
        if (client) {
          void client.leave(KICK_CLOSE_CODE);
        }
        this.unbindPlayer(playerId);
      },
      closeRoom: () => {
        this.closeRoom();
      },
    });

    await this.setMetadata({ roomCode: this.roomCode });
    roomRegistry().register(this.roomCode, { summary: () => this.core.toSummary() });

    this.onMessage(MESSAGE_CHANNEL.hello, (client) => {
      this.sendInitialSnapshot(client);
    });
    this.onMessage(MESSAGE_CHANNEL.clientToServer, (client, message: ClientToServerMessage) => {
      const playerId = this.playerIdBySessionId.get(client.sessionId);
      if (playerId) {
        this.core.handleMessage(playerId, message);
      }
    });
    this.scheduleEmptyRoomCleanup();
  }

  override onJoin(client: Client, options: PartyRoomJoinOptions): void {
    this.cancelEmptyRoomTimer();

    const outcome = options.reconnectToken
      ? this.core.reconnect({ reconnectToken: options.reconnectToken })
      : this.core.join({
          nickname: options.nickname,
          avatarKey: options.avatarKey,
          themeId: options.themeId,
        });

    if (!outcome.ok) {
      this.sendErrorToClient(client, outcome.code, outcome.message);
      void client.leave(4000);
      return;
    }

    this.bindPlayer(client.sessionId, outcome.result.playerId);
    this.pendingJoinBySessionId.set(client.sessionId, outcome.result);
  }

  override onLeave(client: Client, _consented: boolean): void {
    const playerId = this.playerIdBySessionId.get(client.sessionId);
    this.playerIdBySessionId.delete(client.sessionId);
    this.pendingJoinBySessionId.delete(client.sessionId);
    if (!playerId) {
      return;
    }

    if (this.closing) {
      this.sessionIdByPlayerId.delete(playerId);
      return;
    }

    if (this.sessionIdByPlayerId.get(playerId) === client.sessionId) {
      this.sessionIdByPlayerId.delete(playerId);
      this.core.markReconnecting(playerId);
    }

    if (!this.core.hasOnlinePlayers()) {
      this.scheduleEmptyRoomCleanup();
    }
  }

  override onDispose(): void {
    roomRegistry().unregister(this.roomCode);
    this.cancelEmptyRoomTimer();
  }

  private bindPlayer(sessionId: string, playerId: string): void {
    const previousSessionId = this.sessionIdByPlayerId.get(playerId);
    if (previousSessionId) {
      this.playerIdBySessionId.delete(previousSessionId);
    }
    this.playerIdBySessionId.set(sessionId, playerId);
    this.sessionIdByPlayerId.set(playerId, sessionId);
  }

  private unbindPlayer(playerId: string): void {
    const sessionId = this.sessionIdByPlayerId.get(playerId);
    if (!sessionId) {
      return;
    }
    this.sessionIdByPlayerId.delete(playerId);
    this.playerIdBySessionId.delete(sessionId);
    this.pendingJoinBySessionId.delete(sessionId);
  }

  private clientForPlayer(playerId: string): Client | undefined {
    const sessionId = this.sessionIdByPlayerId.get(playerId);
    return sessionId ? this.clients.find((client) => client.sessionId === sessionId) : undefined;
  }

  private sendInitialSnapshot(client: Client): void {
    const pendingJoin = this.pendingJoinBySessionId.get(client.sessionId);
    if (pendingJoin) {
      client.send(MESSAGE_CHANNEL.event, {
        type: "room:joined",
        result: pendingJoin,
      } satisfies ServerEvent);
      this.pendingJoinBySessionId.delete(client.sessionId);
    }

    client.send(MESSAGE_CHANNEL.event, {
      type: "room:state",
      state: this.core.toState(),
    } satisfies ServerEvent);

    const playerId = this.playerIdBySessionId.get(client.sessionId);
    const privateState = playerId ? this.core.getPrivateStateFor(playerId) : undefined;
    if (privateState !== undefined) {
      client.send(MESSAGE_CHANNEL.event, {
        type: "game:privateState",
        state: privateState,
      } satisfies ServerEvent);
    }
  }

  private sendErrorToClient(
    client: Client | undefined,
    code: ErrorCode,
    devMessage: string,
  ): void {
    if (!client) {
      return;
    }
    client.send(MESSAGE_CHANNEL.event, {
      type: "error",
      code,
      message: ERROR_MESSAGES[code] ?? devMessage,
      retryable: RETRYABLE_ERRORS.has(code),
    } satisfies ServerEvent);
  }

  private closeRoom(): void {
    this.closing = true;
    this.cancelEmptyRoomTimer();
    this.broadcast(MESSAGE_CHANNEL.event, {
      type: "error",
      code: "ROOM_CLOSED",
      message: ERROR_MESSAGES.ROOM_CLOSED,
      retryable: RETRYABLE_ERRORS.has("ROOM_CLOSED"),
    } satisfies ServerEvent);
    for (const client of this.clients) {
      void client.leave(ROOM_CLOSE_CODE);
    }
    void this.disconnect();
  }

  private scheduleEmptyRoomCleanup(): void {
    this.cancelEmptyRoomTimer();
    const ttlMs = getServerConfig().EMPTY_ROOM_TTL_SECONDS * 1000;
    this.emptyRoomTimer = setTimeout(() => {
      if (!this.core.hasOnlinePlayers()) {
        void this.disconnect();
      }
    }, ttlMs);
  }

  private cancelEmptyRoomTimer(): void {
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }
  }
}
