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

  it("locks avatar changes while a game is running (nickname still updates)", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    joinOrThrow(core, "guest");
    const before = core.toState().players[host.playerId]!.avatarKey;

    core.handleMessage(host.playerId, { type: "room:startGame" });
    expect(core.toState().phase).toBe("game");

    core.handleMessage(host.playerId, {
      type: "room:updateProfile",
      avatarKey: "totally-different-avatar",
      nickname: "Renamed",
    });

    const p = core.toState().players[host.playerId]!;
    expect(p.avatarKey).toBe(before); // avatar is locked mid-game
    expect(p.nickname).toBe("Renamed"); // nickname still changes
  });

  it("a stop vote returns everyone to the lobby with the team kept", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    const guest = joinOrThrow(core, "guest");

    core.handleMessage(host.playerId, { type: "room:selectGame", gameId: "allout" });
    core.handleMessage(host.playerId, { type: "room:startGame" });
    expect(core.toState().phase).toBe("game");

    // leave setup -> play so a stop vote is allowed
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "allout:configure", payload: { totalRounds: 3, bankruptcyOn: false, bankruptcyLimit: 15 }, clientActionId: "c1" },
    });
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "allout:proposeEnd", clientActionId: "c2" },
    });
    core.handleMessage(guest.playerId, {
      type: "game:action",
      action: { type: "allout:voteEnd", payload: { agree: true }, clientActionId: "c3" },
    });

    const st = core.toState();
    expect(st.phase).toBe("lobby"); // straight back to lobby, no results screen
    expect(st.activeGame).toBeNull();
    expect(Object.keys(st.players)).toHaveLength(2); // team preserved
  });

  it("returns to the lobby when an end vote passes via a disconnect hook (no room stall)", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    const g1 = joinOrThrow(core, "g1");
    const g2 = joinOrThrow(core, "g2");

    core.handleMessage(host.playerId, { type: "room:selectGame", gameId: "dice" });
    core.handleMessage(host.playerId, { type: "room:startGame" });
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:configure", payload: { totalRounds: 2 }, clientActionId: "c1" },
    });
    for (const p of [host, g1, g2]) {
      core.handleMessage(p.playerId, {
        type: "game:action",
        action: { type: "dice:roll", clientActionId: `r-${p.playerId}` },
      });
    }
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:nextRound", clientActionId: "c2" },
    });
    // round 2: host opens the vote (1 yes / 3 connected — stays open)
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:proposeEnd", clientActionId: "c3" },
    });
    expect(core.toState().phase).toBe("game");

    // both guests drop: the connected base shrinks to the host alone, so the
    // standing yes vote becomes a majority INSIDE the onPlayerLeave hook.
    core.markReconnecting(g1.playerId);
    core.markReconnecting(g2.playerId);

    const st = core.toState();
    expect(st.phase).toBe("lobby"); // not stuck in "game" with a dead module
    expect(st.activeGame).toBeNull();
  });

  it("returns to the lobby when an end vote passes via a reconnect hook (no room stall)", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    const b = joinOrThrow(core, "b");
    const c = joinOrThrow(core, "c");
    const d = joinOrThrow(core, "d");
    const e = joinOrThrow(core, "e");

    core.handleMessage(host.playerId, { type: "room:selectGame", gameId: "dice" });
    core.handleMessage(host.playerId, { type: "room:startGame" });
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:configure", payload: { totalRounds: 2 }, clientActionId: "c1" },
    });
    for (const p of [host, b, c, d, e]) {
      core.handleMessage(p.playerId, {
        type: "game:action",
        action: { type: "dice:roll", clientActionId: `r-${p.playerId}` },
      });
    }
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:nextRound", clientActionId: "c2" },
    });
    // round 2: host + b vote yes (2/5 — open), then b drops (counted yes = 1 of 4)
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:proposeEnd", clientActionId: "c3" },
    });
    core.handleMessage(b.playerId, {
      type: "game:action",
      action: { type: "dice:voteEnd", payload: { agree: true }, clientActionId: "c4" },
    });
    core.markReconnecting(b.playerId);
    core.handleMessage(c.playerId, {
      type: "game:action",
      action: { type: "dice:voteEnd", payload: { agree: true }, clientActionId: "c5" },
    });
    expect(core.toState().phase).toBe("game"); // 2 yes of 4 connected — still open

    // b returns: standing yes votes host+b+c = 3 of 5 — the majority is enacted
    // INSIDE onPlayerReturn, so the reconnect path itself must sweep isOver().
    const back = core.reconnect({ reconnectToken: b.reconnectToken });
    expect(back).toMatchObject({ ok: true });

    const st = core.toState();
    expect(st.phase).toBe("lobby");
    expect(st.activeGame).toBeNull();
  });

  it("returns to the lobby when an end vote passes via a kick hook (no room stall)", () => {
    const core = createCore();
    const host = joinOrThrow(core, "host");
    const g1 = joinOrThrow(core, "g1");
    const g2 = joinOrThrow(core, "g2");
    const g3 = joinOrThrow(core, "g3");

    core.handleMessage(host.playerId, { type: "room:selectGame", gameId: "dice" });
    core.handleMessage(host.playerId, { type: "room:startGame" });
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:configure", payload: { totalRounds: 2 }, clientActionId: "c1" },
    });
    for (const p of [host, g1, g2, g3]) {
      core.handleMessage(p.playerId, {
        type: "game:action",
        action: { type: "dice:roll", clientActionId: `r-${p.playerId}` },
      });
    }
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:nextRound", clientActionId: "c2" },
    });
    // 2 yes / 4 connected — not a majority yet
    core.handleMessage(host.playerId, {
      type: "game:action",
      action: { type: "dice:proposeEnd", clientActionId: "c3" },
    });
    core.handleMessage(g1.playerId, {
      type: "game:action",
      action: { type: "dice:voteEnd", payload: { agree: true }, clientActionId: "c4" },
    });
    expect(core.toState().phase).toBe("game");

    // kicking a non-voter shrinks the base to 3 → 2 yes passes INSIDE the hook
    core.handleMessage(host.playerId, { type: "room:kickPlayer", playerId: g2.playerId });

    const st = core.toState();
    expect(st.phase).toBe("lobby");
    expect(st.activeGame).toBeNull();
    expect(st.players[g2.playerId]).toBeUndefined();
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
