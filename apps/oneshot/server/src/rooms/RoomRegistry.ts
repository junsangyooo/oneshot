import type { GameId, PartyRoomState } from "@oneshot/shared";
import type { ServerConfig } from "../config/env";
import { getServerConfig } from "../config/env";
import { RoomCodeGenerator } from "../core/RoomCodeGenerator";

export type RoomSummary = {
  roomId: string;
  roomCode: string;
  phase: PartyRoomState["phase"];
  playerCount: number;
  selectedGameId: GameId;
  activeGameId: GameId | null;
  exists: true;
};

type RoomEntry = {
  summary(): RoomSummary;
};

export class RoomRegistry {
  private readonly active = new Map<string, RoomEntry>();
  private readonly reserved = new Set<string>();
  private readonly codeGenerator: RoomCodeGenerator;

  constructor(config: Pick<ServerConfig, "ROOM_CODE_ALPHABET" | "ROOM_CODE_LENGTH">) {
    this.codeGenerator = new RoomCodeGenerator(config);
  }

  reserveCode(): string {
    const roomCode = this.codeGenerator.generate(this.allocatedCodes()).toUpperCase();
    this.reserved.add(roomCode);
    return roomCode;
  }

  releaseReservedCode(roomCode: string): void {
    this.reserved.delete(roomCode.toUpperCase());
  }

  register(roomCodeInput: string, entry: RoomEntry): string {
    const roomCode = roomCodeInput.toUpperCase();
    if (this.active.has(roomCode)) {
      throw new Error(`Room code already active: ${roomCode}`);
    }
    this.reserved.delete(roomCode);
    this.active.set(roomCode, entry);
    return roomCode;
  }

  unregister(roomCode: string): void {
    const normalized = roomCode.toUpperCase();
    this.active.delete(normalized);
    this.reserved.delete(normalized);
  }

  summary(roomCode: string): RoomSummary | null {
    return this.active.get(roomCode.toUpperCase())?.summary() ?? null;
  }

  isAllocated(roomCode: string): boolean {
    const normalized = roomCode.toUpperCase();
    return this.active.has(normalized) || this.reserved.has(normalized);
  }

  private allocatedCodes(): Set<string> {
    return new Set([...this.active.keys(), ...this.reserved]);
  }
}

let singleton: RoomRegistry | null = null;

export const roomRegistry = (): RoomRegistry => {
  singleton ??= new RoomRegistry(getServerConfig());
  return singleton;
};

export const resetRoomRegistryForTests = (): void => {
  singleton = null;
};
