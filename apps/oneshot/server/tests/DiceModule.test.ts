import { afterEach, describe, expect, it, vi } from "vitest";
import type { DicePublicState, PublicPlayerState } from "@oneshot/shared";
import { DICE_ACTIONS } from "@oneshot/shared";
import { DiceModule } from "../src/games/dice/DiceModule";

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

const act = (module: DiceModule, playerId: string, type: string, payload?: unknown, isHost = false) =>
  module.handleAction({ playerId, action: { type, payload, clientActionId: "t" }, isHost });

const startGame = (count: number, seed = "seed") => {
  const module = new DiceModule();
  const players = makePlayers(count);
  module.start({ players, options: {}, randomSeed: seed });
  return { module, players, host: players[0]! };
};

const configure = (module: DiceModule, host: PublicPlayerState, totalRounds: number) =>
  act(module, host.id, DICE_ACTIONS.configure, { totalRounds }, true);

const rollAll = (module: DiceModule, players: PublicPlayerState[]) => {
  for (const p of players) act(module, p.id, DICE_ACTIONS.roll);
};

// Everyone rolls each round, host advances, break when the game is over.
const driveToEnd = (module: DiceModule, players: PublicPlayerState[], totalRounds: number) => {
  const host = players[0]!;
  configure(module, host, totalRounds);
  for (let i = 0; i < 10000; i += 1) {
    if (module.isOver()) break;
    const pub = module.getPublicState();
    switch (pub.phase) {
      case "rolling":
        rollAll(module, players);
        break;
      case "roundEnd":
        act(module, host.id, DICE_ACTIONS.nextRound, undefined, true);
        break;
      default:
        throw new Error(`unexpected phase ${pub.phase}`);
    }
  }
  return module.isOver();
};

describe("DiceModule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires at least 2 players", () => {
    const module = new DiceModule();
    expect(() => module.start({ players: makePlayers(1), options: {}, randomSeed: "s" })).toThrow();
  });

  it("gates configure to the host during setup and clamps rounds", () => {
    const { module, players, host } = startGame(3);
    expect(act(module, players[1]!.id, DICE_ACTIONS.configure, { totalRounds: 3 })).toMatchObject({
      ok: false,
      code: "HOST_ONLY",
    });
    expect(act(module, host.id, DICE_ACTIONS.configure, { totalRounds: "x" }, true)).toMatchObject({
      ok: false,
    });
    expect(configure(module, host, 99)).toMatchObject({ ok: true });
    const pub = module.getPublicState();
    expect(pub.phase).toBe("rolling");
    expect(pub.totalRounds).toBe(10);
    expect(pub.roundNumber).toBe(1);
  });

  it("clamps rounds below the minimum", () => {
    const { module, host } = startGame(2);
    configure(module, host, 0);
    expect(module.getPublicState().totalRounds).toBe(1);
  });

  it("rejects rolls outside the rolling phase, from strangers, and repeats", () => {
    const { module, players, host } = startGame(3);
    expect(act(module, host.id, DICE_ACTIONS.roll)).toMatchObject({ ok: false });
    configure(module, host, 2);
    expect(act(module, "stranger", DICE_ACTIONS.roll)).toMatchObject({ ok: false });
    expect(act(module, host.id, DICE_ACTIONS.roll)).toMatchObject({ ok: true });
    expect(act(module, host.id, DICE_ACTIONS.roll)).toMatchObject({ ok: false });
    // round is still waiting on the others
    const pub = module.getPublicState();
    expect(pub.phase).toBe("rolling");
    expect(pub.waitingOn).toEqual([players[1]!.id, players[2]!.id]);
  });

  it("resolves the round once everyone rolled, with valid dice and ranks", () => {
    const { module, players, host } = startGame(4);
    configure(module, host, 1);
    rollAll(module, players);
    const pub = module.getPublicState();
    expect(pub.phase).toBe("roundEnd");
    expect(pub.lastRoundRanking).toHaveLength(4);
    const sums = new Map(pub.players.map((p) => [p.playerId, p.roll!.sum]));
    for (const p of pub.players) {
      expect(p.roll!.d1).toBeGreaterThanOrEqual(1);
      expect(p.roll!.d1).toBeLessThanOrEqual(6);
      expect(p.roll!.d2).toBeGreaterThanOrEqual(1);
      expect(p.roll!.d2).toBeLessThanOrEqual(6);
      expect(p.roll!.sum).toBe(p.roll!.d1 + p.roll!.d2);
      expect(p.roll!.auto).toBe(false);
      // competition ranking: 1 + players with a strictly higher sum
      const expectedRank = 1 + [...sums.values()].filter((s) => s > sums.get(p.playerId)!).length;
      expect(p.roundRank).toBe(expectedRank);
      expect(p.cumulativeScore).toBe(expectedRank);
    }
  });

  it("shares the rank on tied sums (competition ranking)", () => {
    // Deterministic search for a seed that produces a tie in round 1.
    let tied: DicePublicState | null = null;
    for (let i = 0; i < 300 && !tied; i += 1) {
      const { module, players, host } = startGame(4, `tie-${i}`);
      configure(module, host, 1);
      rollAll(module, players);
      const pub = module.getPublicState();
      const sums = pub.players.map((p) => p.roll!.sum);
      if (new Set(sums).size < sums.length) tied = pub;
    }
    expect(tied).not.toBeNull();
    const ranks = new Map(tied!.players.map((p) => [p.playerId, p.roundRank!]));
    const sums = new Map(tied!.players.map((p) => [p.playerId, p.roll!.sum]));
    for (const [id, sum] of sums) {
      for (const [otherId, otherSum] of sums) {
        if (sum === otherSum) expect(ranks.get(id)).toBe(ranks.get(otherId));
        if (sum > otherSum) expect(ranks.get(id)!).toBeLessThan(ranks.get(otherId)!);
      }
    }
  });

  it.each([2, 3, 5, 8, 10])("plays a full 3-round game to completion with %i players", (count) => {
    const module = new DiceModule();
    const players = makePlayers(count);
    module.start({ players, options: {}, randomSeed: `bots-${count}` });
    const result = driveToEnd(module, players, 3);
    expect(result).not.toBeNull();
    expect(result!.ranking).toHaveLength(count);
  });

  it("finishes with a consistent ranking (lowest cumulative wins)", () => {
    const module = new DiceModule();
    const players = makePlayers(5);
    module.start({ players, options: {}, randomSeed: "full" });
    const result = driveToEnd(module, players, 4);
    expect(result).not.toBeNull();
    expect(result!.canceled).toBeFalsy();
    expect(result!.ranking).toHaveLength(5);
    expect(result!.ranking.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    const scores = result!.ranking.map((r) => r.scoreDelta!);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    expect(result!.winnerPlayerIds).toContain(result!.ranking[0]!.playerId);
    // every winner shares the best score
    for (const id of result!.winnerPlayerIds) {
      expect(result!.ranking.find((r) => r.playerId === id)!.scoreDelta).toBe(scores[0]);
    }
  });

  it("lets ANY player advance from roundEnd (not just the host)", () => {
    const { module, players, host } = startGame(2);
    configure(module, host, 2);
    // not in roundEnd yet
    expect(act(module, host.id, DICE_ACTIONS.nextRound, undefined, true)).toMatchObject({ ok: false });
    rollAll(module, players);
    // a non-host guest advances the round
    expect(act(module, players[1]!.id, DICE_ACTIONS.nextRound)).toMatchObject({ ok: true });
    expect(module.getPublicState().roundNumber).toBe(2);
  });

  it("auto-rolls disconnected players so the round cannot stall", () => {
    const { module, players, host } = startGame(3);
    configure(module, host, 1);
    module.onPlayerLeave(players[2]!.id);
    act(module, players[0]!.id, DICE_ACTIONS.roll);
    expect(module.getPublicState().phase).toBe("rolling");
    act(module, players[1]!.id, DICE_ACTIONS.roll);
    const pub = module.getPublicState();
    expect(pub.phase).toBe("roundEnd");
    const ghost = pub.players.find((p) => p.playerId === players[2]!.id)!;
    expect(ghost.roll).not.toBeNull();
    expect(ghost.roll!.auto).toBe(true);
    expect(ghost.roundRank).not.toBeNull();
  });

  it("completes the round when the last awaited player disconnects", () => {
    const { module, players, host } = startGame(3);
    configure(module, host, 1);
    act(module, players[0]!.id, DICE_ACTIONS.roll);
    act(module, players[1]!.id, DICE_ACTIONS.roll);
    expect(module.getPublicState().phase).toBe("rolling");
    module.onPlayerLeave(players[2]!.id);
    expect(module.getPublicState().phase).toBe("roundEnd");
  });

  it("completes the round when the last awaited player is removed, leaving no ghosts", () => {
    const { module, players, host } = startGame(3);
    configure(module, host, 1);
    act(module, players[0]!.id, DICE_ACTIONS.roll);
    act(module, players[1]!.id, DICE_ACTIONS.roll);
    module.onPlayerRemoved(players[2]!.id);
    const pub = module.getPublicState();
    expect(pub.phase).toBe("roundEnd");
    expect(pub.players).toHaveLength(2);
    expect(JSON.stringify(pub)).not.toContain(players[2]!.id);
    expect(pub.lastRoundRanking).toHaveLength(2);
  });

  it("resolves a stalled round when the only roller reconnects", () => {
    const { module, players, host } = startGame(3);
    configure(module, host, 1);
    act(module, players[0]!.id, DICE_ACTIONS.roll);
    module.onPlayerLeave(players[0]!.id);
    module.onPlayerLeave(players[1]!.id);
    module.onPlayerLeave(players[2]!.id);
    // everyone gone — the round must NOT resolve into the void
    expect(module.getPublicState().phase).toBe("rolling");
    module.onPlayerReturn(players[0]!.id);
    expect(module.getPublicState().phase).toBe("roundEnd");
  });

  it("keeps playing after a removal mid-game and finishes cleanly", () => {
    const module = new DiceModule();
    const players = makePlayers(4);
    module.start({ players, options: {}, randomSeed: "removal" });
    configure(module, players[0]!, 3);
    rollAll(module, players);
    act(module, players[0]!.id, DICE_ACTIONS.nextRound, undefined, true);
    module.onPlayerRemoved(players[3]!.id);
    const alive = players.slice(0, 3);
    rollAll(module, alive);
    expect(module.getPublicState().phase).toBe("roundEnd");
    act(module, players[0]!.id, DICE_ACTIONS.nextRound, undefined, true);
    rollAll(module, alive);
    act(module, players[0]!.id, DICE_ACTIONS.nextRound, undefined, true);
    const result = module.isOver();
    expect(result).not.toBeNull();
    expect(result!.ranking).toHaveLength(3);
    expect(JSON.stringify(module.getPublicState())).not.toContain(players[3]!.id);
  });

  it("blocks the end vote before round 2", () => {
    const { module, players, host } = startGame(3);
    configure(module, host, 3);
    expect(act(module, host.id, DICE_ACTIONS.proposeEnd, undefined, true)).toMatchObject({ ok: false });
    rollAll(module, players);
    // roundEnd of round 1 still counts as round 1
    expect(act(module, host.id, DICE_ACTIONS.proposeEnd, undefined, true)).toMatchObject({ ok: false });
  });

  it("passes the end vote on a connected majority and cancels the game", () => {
    const { module, players, host } = startGame(4);
    configure(module, host, 3);
    rollAll(module, players);
    act(module, host.id, DICE_ACTIONS.nextRound, undefined, true);
    // any player may open the vote (proposer auto-agrees)
    expect(act(module, players[1]!.id, DICE_ACTIONS.proposeEnd, undefined, false)).toMatchObject({ ok: true });
    expect(module.getPublicState().endVote).not.toBeNull();
    act(module, players[2]!.id, DICE_ACTIONS.voteEnd, { agree: true });
    act(module, players[3]!.id, DICE_ACTIONS.voteEnd, { agree: true });
    const result = module.isOver();
    expect(result).not.toBeNull();
    expect(result!.canceled).toBe(true);
  });

  it("fails the vote when a majority is impossible and play continues", () => {
    const { module, players, host } = startGame(4);
    configure(module, host, 3);
    rollAll(module, players);
    act(module, host.id, DICE_ACTIONS.nextRound, undefined, true);
    act(module, host.id, DICE_ACTIONS.proposeEnd, undefined, true);
    act(module, players[1]!.id, DICE_ACTIONS.voteEnd, { agree: false });
    act(module, players[2]!.id, DICE_ACTIONS.voteEnd, { agree: false });
    expect(module.getPublicState().endVote).toBeNull();
    expect(module.isOver()).toBeNull();
    rollAll(module, players);
    expect(module.getPublicState().phase).toBe("roundEnd");
  });

  it("a rejected vote starts a cooldown that blocks EVERYONE, then expires", () => {
    const { module, players, host } = startGame(4);
    configure(module, host, 3);
    rollAll(module, players);
    act(module, host.id, DICE_ACTIONS.nextRound, undefined, true);
    act(module, players[1]!.id, DICE_ACTIONS.proposeEnd);
    act(module, players[2]!.id, DICE_ACTIONS.voteEnd, { agree: false });
    act(module, players[3]!.id, DICE_ACTIONS.voteEnd, { agree: false });
    act(module, host.id, DICE_ACTIONS.voteEnd, { agree: false });
    // rejected → cooldown live for everyone, host included
    const pub = module.getPublicState();
    expect(pub.endVote).toBeNull();
    expect(pub.endVoteCooldownUntil).not.toBeNull();
    expect(act(module, host.id, DICE_ACTIONS.proposeEnd, undefined, true)).toMatchObject({ ok: false });
    expect(act(module, players[1]!.id, DICE_ACTIONS.proposeEnd)).toMatchObject({ ok: false });
    // 31s later the cooldown has expired
    const later = Date.now() + 31_000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    expect(module.getPublicState().endVoteCooldownUntil).toBeNull();
    expect(act(module, players[1]!.id, DICE_ACTIONS.proposeEnd)).toMatchObject({ ok: true });
  });

  it("breaks tied rank sums by the higher cumulative pip total", () => {
    // Search seeds for a genuine rank-sum tie, then check the tiebreak. Multiple
    // hits keep this a property test rather than a single lucky seed.
    let checked = 0;
    for (let s = 0; s < 400 && checked < 3; s += 1) {
      const module = new DiceModule();
      const players = makePlayers(2);
      module.start({ players, options: {}, randomSeed: `tie-${s}` });
      configure(module, players[0]!, 2);
      for (let round = 0; round < 2; round += 1) {
        rollAll(module, players);
        act(module, players[0]!.id, DICE_ACTIONS.nextRound);
      }
      const result = module.isOver();
      expect(result).not.toBeNull();
      const pub = module.getPublicState();
      const [a, b] = pub.players;
      if (!a || !b || a.cumulativeScore !== b.cumulativeScore || a.pipTotal === b.pipTotal) continue;
      checked += 1;
      const expectedWinner = a.pipTotal > b.pipTotal ? a.playerId : b.playerId;
      expect(result!.winnerPlayerIds).toEqual([expectedWinner]);
      expect(result!.ranking[0]!.playerId).toBe(expectedWinner);
      expect(result!.ranking[0]!.rank).toBe(1);
      expect(result!.ranking[1]!.rank).toBe(2);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("shares the win on a full tie (equal rank sum AND equal pips)", () => {
    let checked = 0;
    for (let s = 0; s < 2000 && checked < 1; s += 1) {
      const module = new DiceModule();
      const players = makePlayers(2);
      module.start({ players, options: {}, randomSeed: `fulltie-${s}` });
      configure(module, players[0]!, 1);
      rollAll(module, players);
      const pub = module.getPublicState();
      const [a, b] = pub.players;
      act(module, players[0]!.id, DICE_ACTIONS.nextRound);
      const result = module.isOver()!;
      if (!a || !b || a.cumulativeScore !== b.cumulativeScore || a.pipTotal !== b.pipTotal) continue;
      checked += 1;
      expect(result.winnerPlayerIds).toHaveLength(2);
      expect(result.ranking.every((r) => r.rank === 1)).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("resolves the vote against connected players only (no dropout deadlock)", () => {
    const { module, players, host } = startGame(3);
    configure(module, host, 3);
    rollAll(module, players);
    act(module, host.id, DICE_ACTIONS.nextRound, undefined, true);
    act(module, host.id, DICE_ACTIONS.proposeEnd, undefined, true);
    module.onPlayerLeave(players[2]!.id);
    // base is now 2 connected; host's auto-yes alone is not a majority yet
    expect(module.isOver()).toBeNull();
    act(module, players[1]!.id, DICE_ACTIONS.voteEnd, { agree: true });
    expect(module.isOver()).not.toBeNull();
    expect(module.isOver()!.canceled).toBe(true);
  });

  it("re-resolves an open vote when a yes-voter reconnects (majority is enacted)", () => {
    const { module, players, host } = startGame(5);
    configure(module, host, 3);
    rollAll(module, players);
    act(module, host.id, DICE_ACTIONS.nextRound, undefined, true);
    act(module, host.id, DICE_ACTIONS.proposeEnd, undefined, true); // A yes (1/5)
    act(module, players[1]!.id, DICE_ACTIONS.voteEnd, { agree: true }); // A,B yes (2/5)
    module.onPlayerLeave(players[1]!.id); // B drops: counted yes = A only (base 4)
    act(module, players[2]!.id, DICE_ACTIONS.voteEnd, { agree: true }); // A,C of 4 — still open
    expect(module.isOver()).toBeNull();
    // B returns: standing yes votes A,B,C = 3 of 5 connected — a majority that
    // must be enacted by the return hook itself.
    module.onPlayerReturn(players[1]!.id);
    expect(module.isOver()).not.toBeNull();
    expect(module.isOver()!.canceled).toBe(true);
  });

  it("keeps the vote resolvable when the proposer is removed", () => {
    const { module, players, host } = startGame(3);
    configure(module, host, 2);
    rollAll(module, players);
    act(module, host.id, DICE_ACTIONS.nextRound, undefined, true);
    act(module, host.id, DICE_ACTIONS.proposeEnd, undefined, true);
    module.onPlayerRemoved(host.id);
    // 2 players remain; the host's yes vote is gone with them
    expect(module.isOver()).toBeNull();
    act(module, players[1]!.id, DICE_ACTIONS.voteEnd, { agree: true });
    act(module, players[2]!.id, DICE_ACTIONS.voteEnd, { agree: true });
    expect(module.isOver()).not.toBeNull();
  });

  it("exposes no private data (public state is the whole truth)", () => {
    const { module, players, host } = startGame(3);
    configure(module, host, 1);
    expect(module.getStateFor(host.id)).toEqual({});
    rollAll(module, players);
    expect(module.getStateFor(players[1]!.id)).toEqual({});
  });
});
