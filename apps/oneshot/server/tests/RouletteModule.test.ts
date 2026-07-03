import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicPlayerState } from "@oneshot/shared";
import { ROULETTE_ACTIONS, ROULETTE_SPIN_MS } from "@oneshot/shared";
import { RouletteModule } from "../src/games/roulette/RouletteModule";

const makePlayers = (count: number): PublicPlayerState[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    nickname: `P${index + 1}`,
    avatarKey: `shot-${index + 1}`,
    themeId: index % 2 === 0 ? "cyber" : "cozy",
    seatIndex: index,
    isHost: index === 0,
    connectionStatus: "online" as const,
    joinedAt: index,
    lastSeenAt: index,
  }));

const act = (module: RouletteModule, playerId: string, type: string, isHost = false) =>
  module.handleAction({ playerId, action: { type, clientActionId: "t" }, isHost });

const reveal = (module: RouletteModule, playerId: string) => act(module, playerId, ROULETTE_ACTIONS.reveal);

// Freezes Date.now() at `startMs` and starts the module, so the test fully
// controls how much "time" has passed before a reveal is attempted.
const startAtClock = (count: number, startMs: number, seed = "seed") => {
  vi.spyOn(Date, "now").mockReturnValue(startMs);
  const module = new RouletteModule();
  const players = makePlayers(count);
  module.start({ players, options: {}, randomSeed: seed });
  return { module, players, host: players[0]! };
};

const advanceTo = (ms: number) => {
  vi.spyOn(Date, "now").mockReturnValue(ms);
};

describe("RouletteModule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows solo play but rejects zero players", () => {
    const module = new RouletteModule();
    expect(() => module.start({ players: makePlayers(0), options: {}, randomSeed: "s" })).toThrow();
    expect(() => module.start({ players: makePlayers(1), options: {}, randomSeed: "s" })).not.toThrow();
  });

  it("decides the winner immediately in start() — deterministic from the seed", () => {
    const a = new RouletteModule();
    const b = new RouletteModule();
    const players = makePlayers(6);
    a.start({ players, options: {}, randomSeed: "fixed-seed" });
    b.start({ players, options: {}, randomSeed: "fixed-seed" });
    expect(a.getPublicState().winnerId).toBe(b.getPublicState().winnerId);
    expect(players.map((p) => p.id)).toContain(a.getPublicState().winnerId);
  });

  it("is in the spinning phase right after start(), before any reveal", () => {
    const { module } = startAtClock(4, 0);
    const pub = module.getPublicState();
    expect(pub.phase).toBe("spinning");
    expect(pub.spinStartedAt).toBe(0);
    expect(module.isOver()).toBeNull();
  });

  it.each([1, 2, 3, 8, 24])("slices the wheel into exactly 360°/%i, in seat order", (count) => {
    const { module, players } = startAtClock(count, 0);
    const { slots } = module.getPublicState();
    expect(slots).toHaveLength(count);
    const slice = 360 / count;
    slots.forEach((s, index) => {
      expect(s.playerId).toBe(players[index]!.id);
      expect(s.seatIndex).toBe(index);
      expect(s.angleStart).toBeCloseTo(index * slice);
      expect(s.angleEnd).toBeCloseTo((index + 1) * slice);
    });
    expect(slots[0]!.angleStart).toBe(0);
    expect(slots[slots.length - 1]!.angleEnd).toBeCloseTo(360);
  });

  it("ignores a reveal sent before the minimum spin time has elapsed", () => {
    const { module, host } = startAtClock(3, 1_000);
    advanceTo(1_000 + ROULETTE_SPIN_MS - 1);
    expect(reveal(module, host.id)).toMatchObject({ ok: true });
    expect(module.isOver()).toBeNull();
    expect(module.getPublicState().phase).toBe("spinning");
  });

  it("resolves once the minimum spin time has elapsed and a reveal arrives", () => {
    const { module, host } = startAtClock(3, 1_000);
    advanceTo(1_000 + ROULETTE_SPIN_MS);
    expect(reveal(module, host.id)).toMatchObject({ ok: true });
    expect(module.isOver()).not.toBeNull();
    expect(module.getPublicState().phase).toBe("ended");
  });

  it("a single client cannot skip the spin for everyone by revealing early — it takes no effect", () => {
    const { module, players } = startAtClock(5, 0);
    // a fast/malicious client fires immediately
    advanceTo(5);
    reveal(module, players[0]!.id);
    expect(module.isOver()).toBeNull();
    // the rest of the room's local timers fire honestly, after the real duration
    advanceTo(ROULETTE_SPIN_MS + 5);
    reveal(module, players[1]!.id);
    expect(module.isOver()).not.toBeNull();
  });

  it("reveal is idempotent — repeated calls after the threshold keep one consistent result", () => {
    const { module, players } = startAtClock(4, 0);
    advanceTo(ROULETTE_SPIN_MS);
    reveal(module, players[0]!.id);
    const first = module.isOver();
    for (const p of players) reveal(module, p.id);
    expect(module.isOver()).toEqual(first);
  });

  it.each([1, 2, 3, 8, 24])(
    "resolves a full round to a GameResult with exactly one ranked-first winner (%i players)",
    (count) => {
      const { module, players } = startAtClock(count, 0, `bots-${count}`);
      advanceTo(ROULETTE_SPIN_MS);
      for (const p of players) reveal(module, p.id);
      const result = module.isOver();
      expect(result).not.toBeNull();
      expect(result!.ranking).toHaveLength(count);
      expect(result!.winnerPlayerIds).toHaveLength(1);
      const winnerId = result!.winnerPlayerIds[0]!;
      expect(players.map((p) => p.id)).toContain(winnerId);
      for (const row of result!.ranking) {
        expect(row.rank).toBe(row.playerId === winnerId ? 1 : 2);
      }
      // the winner in the result matches the slot the wheel actually lands on
      expect(module.getPublicState().winnerId).toBe(winnerId);
    },
  );

  it("disconnects during the spin do not stall the reveal", () => {
    const { module, players } = startAtClock(4, 0);
    module.onPlayerLeave(players[1]!.id);
    module.onPlayerLeave(players[2]!.id);
    advanceTo(ROULETTE_SPIN_MS);
    // only the still-connected players' clients fire reveal
    reveal(module, players[0]!.id);
    reveal(module, players[3]!.id);
    expect(module.isOver()).not.toBeNull();
  });

  it("keeps the already-decided result intact even if the winner is permanently removed mid-spin", () => {
    const { module, players } = startAtClock(4, 0);
    const winnerId = module.getPublicState().winnerId;
    module.onPlayerRemoved(winnerId);
    advanceTo(ROULETTE_SPIN_MS);
    for (const p of players) reveal(module, p.id);
    const result = module.isOver();
    expect(result).not.toBeNull();
    // the historical spin record is preserved — the removed player still won
    expect(result!.winnerPlayerIds).toEqual([winnerId]);
    expect(module.getPublicState().winnerId).toBe(winnerId);
  });

  it("removing every other player still lets a lone reveal resolve the game", () => {
    const { module, players } = startAtClock(5, 0);
    for (const p of players.slice(1)) module.onPlayerRemoved(p.id);
    advanceTo(ROULETTE_SPIN_MS);
    reveal(module, players[0]!.id);
    expect(module.isOver()).not.toBeNull();
  });

  it("rejects unknown action types", () => {
    const { module, host } = startAtClock(2, 0);
    expect(act(module, host.id, "roulette:spinFaster")).toMatchObject({ ok: false, code: "INVALID_ACTION" });
  });

  it("exposes no private data (public state is the whole truth)", () => {
    const { module, players, host } = startAtClock(3, 0);
    expect(module.getStateFor(host.id)).toEqual({});
    advanceTo(ROULETTE_SPIN_MS);
    for (const p of players) reveal(module, p.id);
    expect(module.getStateFor(players[1]!.id)).toEqual({});
  });
});
