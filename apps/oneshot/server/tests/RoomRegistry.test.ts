import { describe, expect, it } from "vitest";
import { RoomRegistry } from "../src/rooms/RoomRegistry";

describe("RoomRegistry", () => {
  it("reserves unique room codes before activation", () => {
    const registry = new RoomRegistry({
      ROOM_CODE_ALPHABET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
      ROOM_CODE_LENGTH: 5,
    });

    const first = registry.reserveCode();
    const second = registry.reserveCode();

    expect(first).toHaveLength(5);
    expect(second).toHaveLength(5);
    expect(second).not.toBe(first);
    expect(registry.isAllocated(first)).toBe(true);
    expect(registry.isAllocated(second)).toBe(true);
  });

  it("moves reserved codes into active summaries and unregisters them", () => {
    const registry = new RoomRegistry({
      ROOM_CODE_ALPHABET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
      ROOM_CODE_LENGTH: 5,
    });
    const roomCode = registry.reserveCode();

    registry.register(roomCode, {
      summary: () => ({
        roomId: "room-1",
        roomCode,
        phase: "lobby",
        playerCount: 0,
        selectedGameId: "kinggame",
        activeGameId: null,
        exists: true,
      }),
    });

    expect(registry.summary(roomCode)?.roomId).toBe("room-1");
    registry.unregister(roomCode);
    expect(registry.summary(roomCode)).toBeNull();
    expect(registry.isAllocated(roomCode)).toBe(false);
  });
});
