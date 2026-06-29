import { describe, expect, it } from "vitest";
import type { KingGameMode, PublicPlayerState } from "@oneshot/shared";
import { KING_ACTIONS } from "@oneshot/shared";
import { KingGameModule } from "../src/games/kinggame/KingGameModule";

const makePlayers = (count: number): PublicPlayerState[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    nickname: `P${index + 1}`,
    avatarKey: `shot-${index + 1}`,
    themeId: "cyber",
    seatIndex: index,
    isHost: index === 0,
    connectionStatus: "online",
    joinedAt: index,
    lastSeenAt: index,
  }));

const act = (
  module: KingGameModule,
  playerId: string,
  type: string,
  payload: unknown,
  isHost = false,
) =>
  module.handleAction({
    playerId,
    action: { type, payload, clientActionId: "test" },
    isHost,
  });

const startGame = (count: number, seed = "seed") => {
  const module = new KingGameModule();
  const players = makePlayers(count);
  module.start({ players, options: {}, randomSeed: seed });
  return { module, players, host: players[0]! };
};

const configure = (
  module: KingGameModule,
  host: PublicPlayerState,
  mode: KingGameMode,
  customMissions?: unknown,
) => act(module, host.id, KING_ACTIONS.configure, { mode, customMissions }, true);

describe("KingGameModule — setup", () => {
  it("starts in setup with no king, mode, or numbers", () => {
    const { module } = startGame(4);
    const state = module.getPublicState();
    expect(state.phase).toBe("setup");
    expect(state.mode).toBeNull();
    expect(state.kingPlayerId).toBeNull();
    expect(state.round).toBe(0);
    expect(state.availableNumbers).toEqual([]);
  });

  it("only the host can configure", () => {
    const { module, players } = startGame(4);
    const nonHost = players[1]!;
    expect(act(module, nonHost.id, KING_ACTIONS.configure, { mode: "mild" }, false)).toMatchObject({
      ok: false,
      code: "HOST_ONLY",
    });
    expect(module.getPublicState().phase).toBe("setup");
  });

  it("rejects an unknown mode and double configuration", () => {
    const { module, host } = startGame(4);
    expect(act(module, host.id, KING_ACTIONS.configure, { mode: "nope" }, true)).toMatchObject({
      ok: false,
      code: "INVALID_ACTION",
    });
    expect(configure(module, host, "mild")).toMatchObject({ ok: true });
    expect(configure(module, host, "spicy")).toMatchObject({ ok: false, code: "INVALID_ACTION" });
  });
});

describe("KingGameModule — dealing", () => {
  it("deals exactly one king and unique numbers 1..N-1 every turn", () => {
    for (let round = 0; round < 100; round += 1) {
      const { module, players, host } = startGame(8, `deal-${round}`);
      configure(module, host, "mild");

      const states = players.map((p) => module.getStateFor(p.id));
      expect(states.filter((s) => s.role === "king")).toHaveLength(1);
      const numbers = states.filter((s) => s.role === "subject").map((s) => s.number);
      expect(new Set(numbers).size).toBe(players.length - 1);
      expect([...numbers].sort((a, b) => Number(a) - Number(b))).toEqual([1, 2, 3, 4, 5, 6, 7]);

      // king number is null; public king id matches the king-role player
      const king = module.getPublicState().kingPlayerId;
      expect(states.find((s) => s.role === "king")).toMatchObject({ number: null });
      expect(king).toBeTruthy();
    }
  });

  it("re-deals on nextTurn and increments the round", () => {
    const { module, host } = startGame(6, "redeal");
    configure(module, host, "free");
    expect(module.getPublicState().round).toBe(1);
    const king1 = module.getPublicState().kingPlayerId!;
    expect(act(module, king1, KING_ACTIONS.nextTurn, undefined)).toMatchObject({ ok: true });
    expect(module.getPublicState().round).toBe(2);
    expect(module.getPublicState().kingPlayerId).toBeTruthy();
  });
});

describe("KingGameModule — free mode", () => {
  it("has no mission and lets the king advance turns", () => {
    const { module, host } = startGame(4);
    configure(module, host, "free");
    const king = module.getPublicState().kingPlayerId!;
    expect(module.getStateFor(king).pendingMission).toBeNull();
    // reveal is meaningless in free mode
    expect(act(module, king, KING_ACTIONS.reveal, { targetNumbers: [1] })).toMatchObject({
      ok: false,
      code: "INVALID_ACTION",
    });
    expect(act(module, king, KING_ACTIONS.nextTurn, undefined)).toMatchObject({ ok: true });
  });

  it("forbids a non-king non-host from advancing", () => {
    const { module, players, host } = startGame(4);
    configure(module, host, "free");
    const king = module.getPublicState().kingPlayerId!;
    const other = players.find((p) => p.id !== king && p.id !== host.id)!;
    expect(act(module, other.id, KING_ACTIONS.nextTurn, undefined, false)).toMatchObject({
      ok: false,
      code: "NOT_YOUR_TURN",
    });
  });
});

describe("KingGameModule — random mode reveal", () => {
  it("shows the pending mission only to the king and never in public state", () => {
    const { module, players, host } = startGame(5, "secret");
    configure(module, host, "spicy");
    const king = module.getPublicState().kingPlayerId!;

    expect(module.getStateFor(king).pendingMission).not.toBeNull();
    for (const p of players) {
      if (p.id !== king) expect(module.getStateFor(p.id).pendingMission).toBeNull();
    }
    // public state has no pendingMission field and no command yet
    const pub = module.getPublicState();
    expect(pub.command).toBeNull();
    expect(JSON.stringify(pub)).not.toContain("pendingMission");
  });

  it("lets only the king reveal, then exposes the command with targets + revealAt", () => {
    const { module, players, host } = startGame(5, "reveal");
    configure(module, host, "mild");
    const king = module.getPublicState().kingPlayerId!;
    const slots = module.getStateFor(king).pendingMission!.slots;
    const targetNumbers = module.getPublicState().availableNumbers.slice(0, slots);

    const subject = players.find((p) => p.id !== king)!;
    expect(act(module, subject.id, KING_ACTIONS.reveal, { targetNumbers })).toMatchObject({
      ok: false,
      code: "NOT_YOUR_TURN",
    });

    expect(act(module, king, KING_ACTIONS.reveal, { targetNumbers })).toMatchObject({ ok: true });
    const cmd = module.getPublicState().command!;
    expect(module.getPublicState().phase).toBe("revealed");
    expect(cmd.targets.map((t) => t.number)).toEqual(targetNumbers);
    expect(cmd.revealAt).toBeGreaterThan(0);
    // each target number maps to the player actually holding it
    for (const t of cmd.targets) {
      expect(module.getStateFor(t.playerId).number).toBe(t.number);
    }
    // after reveal the king's pending mission is no longer exposed
    expect(module.getStateFor(king).pendingMission).toBeNull();
  });

  it("rejects wrong target counts and duplicate/unknown numbers", () => {
    const { module, host } = startGame(5, "validate");
    configure(module, host, "mild");
    const king = module.getPublicState().kingPlayerId!;
    const slots = module.getStateFor(king).pendingMission!.slots;
    const numbers = module.getPublicState().availableNumbers;

    expect(act(module, king, KING_ACTIONS.reveal, { targetNumbers: [] })).toMatchObject({
      ok: false,
      code: "INVALID_ACTION",
    });
    expect(act(module, king, KING_ACTIONS.reveal, { targetNumbers: [999] })).toMatchObject({
      ok: false,
      code: "INVALID_ACTION",
    });
    if (slots === 2) {
      expect(
        act(module, king, KING_ACTIONS.reveal, { targetNumbers: [numbers[0], numbers[0]] }),
      ).toMatchObject({ ok: false, code: "INVALID_ACTION" });
    }
  });

  it("rejects non-number target payloads instead of coercing them", () => {
    const { module, host } = startGame(5, "coerce");
    configure(module, host, "mild");
    const king = module.getPublicState().kingPlayerId!;
    const slots = module.getStateFor(king).pendingMission!.slots;
    const stringTargets = module.getPublicState().availableNumbers.slice(0, slots).map(String);
    expect(act(module, king, KING_ACTIONS.reveal, { targetNumbers: stringTargets })).toMatchObject({
      ok: false,
      code: "INVALID_ACTION",
    });
    expect(module.getPublicState().phase).toBe("command");
  });
});

describe("KingGameModule — two players", () => {
  it("never rolls a 2-target mission when only one number exists", () => {
    for (let round = 0; round < 50; round += 1) {
      const { module, host } = startGame(2, `two-${round}`);
      configure(module, host, "spicy");
      const king = module.getPublicState().kingPlayerId!;
      expect(module.getPublicState().availableNumbers).toEqual([1]);
      expect(module.getStateFor(king).pendingMission!.slots).toBe(1);
    }
  });
});

describe("KingGameModule — custom mode", () => {
  it("accepts a mix of preset and typed missions", () => {
    const { module, host } = startGame(5, "custom-ok");
    const res = configure(module, host, "custom", [
      { kind: "preset", missionId: "mild-s1-01" },
      { kind: "custom", text: "원샷하기", slots: 1 },
      { kind: "custom", text: "둘이 손잡고 한 바퀴", slots: 2 },
    ]);
    expect(res).toMatchObject({ ok: true });
    expect(module.getPublicState().customMissionCount).toBe(3);
    const king = module.getPublicState().kingPlayerId!;
    expect(module.getStateFor(king).pendingMission).not.toBeNull();
  });

  it("rejects an empty pool and an unknown preset", () => {
    const a = startGame(5, "custom-empty");
    expect(configure(a.module, a.host, "custom", [])).toMatchObject({
      ok: false,
      code: "INVALID_ACTION",
    });
    const b = startGame(5, "custom-badpreset");
    expect(
      configure(b.module, b.host, "custom", [{ kind: "preset", missionId: "does-not-exist" }]),
    ).toMatchObject({ ok: false, code: "INVALID_ACTION" });
  });

  it("requires a 1-target mission for a 2-player room", () => {
    const a = startGame(2, "custom-2p-bad");
    expect(
      configure(a.module, a.host, "custom", [{ kind: "custom", text: "둘이 백허그", slots: 2 }]),
    ).toMatchObject({ ok: false, code: "INVALID_ACTION" });

    const b = startGame(2, "custom-2p-ok");
    expect(
      configure(b.module, b.host, "custom", [{ kind: "custom", text: "원샷", slots: 1 }]),
    ).toMatchObject({ ok: true });
  });
});

describe("KingGameModule — ending", () => {
  it("only the host can end the game, producing a neutral result", () => {
    const { module, players, host } = startGame(4);
    configure(module, host, "free");
    const nonHost = players[1]!;
    expect(act(module, nonHost.id, KING_ACTIONS.endGame, undefined, false)).toMatchObject({
      ok: false,
      code: "HOST_ONLY",
    });
    expect(module.isOver()).toBeNull();
    expect(act(module, host.id, KING_ACTIONS.endGame, undefined, true)).toMatchObject({ ok: true });
    const result = module.isOver();
    expect(result).not.toBeNull();
    expect(result!.ranking).toEqual([]);
    expect(result!.winnerPlayerIds).toEqual([]);
  });
});

describe("KingGameModule — kick / removal", () => {
  it("prunes a kicked player so future turns never deal them a card", () => {
    const { module, players, host } = startGame(4, "kick");
    configure(module, host, "free");
    const victim = players.find((p) => p.id !== host.id)!;
    module.onPlayerRemoved(victim.id);

    for (let i = 0; i < 30; i += 1) {
      act(module, host.id, KING_ACTIONS.nextTurn, undefined, true);
      expect(module.getStateFor(victim.id)).toMatchObject({ role: "subject", number: null });
      expect(module.getPublicState().kingPlayerId).not.toBe(victim.id);
      expect(module.getPublicState().availableNumbers).toEqual([1, 2]);
    }
  });

  it("restores the 2-player number guarantee after a kick down to two", () => {
    const { module, players, host } = startGame(3, "kick2");
    configure(module, host, "spicy");
    const victim = players.find((p) => p.id !== host.id)!;
    module.onPlayerRemoved(victim.id);
    act(module, host.id, KING_ACTIONS.nextTurn, undefined, true);

    expect(module.getPublicState().availableNumbers).toEqual([1]);
    const king = module.getPublicState().kingPlayerId!;
    expect(module.getStateFor(king).pendingMission!.slots).toBe(1);
  });
});

describe("KingGameModule — bot marathon", () => {
  it("plays many random-mode turns for 2..10 players without breaking", () => {
    for (let count = 2; count <= 10; count += 1) {
      const { module, host } = startGame(count, `bot-${count}`);
      configure(module, host, count % 2 === 0 ? "mild" : "spicy");
      for (let turn = 0; turn < 20; turn += 1) {
        const king = module.getPublicState().kingPlayerId!;
        expect(king).toBeTruthy();
        const slots = module.getStateFor(king).pendingMission!.slots;
        const targetNumbers = module.getPublicState().availableNumbers.slice(0, slots);
        expect(act(module, king, KING_ACTIONS.reveal, { targetNumbers })).toMatchObject({ ok: true });
        expect(module.getPublicState().command!.revealAt).toBeGreaterThan(0);
        expect(act(module, king, KING_ACTIONS.nextTurn, undefined)).toMatchObject({ ok: true });
      }
      expect(module.getPublicState().round).toBe(21);
    }
  });
});
