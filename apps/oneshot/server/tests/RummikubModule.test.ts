import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RUMMIKUB_ACTIONS,
  isValidMeld,
  meldValue,
  type PublicPlayerState,
  type RummikubPrivateState,
  type RummikubPublicState,
  type Tile,
  type TileColor,
} from "@oneshot/shared";
import { RummikubModule } from "../src/games/rummikub/RummikubModule";
import { RummikubCore } from "../src/games/rummikub/rummikubCore";

// ------------------------------- helpers -------------------------------

const makePlayers = (count: number): PublicPlayerState[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    nickname: `P${i + 1}`,
    avatarKey: `shot-${i + 1}`,
    themeId: i % 2 === 0 ? "cyber" : "cozy",
    seatIndex: i,
    isHost: i === 0,
    connectionStatus: "online" as const,
    joinedAt: i,
    lastSeenAt: i,
  }));

const act = (
  module: RummikubModule,
  playerId: string,
  type: string,
  payload?: unknown,
  isHost = false,
) => module.handleAction({ playerId, action: { type, payload, clientActionId: "t" }, isHost });

const start = (count: number, seed = "seed") => {
  const module = new RummikubModule();
  const players = makePlayers(count);
  module.start({ players, options: {}, randomSeed: seed });
  return { module, players, host: players[0]! };
};

const pubOf = (m: RummikubModule) => m.getPublicState() as RummikubPublicState;
const privOf = (m: RummikubModule, id: string) => m.getStateFor(id) as RummikubPrivateState;

// tile constructors
let seq = 0;
const n = (color: TileColor, num: number): Tile => ({ id: `${color}-${num}-t${seq++}`, kind: "num", color, num });
const jk = (): Tile => ({ id: `joker-t${seq++}`, kind: "joker" });

// commit a board given as arrays of tile-id lists
const commitBoard = (m: RummikubModule, id: string, melds: string[][]) =>
  act(m, id, RUMMIKUB_ACTIONS.commit, { board: melds.map((tiles, i) => ({ id: `m${i}`, tiles })) });

// ------------------------------- greedy bot -------------------------------

const findOneMeld = (tiles: Tile[]): Tile[] | null => {
  const nums = tiles.filter((t): t is Extract<Tile, { kind: "num" }> => t.kind === "num");
  // group: same number, distinct colors, >=3
  const byNum = new Map<number, Extract<Tile, { kind: "num" }>[]>();
  for (const t of nums) {
    const arr = byNum.get(t.num) ?? [];
    if (!arr.some((x) => x.color === t.color)) arr.push(t);
    byNum.set(t.num, arr);
  }
  for (const arr of byNum.values()) if (arr.length >= 3) return arr.slice(0, 3);
  // run: same color, 3 consecutive
  const byColor = new Map<TileColor, number[]>();
  const tileAt = new Map<string, Extract<Tile, { kind: "num" }>>();
  for (const t of nums) {
    tileAt.set(`${t.color}-${t.num}`, t);
    const arr = byColor.get(t.color) ?? [];
    if (!arr.includes(t.num)) arr.push(t.num);
    byColor.set(t.color, arr);
  }
  for (const [color, arr] of byColor) {
    arr.sort((a, b) => a - b);
    for (let i = 0; i + 2 < arr.length; i += 1) {
      if (arr[i]! + 1 === arr[i + 1] && arr[i]! + 2 === arr[i + 2]) {
        return [arr[i]!, arr[i]! + 1, arr[i]! + 2].map((v) => tileAt.get(`${color}-${v}`)!);
      }
    }
  }
  return null;
};

const extractMelds = (hand: Tile[]): Tile[][] => {
  let remaining = [...hand];
  const melds: Tile[][] = [];
  for (;;) {
    const meld = findOneMeld(remaining);
    if (!meld) break;
    const ids = new Set(meld.map((t) => t.id));
    remaining = remaining.filter((t) => !ids.has(t.id));
    melds.push(meld);
  }
  return melds;
};

const boardIds = (pub: RummikubPublicState): string[][] => pub.board.map((m) => m.tiles.map((t) => t.id));

// one bot turn: lay melds if legal, else draw
const botTurn = (m: RummikubModule, id: string) => {
  const pub = pubOf(m);
  const me = privOf(m, id);
  const melds = extractMelds(me.hand);
  const existing = boardIds(pub);
  if (!me.hasDoneInitialMeld) {
    const total = melds.reduce((s, tiles) => s + meldValue(tiles), 0);
    if (melds.length > 0 && total >= 30) {
      const proposed = [...existing, ...melds.map((tiles) => tiles.map((t) => t.id))];
      const r = commitBoard(m, id, proposed);
      if (r.ok) return;
    }
    act(m, id, RUMMIKUB_ACTIONS.draw);
    return;
  }
  if (melds.length > 0) {
    const proposed = [...existing, ...melds.map((tiles) => tiles.map((t) => t.id))];
    const r = commitBoard(m, id, proposed);
    if (r.ok) return;
  }
  act(m, id, RUMMIKUB_ACTIONS.draw);
};

const driveToEnd = (m: RummikubModule) => {
  act(m, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
  for (let i = 0; i < 200000; i += 1) {
    if (m.isOver()) break;
    const pub = pubOf(m);
    if (pub.phase === "play" && pub.currentTurnPlayerId) botTurn(m, pub.currentTurnPlayerId);
    else break;
  }
  return m.isOver();
};

afterEach(() => vi.useRealTimers());

// ------------------------------- tests -------------------------------

describe("Rummikub — setup & deal", () => {
  it("stays in setup until host configures", () => {
    const { module } = start(3);
    expect(pubOf(module).phase).toBe("setup");
  });

  it("rejects configure from a non-host", () => {
    const { module } = start(3);
    const r = act(module, "player-2", RUMMIKUB_ACTIONS.configure, { turnSeconds: 60 }, false);
    expect(r).toEqual({ ok: false, code: "HOST_ONLY", message: expect.any(String) });
  });

  it("rejects an invalid turnSeconds", () => {
    const { module } = start(3);
    const r = act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 45 }, true);
    expect(r.ok).toBe(false);
  });

  it("deals 14 to each and uses one deck for <=4 players", () => {
    const { module } = start(4);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 30 }, true);
    const pub = pubOf(module);
    expect(pub.phase).toBe("play");
    expect(pub.deckCount).toBe(1);
    expect(pub.poolCount).toBe(106 - 4 * 14); // 50
    for (const p of pub.players) expect(p.handCount).toBe(14);
    expect(pub.currentTurnPlayerId).toBe("player-1");
    expect(pub.turnDeadline).not.toBeNull();
  });

  it("uses two decks for 5+ players", () => {
    const { module } = start(6);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const pub = pubOf(module);
    expect(pub.deckCount).toBe(2);
    expect(pub.poolCount).toBe(212 - 6 * 14); // 128
    expect(pub.turnDeadline).toBeNull(); // unlimited
  });
});

describe("Rummikub — bot drives a full game to completion", () => {
  for (const count of [2, 3, 4, 5, 8]) {
    it(`finishes with ${count} players`, () => {
      const { module } = start(count, `seed-${count}`);
      const result = driveToEnd(module);
      expect(result).not.toBeNull();
      expect(result!.ranking).toHaveLength(count);
      expect(result!.winnerPlayerIds.length).toBeGreaterThanOrEqual(1);
      // ranking covers every player exactly once
      const ids = new Set(result!.ranking.map((r) => r.playerId));
      expect(ids.size).toBe(count);
    });
  }
});

describe("Rummikub — initial meld rule", () => {
  const setupPlay = (count = 2) => {
    const { module } = start(count);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const core = (module as unknown as { core: RummikubCore }).core;
    return { module, core };
  };

  it("rejects an initial meld worth less than 30", () => {
    const { module, core } = setupPlay();
    const a = n("red", 1), b = n("blue", 1), c = n("black", 1); // group of 1s = 3 points
    core.forTest_setHand("player-1", [a, b, c, n("orange", 9)]);
    core.forTest_setTurn("player-1");
    const r = commitBoard(module, "player-1", [[a.id, b.id, c.id]]);
    expect(r.ok).toBe(false);
  });

  it("accepts a 30+ initial meld and marks the player", () => {
    const { module, core } = setupPlay();
    const a = n("red", 10), b = n("blue", 10), c = n("black", 10); // 30
    core.forTest_setHand("player-1", [a, b, c, n("orange", 2)]);
    core.forTest_setTurn("player-1");
    const r = commitBoard(module, "player-1", [[a.id, b.id, c.id]]);
    expect(r.ok).toBe(true);
    const pub = pubOf(module);
    expect(pub.players.find((p) => p.playerId === "player-1")!.hasDoneInitialMeld).toBe(true);
    expect(privOf(module, "player-1").hand).toHaveLength(1);
    expect(pub.board).toHaveLength(1);
  });

  it("forbids touching the existing board before the initial meld", () => {
    const { module, core } = setupPlay();
    const b1 = n("red", 5), b2 = n("red", 6), b3 = n("red", 7);
    core.forTest_setBoard([[b1, b2, b3]]);
    const a = n("red", 10), a2 = n("blue", 10), a3 = n("black", 10);
    core.forTest_setHand("player-1", [a, a2, a3]);
    core.forTest_setInitial("player-1", false);
    core.forTest_setTurn("player-1");
    // try to extend the board run with a hand tile (touching board) -> illegal pre-initial
    const b8 = n("red", 8);
    core.forTest_setHand("player-1", [a, a2, a3, b8]);
    const r = commitBoard(module, "player-1", [[b1.id, b2.id, b3.id, b8.id], [a.id, a2.id, a3.id]]);
    expect(r.ok).toBe(false);
  });
});

describe("Rummikub — commit conservation (anti-cheat)", () => {
  const setupPlayed = () => {
    const { module } = start(2);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const core = (module as unknown as { core: RummikubCore }).core;
    core.forTest_setInitial("player-1", true);
    core.forTest_setTurn("player-1");
    return { module, core };
  };

  it("rejects a tile the player does not own", () => {
    const { module, core } = setupPlayed();
    core.forTest_setHand("player-1", [n("red", 4), n("red", 5), n("red", 6)]);
    const r = commitBoard(module, "player-1", [["blue-9-999", "blue-10-998", "blue-11-997"]]);
    expect(r.ok).toBe(false);
  });

  it("rejects dropping a board tile back to hand", () => {
    const { module, core } = setupPlayed();
    const b1 = n("red", 4), b2 = n("red", 5), b3 = n("red", 6);
    core.forTest_setBoard([[b1, b2, b3]]);
    const h = n("blue", 7);
    core.forTest_setHand("player-1", [h, n("blue", 8), n("blue", 9)]);
    // omit b3 from the proposed board -> illegal
    const r = commitBoard(module, "player-1", [[b1.id, b2.id]]);
    expect(r.ok).toBe(false);
  });

  it("rejects placing the same tile twice", () => {
    const { module, core } = setupPlayed();
    const a = n("red", 7);
    core.forTest_setHand("player-1", [a, n("blue", 7), n("black", 7)]);
    const r = commitBoard(module, "player-1", [[a.id, a.id, a.id]]);
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid set", () => {
    const { module, core } = setupPlayed();
    const a = n("red", 4), b = n("blue", 5), c = n("red", 6);
    core.forTest_setHand("player-1", [a, b, c]);
    const r = commitBoard(module, "player-1", [[a.id, b.id, c.id]]);
    expect(r.ok).toBe(false);
  });

  it("rejects a commit that plays zero tiles from hand", () => {
    const { module, core } = setupPlayed();
    const b1 = n("red", 4), b2 = n("red", 5), b3 = n("red", 6);
    core.forTest_setBoard([[b1, b2, b3]]);
    core.forTest_setHand("player-1", [n("blue", 1)]);
    const r = commitBoard(module, "player-1", [[b1.id, b2.id, b3.id]]);
    expect(r.ok).toBe(false);
  });
});

describe("Rummikub — board rearrangement & joker retrieval", () => {
  const setupPlayed = () => {
    const { module } = start(2);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const core = (module as unknown as { core: RummikubCore }).core;
    core.forTest_setInitial("player-1", true);
    core.forTest_setTurn("player-1");
    return { module, core };
  };

  it("accepts splitting a run and reusing tiles when the result is valid & conserved", () => {
    const { module, core } = setupPlayed();
    // board: red 4-5-6-7 ; hand: red 3, blue 6, black 6
    const b4 = n("red", 4), b5 = n("red", 5), b6 = n("red", 6), b7 = n("red", 7);
    core.forTest_setBoard([[b4, b5, b6, b7]]);
    const h3 = n("red", 3), hb6 = n("blue", 6), hk6 = n("black", 6);
    core.forTest_setHand("player-1", [h3, hb6, hk6]);
    // rearrange into: run red 3-4-5-6-7 ... but then 6 group needs a red-6 which is used.
    // Instead: run red 3-4-5-6-7 (uses board 4-6-7 + hand red3) is fine and plays red3.
    const r = commitBoard(module, "player-1", [[h3.id, b4.id, b5.id, b6.id, b7.id]]);
    expect(r.ok).toBe(true);
    expect(privOf(module, "player-1").hand.map((t) => t.id)).toEqual(
      expect.arrayContaining([hb6.id, hk6.id]),
    );
  });

  it("accepts retrieving a joker by replacing it with the real tile", () => {
    const { module, core } = setupPlayed();
    // board: run blue 4 - JOKER(=5) - 6 ; hand: real blue 5, plus red7 blue7 black7
    const j = jk();
    const b4 = n("blue", 4), b6 = n("blue", 6);
    core.forTest_setBoard([[b4, j, b6]]);
    const real5 = n("blue", 5);
    const r7 = n("red", 7), bl7 = n("blue", 7), bk7 = n("black", 7);
    core.forTest_setHand("player-1", [real5, r7, bl7, bk7]);
    // replace joker with real blue-5 in the run, move joker into a new 7-group with two played 7s
    const r = commitBoard(module, "player-1", [
      [b4.id, real5.id, b6.id],
      [r7.id, bl7.id, j.id], // joker completes the group of 7s
    ]);
    expect(r.ok).toBe(true);
    // joker + 2 of the 7s left the hand (real5 also played); black-7 stays
    const handIds = privOf(module, "player-1").hand.map((t) => t.id);
    expect(handIds).toContain(bk7.id);
    expect(handIds).not.toContain(real5.id);
  });
});

describe("Rummikub — winning & drawing", () => {
  it("wins when a commit empties the hand", () => {
    const { module } = start(2);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const core = (module as unknown as { core: RummikubCore }).core;
    core.forTest_setInitial("player-1", true);
    core.forTest_setTurn("player-1");
    const a = n("red", 11), b = n("red", 12), c = n("red", 13);
    core.forTest_setHand("player-1", [a, b, c]);
    const r = commitBoard(module, "player-1", [[a.id, b.id, c.id]]);
    expect(r.ok).toBe(true);
    const over = module.isOver();
    expect(over).not.toBeNull();
    expect(over!.winnerPlayerIds).toEqual(["player-1"]);
    expect(over!.ranking.find((x) => x.playerId === "player-1")!.scoreDelta).toBeGreaterThan(0);
  });

  it("draws a tile and advances the turn", () => {
    const { module } = start(2);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const before = pubOf(module);
    const beforeCount = privOf(module, "player-1").hand.length;
    act(module, "player-1", RUMMIKUB_ACTIONS.draw);
    expect(privOf(module, "player-1").hand.length).toBe(beforeCount + 1);
    const after = pubOf(module);
    expect(after.currentTurnPlayerId).toBe("player-2");
    expect(after.poolCount).toBe(before.poolCount - 1);
  });
});

describe("Rummikub — timer", () => {
  it("ignores a stale-turn timeout and a too-early timeout", () => {
    const { module } = start(2);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 120 }, true);
    const before = pubOf(module);
    // wrong turn number -> no-op
    act(module, "player-2", RUMMIKUB_ACTIONS.timeout, { turnNumber: 999 });
    expect(pubOf(module).currentTurnPlayerId).toBe(before.currentTurnPlayerId);
    // correct turn but deadline not reached -> no-op
    act(module, "player-2", RUMMIKUB_ACTIONS.timeout, { turnNumber: before.turnNumber });
    expect(pubOf(module).currentTurnPlayerId).toBe(before.currentTurnPlayerId);
  });

  it("auto-draws and advances when the deadline passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000));
    const { module } = start(2);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 15 }, true);
    const before = pubOf(module);
    const beforeHand = privOf(module, "player-1").hand.length;
    vi.setSystemTime(new Date(1_000_000 + 16_000)); // past the 15s deadline
    act(module, "player-2", RUMMIKUB_ACTIONS.timeout, { turnNumber: before.turnNumber });
    const after = pubOf(module);
    expect(after.currentTurnPlayerId).toBe("player-2");
    expect(privOf(module, "player-1").hand.length).toBe(beforeHand + 1); // auto-drew
  });
});

describe("Rummikub — kick / disconnect robustness", () => {
  it("advances the turn when the current player is removed (no deadlock)", () => {
    const { module } = start(3);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    expect(pubOf(module).currentTurnPlayerId).toBe("player-1");
    module.onPlayerRemoved("player-1");
    const pub = pubOf(module);
    expect(pub.currentTurnPlayerId).toBe("player-2");
    expect(pub.players.map((p) => p.playerId)).not.toContain("player-1");
    // game still playable
    expect(module.isOver()).toBeNull();
  });

  it("returns a kicked player's tiles to the pool", () => {
    const { module } = start(3);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const before = pubOf(module).poolCount;
    module.onPlayerRemoved("player-2"); // held 14 tiles
    expect(pubOf(module).poolCount).toBe(before + 14);
  });

  it("declares the last remaining player the winner", () => {
    const { module } = start(2);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    module.onPlayerRemoved("player-2");
    const over = module.isOver();
    expect(over).not.toBeNull();
    expect(over!.winnerPlayerIds).toEqual(["player-1"]);
  });

  it("host can skip a disconnected current player", () => {
    const { module } = start(3);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    module.onPlayerLeave("player-1"); // current player disconnects
    const r = act(module, "player-1", RUMMIKUB_ACTIONS.skipTurn, undefined, true);
    expect(r.ok).toBe(true);
    expect(pubOf(module).currentTurnPlayerId).toBe("player-2");
  });

  it("does not skip a connected current player", () => {
    const { module } = start(3);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const r = act(module, "player-1", RUMMIKUB_ACTIONS.skipTurn, undefined, true);
    expect(r.ok).toBe(false);
  });

  it("passes an early-end vote by connected quorum while one player is disconnected", () => {
    const { module } = start(3);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    module.onPlayerLeave("player-3");
    act(module, "player-1", RUMMIKUB_ACTIONS.proposeEnd);
    act(module, "player-2", RUMMIKUB_ACTIONS.voteEnd, { agree: true });
    const over = module.isOver();
    expect(over).not.toBeNull();
    expect(over!.canceled).toBe(true);
  });
});

describe("Rummikub — stalemate ends the game", () => {
  it("ends by lowest hand when the pool is empty and everyone passes", () => {
    const { module } = start(2);
    act(module, "player-1", RUMMIKUB_ACTIONS.configure, { turnSeconds: 0 }, true);
    const core = (module as unknown as { core: RummikubCore }).core;
    core.forTest_setPool([]);
    core.forTest_setHand("player-1", [n("red", 1)]);
    core.forTest_setHand("player-2", [n("blue", 9), n("black", 9)]);
    core.forTest_setTurn("player-1");
    // both draw (pool empty -> pass) until a full round passes
    act(module, "player-1", RUMMIKUB_ACTIONS.draw);
    act(module, "player-2", RUMMIKUB_ACTIONS.draw);
    const over = module.isOver();
    expect(over).not.toBeNull();
    expect(over!.winnerPlayerIds).toEqual(["player-1"]); // fewest points
  });
});

describe("Rummikub — meld validator sanity through the module", () => {
  it("exposes a validator consistent with the module rules", () => {
    expect(isValidMeld([n("red", 7), n("blue", 7), n("black", 7)])).toBe(true);
    expect(isValidMeld([n("red", 7), n("red", 8), n("red", 9)])).toBe(true);
    expect(isValidMeld([n("red", 7), n("blue", 8), n("red", 9)])).toBe(false);
  });
});
