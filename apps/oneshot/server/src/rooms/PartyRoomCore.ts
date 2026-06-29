import type {
  ClientToServerMessage,
  ErrorCode,
  GameCatalogItem,
  GameId,
  JoinResult,
  PartyRoomState,
  PublicPlayerState,
} from "@oneshot/shared";
import { gameCatalog, normalizeNickname } from "@oneshot/shared";
import { createRandomSeed } from "../core/Randomizer";
import {
  createReconnectSecret,
  decodeReconnectToken,
  encodeReconnectToken,
  hashReconnectSecret,
  verifyReconnectSecret,
} from "../core/ReconnectToken";
import type { GameModule } from "../games/GameModule";
import { getGameModule, isGameAvailable } from "../games/registry";
import type { RoomSummary } from "./RoomRegistry";

type SessionRecord = {
  playerId: string;
  reconnectTokenHash: string;
  createdAt: number;
  lastSeenAt: number;
};

export type PartyRoomCoreCallbacks = {
  broadcastRoomState(state: PartyRoomState): void;
  sendPrivateState(playerId: string, state: unknown): void;
  sendError(playerId: string, code: ErrorCode, devMessage: string): void;
  kickPlayer(playerId: string): void;
  closeRoom(): void;
};

export type JoinFailure = {
  ok: false;
  code: ErrorCode;
  message: string;
};

export type JoinOutcome = {
  ok: true;
  result: JoinResult;
  isNew: boolean;
};

type PartyRoomCoreOptions = {
  roomId: string;
  roomCode: string;
  sessionSecret: string;
  now?: () => number;
};

const noopCallbacks: PartyRoomCoreCallbacks = {
  broadcastRoomState: () => {},
  sendPrivateState: () => {},
  sendError: () => {},
  kickPlayer: () => {},
  closeRoom: () => {},
};

export class PartyRoomCore {
  private readonly sessionSecret: string;
  private readonly now: () => number;
  private readonly roomState: PartyRoomState;
  private selectedGameOptions: Record<string, unknown> = {};
  private activeGame: GameModule<unknown, unknown, unknown> | null = null;
  private readonly sessionsByPlayerId = new Map<string, SessionRecord>();
  private callbacks = noopCallbacks;

  constructor(options: PartyRoomCoreOptions) {
    const now = options.now?.() ?? Date.now();
    this.sessionSecret = options.sessionSecret;
    this.now = options.now ?? Date.now;
    this.roomState = {
      roomId: options.roomId,
      roomCode: options.roomCode,
      phase: "lobby",
      hostPlayerId: "",
      temporaryHostPlayerId: null,
      selectedGameId: "kinggame",
      players: {},
      activeGame: null,
      catalog: gameCatalog,
      createdAt: now,
      updatedAt: now,
    };
  }

  setCallbacks(callbacks: Partial<PartyRoomCoreCallbacks>): void {
    this.callbacks = { ...noopCallbacks, ...callbacks };
  }

  join(input: { nickname?: string; avatarKey?: string; themeId?: string }): JoinOutcome | JoinFailure {
    if (this.roomState.phase === "game") {
      return {
        ok: false,
        code: "GAME_ALREADY_RUNNING",
        message: "진행 중인 게임에는 새로 입장할 수 없습니다.",
      };
    }

    const nickname = this.parseNickname(input.nickname);
    if (!nickname) {
      return { ok: false, code: "INVALID_NICKNAME", message: "닉네임을 입력해주세요." };
    }

    const playerId = crypto.randomUUID();
    const secret = createReconnectSecret();
    const reconnectToken = encodeReconnectToken(this.roomState.roomCode, secret);
    const now = this.now();
    const firstPlayer = this.getPlayers().length === 0;

    this.roomState.players[playerId] = {
      id: playerId,
      nickname,
      avatarKey: this.parseAvatarKey(input.avatarKey) ?? this.createAvatarKey(playerId),
      themeId: this.parseThemeId(input.themeId),
      seatIndex: this.nextSeatIndex(),
      isHost: firstPlayer,
      connectionStatus: "online",
      joinedAt: now,
      lastSeenAt: now,
    };

    if (firstPlayer) {
      this.roomState.hostPlayerId = playerId;
    }

    this.sessionsByPlayerId.set(playerId, {
      playerId,
      reconnectTokenHash: hashReconnectSecret(secret, this.sessionSecret),
      createdAt: now,
      lastSeenAt: now,
    });

    this.reconcileHost();
    this.touch();
    this.broadcastEverything();
    return {
      ok: true,
      result: {
        roomId: this.roomState.roomId,
        roomCode: this.roomState.roomCode,
        playerId,
        reconnectToken,
      },
      isNew: true,
    };
  }

  reconnect(input: { reconnectToken: string }): JoinOutcome | JoinFailure {
    const envelope = decodeReconnectToken(input.reconnectToken);
    if (!envelope || envelope.roomCode !== this.roomState.roomCode) {
      return {
        ok: false,
        code: "RECONNECT_FAILED",
        message: "재접속 정보를 확인할 수 없습니다.",
      };
    }

    const session = [...this.sessionsByPlayerId.values()].find((candidate) =>
      verifyReconnectSecret(envelope.secret, this.sessionSecret, candidate.reconnectTokenHash),
    );
    if (!session) {
      return { ok: false, code: "RECONNECT_FAILED", message: "재접속 세션이 만료됐습니다." };
    }

    const player = this.roomState.players[session.playerId];
    if (!player) {
      return { ok: false, code: "RECONNECT_FAILED", message: "플레이어를 복원할 수 없습니다." };
    }

    session.lastSeenAt = this.now();
    player.connectionStatus = "online";
    player.lastSeenAt = session.lastSeenAt;
    this.activeGame?.onPlayerReturn(session.playerId);

    this.reconcileHost();
    this.touch();
    this.broadcastEverything();
    return {
      ok: true,
      result: {
        roomId: this.roomState.roomId,
        roomCode: this.roomState.roomCode,
        playerId: session.playerId,
        reconnectToken: input.reconnectToken,
      },
      isNew: false,
    };
  }

  markReconnecting(playerId: string): void {
    const player = this.roomState.players[playerId];
    if (!player) {
      return;
    }

    player.connectionStatus = "reconnecting";
    player.lastSeenAt = this.now();
    const session = this.sessionsByPlayerId.get(playerId);
    if (session) {
      session.lastSeenAt = player.lastSeenAt;
    }
    this.activeGame?.onPlayerLeave(playerId);
    this.reconcileHost();
    this.touch();
    this.broadcastEverything();
  }

  handleMessage(playerId: string, message: ClientToServerMessage): void {
    if (!this.roomState.players[playerId]) {
      return;
    }

    switch (message.type) {
      case "room:updateNickname":
        this.updateNickname(playerId, message.nickname);
        return;
      case "room:updateProfile":
        this.updateProfile(playerId, message);
        return;
      case "room:selectGame":
        this.selectGame(playerId, message.gameId, message.options ?? {});
        return;
      case "room:startGame":
        this.startGame(playerId);
        return;
      case "room:returnToLobby":
        this.returnToLobby(playerId);
        return;
      case "room:close":
        this.closeRoom(playerId);
        return;
      case "room:kickPlayer":
        this.kickPlayer(playerId, message.playerId);
        return;
      case "game:action":
        this.handleGameAction(playerId, message.action);
        return;
    }
  }

  toState(): PartyRoomState {
    return this.publicState();
  }

  toSummary(): RoomSummary {
    return {
      roomId: this.roomState.roomId,
      roomCode: this.roomState.roomCode,
      phase: this.roomState.phase,
      playerCount: this.getPlayers().length,
      selectedGameId: this.roomState.selectedGameId,
      activeGameId: this.roomState.activeGame?.gameId ?? null,
      exists: true,
    };
  }

  getPrivateStateFor(playerId: string): unknown {
    return this.activeGame?.getStateFor(playerId);
  }

  hasOnlinePlayers(): boolean {
    return this.getPlayers().some((player) => player.connectionStatus === "online");
  }

  private updateNickname(playerId: string, nicknameInput: string): void {
    const nickname = this.parseNickname(nicknameInput);
    if (!nickname) {
      this.callbacks.sendError(playerId, "INVALID_NICKNAME", "닉네임은 1-16자로 입력해주세요.");
      return;
    }
    const player = this.roomState.players[playerId];
    if (player) {
      player.nickname = nickname;
      player.lastSeenAt = this.now();
      this.touch();
      this.broadcastEverything();
    }
  }

  private updateProfile(
    playerId: string,
    input: { nickname?: string; avatarKey?: string; themeId?: string },
  ): void {
    const player = this.roomState.players[playerId];
    if (!player) {
      return;
    }
    if (input.nickname !== undefined) {
      const nickname = this.parseNickname(input.nickname);
      if (nickname) {
        player.nickname = nickname;
      }
    }
    const avatarKey = this.parseAvatarKey(input.avatarKey);
    if (avatarKey) {
      player.avatarKey = avatarKey;
    }
    if (input.themeId !== undefined) {
      player.themeId = this.parseThemeId(input.themeId);
    }
    player.lastSeenAt = this.now();
    this.touch();
    this.broadcastEverything();
  }

  private selectGame(playerId: string, gameId: GameId, options: Record<string, unknown>): void {
    if (!this.requireHost(playerId)) {
      return;
    }
    if (this.roomState.phase !== "lobby") {
      this.callbacks.sendError(playerId, "GAME_ALREADY_RUNNING", "게임 중에는 다른 게임을 고를 수 없습니다.");
      return;
    }
    if (!isGameAvailable(gameId)) {
      this.callbacks.sendError(playerId, "GAME_NOT_FOUND", "아직 준비 중인 게임입니다.");
      return;
    }
    this.roomState.selectedGameId = gameId;
    this.selectedGameOptions = options;
    this.touch();
    this.broadcastEverything();
  }

  private startGame(playerId: string): void {
    if (!this.requireHost(playerId)) {
      return;
    }
    if (this.roomState.phase !== "lobby") {
      this.callbacks.sendError(playerId, "GAME_ALREADY_RUNNING", "이미 게임이 진행 중입니다.");
      return;
    }

    const selectedGame = this.findCatalogItem(this.roomState.selectedGameId);
    const players = this.getPlayers().sort((left, right) => left.seatIndex - right.seatIndex);
    if (!selectedGame || !isGameAvailable(selectedGame.id)) {
      this.callbacks.sendError(playerId, "GAME_NOT_FOUND", "선택한 게임을 시작할 수 없습니다.");
      return;
    }
    if (players.length < selectedGame.minPlayers) {
      this.callbacks.sendError(playerId, "NOT_ENOUGH_PLAYERS", `${selectedGame.minPlayers}명 이상 필요합니다.`);
      return;
    }

    const module = getGameModule(selectedGame.id);
    if (!module) {
      this.callbacks.sendError(playerId, "GAME_NOT_FOUND", "게임 모듈을 찾지 못했습니다.");
      return;
    }

    const options = { ...selectedGame.defaultOptions, ...this.selectedGameOptions };
    try {
      module.start({ players, options, randomSeed: createRandomSeed() });
    } catch {
      this.callbacks.sendError(playerId, "INVALID_ACTION", "게임을 시작할 수 없습니다.");
      return;
    }
    this.activeGame = module;
    this.roomState.phase = "game";
    this.roomState.activeGame = {
      gameId: module.id,
      startedAt: this.now(),
      publicState: module.getPublicState(),
      result: null,
    };
    this.touch();
    this.broadcastEverything();
  }

  private handleGameAction(playerId: string, action: { type: string; payload?: unknown; clientActionId: string }): void {
    if (!this.activeGame || !this.roomState.activeGame) {
      this.callbacks.sendError(playerId, "INVALID_ACTION", "진행 중인 게임이 없습니다.");
      return;
    }

    const result = this.activeGame.handleAction({ playerId, action });
    if (!result.ok) {
      this.callbacks.sendError(playerId, result.code, result.message);
      return;
    }

    const gameResult = this.activeGame.isOver();
    this.roomState.activeGame = {
      ...this.roomState.activeGame,
      publicState: this.activeGame.getPublicState(),
      result: gameResult,
    };
    if (gameResult) {
      this.roomState.phase = "results";
    }
    this.touch();
    this.broadcastEverything();
  }

  private returnToLobby(playerId: string): void {
    if (!this.requireHost(playerId)) {
      return;
    }
    if (this.roomState.phase !== "results") {
      this.callbacks.sendError(playerId, "INVALID_ACTION", "결과 화면에서만 방으로 돌아갈 수 있습니다.");
      return;
    }
    this.activeGame = null;
    this.roomState.phase = "lobby";
    this.roomState.activeGame = null;
    this.touch();
    this.broadcastEverything();
  }

  private closeRoom(playerId: string): void {
    if (!this.requireHost(playerId)) {
      return;
    }
    this.callbacks.closeRoom();
  }

  private kickPlayer(playerId: string, targetPlayerId: string): void {
    if (!this.requireHost(playerId)) {
      return;
    }
    if (playerId === targetPlayerId) {
      this.callbacks.sendError(playerId, "INVALID_ACTION", "자기 자신은 내보낼 수 없습니다.");
      return;
    }
    if (!this.roomState.players[targetPlayerId]) {
      this.callbacks.sendError(playerId, "INVALID_ACTION", "없는 참가자입니다.");
      return;
    }

    delete this.roomState.players[targetPlayerId];
    this.sessionsByPlayerId.delete(targetPlayerId);
    this.activeGame?.onPlayerLeave(targetPlayerId);
    this.callbacks.kickPlayer(targetPlayerId);

    if (this.roomState.hostPlayerId === targetPlayerId) {
      this.roomState.hostPlayerId = this.getPlayers()[0]?.id ?? "";
    }
    this.reconcileHost();
    this.touch();
    this.broadcastEverything();
  }

  private requireHost(playerId: string): boolean {
    if (playerId !== this.effectiveHostPlayerId()) {
      this.callbacks.sendError(playerId, "HOST_ONLY", "방장만 할 수 있습니다.");
      return false;
    }
    return true;
  }

  private effectiveHostPlayerId(): string {
    return this.roomState.temporaryHostPlayerId ?? this.roomState.hostPlayerId;
  }

  private reconcileHost(): void {
    const players = this.getPlayers().sort((left, right) => left.joinedAt - right.joinedAt);
    if (players.length === 0) {
      this.roomState.hostPlayerId = "";
      this.roomState.temporaryHostPlayerId = null;
      return;
    }
    if (!this.roomState.hostPlayerId || !this.roomState.players[this.roomState.hostPlayerId]) {
      this.roomState.hostPlayerId = players[0]?.id ?? "";
    }

    const originalHost = this.roomState.players[this.roomState.hostPlayerId];
    if (originalHost?.connectionStatus === "online") {
      this.roomState.temporaryHostPlayerId = null;
    } else {
      this.roomState.temporaryHostPlayerId =
        players.find((player) => player.connectionStatus === "online")?.id ?? null;
    }

    const effectiveHost = this.effectiveHostPlayerId();
    for (const player of players) {
      player.isHost = player.id === effectiveHost;
    }
  }

  private getPlayers(): PublicPlayerState[] {
    return Object.values(this.roomState.players);
  }

  private nextSeatIndex(): number {
    const used = new Set(this.getPlayers().map((player) => player.seatIndex));
    let seatIndex = 0;
    while (used.has(seatIndex)) {
      seatIndex += 1;
    }
    return seatIndex;
  }

  private parseNickname(nickname: unknown): string | null {
    if (typeof nickname !== "string") {
      return null;
    }
    const normalized = normalizeNickname(nickname);
    return normalized.length >= 1 ? normalized : null;
  }

  private createAvatarKey(playerId: string): string {
    const index = Array.from(playerId).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 8;
    return `shot-${index + 1}`;
  }

  private parseAvatarKey(avatarKey: unknown): string | null {
    if (typeof avatarKey !== "string") {
      return null;
    }
    const trimmed = avatarKey.trim().slice(0, 40);
    return /^[a-z0-9-]+$/i.test(trimmed) ? trimmed : null;
  }

  private parseThemeId(themeId: unknown): string {
    if (typeof themeId !== "string") {
      return "cyber";
    }
    const trimmed = themeId.trim().slice(0, 24);
    return /^[a-z0-9-]+$/i.test(trimmed) ? trimmed : "cyber";
  }

  private findCatalogItem(gameId: GameId): GameCatalogItem | null {
    return this.roomState.catalog.find((item) => item.id === gameId) ?? null;
  }

  private broadcastEverything(): void {
    this.reconcileHost();
    const state = this.publicState();
    this.callbacks.broadcastRoomState(state);
    if (!this.activeGame) {
      return;
    }
    for (const playerId of Object.keys(state.players)) {
      this.callbacks.sendPrivateState(playerId, this.activeGame.getStateFor(playerId));
    }
  }

  private publicState(): PartyRoomState {
    return {
      ...this.roomState,
      players: Object.fromEntries(
        this.getPlayers().map((player) => [
          player.id,
          { ...player, isHost: player.id === this.effectiveHostPlayerId() },
        ]),
      ),
      activeGame: this.roomState.activeGame
        ? {
            ...this.roomState.activeGame,
            publicState: this.activeGame?.getPublicState() ?? this.roomState.activeGame.publicState,
          }
        : null,
    };
  }

  private touch(): void {
    this.roomState.updatedAt = this.now();
  }
}
