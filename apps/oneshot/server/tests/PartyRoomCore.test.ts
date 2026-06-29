import { describe, expect, it } from "vitest";
import { PartyRoomCore } from "../src/rooms/PartyRoomCore";

const createCore = (): PartyRoomCore => {
  let clock = 0;
  return new PartyRoomCore({
    roomId: "room-core-test",
    roomCode: "ABCDE",
    sessionSecret: "test-secret-value",
    now: () => {
      clock += 1;
      return clock;
    },
  });
};

const joinOrThrow = (core: PartyRoomCore, nickname: string) => {
  const outcome = core.join({ nickname });
  if (!outcome.ok) {
    throw new Error(`join failed: ${outcome.code}`);
  }
  return outcome.result;
};

describe("PartyRoomCore", () => {
  it("assigns host and sequential seats without Colyseus", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    const guest = joinOrThrow(core, "guest");

    const state = core.toState();
    expect(state.players[host.playerId]?.isHost).toBe(true);
    expect(state.players[guest.playerId]?.isHost).toBe(false);
    expect(state.players[host.playerId]?.seatIndex).toBe(0);
    expect(state.players[guest.playerId]?.seatIndex).toBe(1);
  });

  it("accepts joins without a product-level capacity cap", () => {
    const core = createCore();

    for (let index = 0; index < 20; index += 1) {
      joinOrThrow(core, `p${index}`);
    }

    expect(Object.keys(core.toState().players)).toHaveLength(20);
  });

  it("promotes a temporary host and restores the original host on reconnect", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    const guest = joinOrThrow(core, "guest");

    core.markReconnecting(host.playerId);
    let state = core.toState();
    expect(state.temporaryHostPlayerId).toBe(guest.playerId);
    expect(state.players[guest.playerId]?.isHost).toBe(true);

    const back = core.reconnect({ reconnectToken: host.reconnectToken });
    expect(back).toMatchObject({ ok: true });
    state = core.toState();
    expect(state.temporaryHostPlayerId).toBeNull();
    expect(state.players[host.playerId]?.isHost).toBe(true);
  });

  it("keeps game start host-only", () => {
    const core = createCore();
    joinOrThrow(core, "host");
    const guest = joinOrThrow(core, "guest");
    const errors: string[] = [];
    core.setCallbacks({
      sendError: (_playerId, code) => errors.push(code),
    });

    core.handleMessage(guest.playerId, { type: "room:startGame" });

    expect(errors).toContain("HOST_ONLY");
    expect(core.toState().phase).toBe("lobby");
  });

  it("keeps room close host-only and calls the close callback", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    const guest = joinOrThrow(core, "guest");
    const errors: string[] = [];
    let closeCount = 0;
    core.setCallbacks({
      sendError: (_playerId, code) => errors.push(code),
      closeRoom: () => {
        closeCount += 1;
      },
    });

    core.handleMessage(guest.playerId, { type: "room:close" });
    core.handleMessage(host.playerId, { type: "room:close" });

    expect(errors).toContain("HOST_ONLY");
    expect(closeCount).toBe(1);
  });

  it("survives a kick during a game without breaking room state", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    const victim = joinOrThrow(core, "victim");
    joinOrThrow(core, "third");
    const kicked: string[] = [];
    core.setCallbacks({
      kickPlayer: (playerId) => kicked.push(playerId),
    });

    core.handleMessage(host.playerId, { type: "room:startGame" });
    expect(core.toState().phase).toBe("game");

    core.handleMessage(host.playerId, { type: "room:kickPlayer", playerId: victim.playerId });

    expect(kicked).toEqual([victim.playerId]);
    expect(core.toState().players[victim.playerId]).toBeUndefined();
    expect(core.toState().phase).toBe("game");
  });
});
