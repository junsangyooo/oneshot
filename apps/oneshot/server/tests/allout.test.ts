import { describe, it, expect } from "vitest";
import type { AlloutCard, AlloutPublicState, PublicPlayerState } from "@oneshot/shared";
import { AlloutCore } from "../src/games/allout/alloutCore";

const mkPlayers = (n: number): PublicPlayerState[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    nickname: `P${i}`,
    avatarKey: "a",
    themeId: "cyber",
    seatIndex: i,
    isHost: i === 0,
    connectionStatus: "online" as const,
    joinedAt: 0,
    lastSeenAt: 0,
  }));

const setupCore = (
  n: number,
  opts?: Partial<{ totalRounds: number; bankruptcyOn: boolean; bankruptcyLimit: number }>,
): AlloutCore => {
  const core = new AlloutCore();
  core.start({ players: mkPlayers(n), randomSeed: "seed-allout-1" });
  core.configure(true, { totalRounds: 2, bankruptcyOn: false, bankruptcyLimit: 15, ...opts });
  return core;
};

// ------- test card factories -------
const N = (id: string, color: "red" | "yellow" | "blue" | "green", value: number): AlloutCard => ({
  id,
  kind: "number",
  color,
  value,
});
const P2 = (id: string, color: "red" | "yellow" | "blue" | "green"): AlloutCard => ({ id, kind: "plus2", color });
const SH = (id: string, color: "red" | "yellow" | "blue" | "green"): AlloutCard => ({ id, kind: "shield", color });
const RV = (id: string, color: "red" | "yellow" | "blue" | "green"): AlloutCard => ({ id, kind: "reverse", color });
const RF = (id: string): AlloutCard => ({ id, kind: "reflect" });
const XC = (id: string): AlloutCard => ({ id, kind: "exchange" });

describe("allout deck & deal", () => {
  it("deals 7 each, single deck for <=8, draw pile = 80-7n-1, number start card", () => {
    const core = setupCore(4);
    const pub = core.getPublicState();
    expect(pub.phase).toBe("play");
    expect(pub.players.every((p) => p.handCount === 7)).toBe(true);
    expect(pub.drawPileCount).toBe(80 - 7 * 4 - 1);
    expect(pub.top?.card.kind).toBe("number");
    expect(pub.doubleDeck).toBe(false);
    expect(pub.currentTurnPlayerId).toBe("p0");
  });

  it("doubles deck for 9+ players (160 cards)", () => {
    const core = setupCore(9);
    const pub = core.getPublicState();
    expect(pub.doubleDeck).toBe(true);
    expect(pub.drawPileCount).toBe(160 - 7 * 9 - 1);
  });

  it("getStateFor returns 7 private hand cards, hidden from public", () => {
    const core = setupCore(3);
    expect(core.getStateFor("p1").hand.length).toBe(7);
    const pub = core.getPublicState();
    expect((pub as unknown as { hands?: unknown }).hands).toBeUndefined();
  });
});

describe("allout play validation", () => {
  it("rejects a card matching neither color nor number", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [N("c1", "blue", 3)]);
    const r = core.play("p0", { cards: ["c1"] });
    expect(r.ok).toBe(false);
  });

  it("accepts a color match and advances the turn + updates active color", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [N("c1", "red", 3), N("keep", "blue", 9)]);
    const r = core.play("p0", { cards: ["c1"] });
    expect(r.ok).toBe(true);
    const pub = core.getPublicState();
    expect(pub.top?.color).toBe("red");
    expect(pub.currentTurnPlayerId).toBe("p1");
  });

  it("accepts a multi-card same-number set (red5 + blue5) and sets color to the last card", () => {
    const core = setupCore(3);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [N("a", "red", 5), N("b", "blue", 5)]);
    const r = core.play("p0", { cards: ["a", "b"] }); // last = blue5
    expect(r.ok).toBe(true);
    expect(core.getPublicState().top?.color).toBe("blue");
  });

  it("rejects mixing number with a function card", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [N("a", "red", 5), RV("r", "red")]);
    expect(core.play("p0", { cards: ["a", "r"] }).ok).toBe(false);
  });

  it("requires a chosen color for a wild card", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [{ id: "w", kind: "wild" }]);
    expect(core.play("p0", { cards: ["w"] }).ok).toBe(false);
    const r = core.play("p0", { cards: ["w"], chosenColor: "green" });
    expect(r.ok).toBe(true);
    expect(core.getPublicState().top?.color).toBe("green");
  });
});

describe("allout attacks", () => {
  it("plus2 stacks (x2 = +4) and the victim draws the whole pile", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [P2("a", "red"), P2("b", "red"), N("keep", "blue", 9)]);
    core.forTest_setHand("p1", [N("x", "blue", 9)]);
    expect(core.play("p0", { cards: ["a", "b"] }).ok).toBe(true);
    let pub = core.getPublicState();
    expect(pub.pendingAttack).toBe(4);
    expect(pub.currentTurnPlayerId).toBe("p1");
    expect(core.draw("p1").ok).toBe(true); // take the pile
    pub = core.getPublicState();
    expect(pub.pendingAttack).toBe(0);
    expect(pub.players.find((p) => p.playerId === "p1")!.handCount).toBe(1 + 4);
    expect(pub.currentTurnPlayerId).toBe("p0");
  });

  it("shield of the active color clears the whole stack", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setPending(6, "p1");
    core.forTest_setHand("p0", [SH("s", "red")]);
    expect(core.play("p0", { cards: ["s"] }).ok).toBe(true);
    expect(core.getPublicState().pendingAttack).toBe(0);
  });

  it("reflect bounces the stack to the previous attacker and reverses direction", () => {
    const core = setupCore(3);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setPending(4, "p0");
    core.forTest_setTurn("p1");
    core.forTest_setHand("p1", [RF("rf")]);
    expect(core.play("p1", { cards: ["rf"], chosenColor: "red" }).ok).toBe(true);
    const pub = core.getPublicState();
    expect(pub.pendingAttack).toBe(4);
    expect(pub.currentTurnPlayerId).toBe("p0");
    expect(pub.direction).toBe(-1);
  });

  it("reverse with 2 players returns the turn to self", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [RV("r", "red"), N("k", "red", 2)]);
    expect(core.play("p0", { cards: ["r"] }).ok).toBe(true);
    expect(core.getPublicState().currentTurnPlayerId).toBe("p0");
  });

  it("shield cannot be played without an attack", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [SH("s", "red")]);
    expect(core.play("p0", { cards: ["s"] }).ok).toBe(false);
  });
});

describe("allout exchange & bankruptcy", () => {
  it("exchange swaps the full hand with the chosen target", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [XC("xc")]);
    core.forTest_setHand("p1", [N("a", "blue", 1), N("b", "blue", 2), N("c", "blue", 3)]);
    expect(core.play("p0", { cards: ["xc"], chosenColor: "blue", exchangeTargetId: "p1" }).ok).toBe(true);
    // p0 now holds p1's old 3 cards; p1 holds p0's empty hand -> p1 finished
    expect(core.getStateFor("p0").hand.length).toBe(3);
  });

  it("bankruptcy eliminates a player who crosses the limit (auto last)", () => {
    const core = setupCore(2, { totalRounds: 1, bankruptcyOn: true, bankruptcyLimit: 8 });
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setPending(4, "p0");
    core.forTest_setTurn("p1");
    core.forTest_setHand("p1", [
      N("a", "blue", 1), N("b", "blue", 2), N("c", "blue", 3),
      N("d", "blue", 4), N("e", "blue", 5), N("f", "blue", 6), N("g", "blue", 7),
    ]); // 7 cards
    expect(core.draw("p1").ok).toBe(true); // take 4 -> 11 >= 8 -> bankrupt
    const pub = core.getPublicState();
    expect(pub.players.find((p) => p.playerId === "p1")!.bankrupt).toBe(true);
    // 2 players, one bankrupt -> round over (final round) -> host finishes
    expect(pub.phase).toBe("roundEnd");
    core.nextRound(true);
    const result = core.isOver();
    expect(result).not.toBeNull();
    expect(result!.winnerPlayerIds).toContain("p0"); // p1 bankrupt = worst
  });
});

describe("allout edge cases (regression)", () => {
  it("a play after drawing must include the drawn card", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [N("r5", "red", 5), N("keep", "red", 9)]); // r5 legal on red
    core.draw("p0"); // not under attack -> draw 1, sets drawnPending
    expect(core.getStateFor("p0").drawnCardId).not.toBeNull();
    // r5 is otherwise legal, but the play omits the drawn card -> rejected
    expect(core.play("p0", { cards: ["r5"] }).ok).toBe(false);
  });

  it("exchange that hands over an empty hand finishes the target (rank 1)", () => {
    const core = setupCore(2, { totalRounds: 1 });
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [XC("xc")]); // only the exchange
    core.forTest_setHand("p1", [N("a", "blue", 1), N("b", "blue", 2)]);
    expect(core.play("p0", { cards: ["xc"], chosenColor: "blue", exchangeTargetId: "p1" }).ok).toBe(true);
    const pub = core.getPublicState();
    expect(pub.players.find((p) => p.playerId === "p1")!.finished).toBe(true);
    expect(pub.lastRoundRanking?.[0]).toBe("p1"); // emptied first -> rank 1
  });

  it("exchange can bankrupt the player who receives a large hand", () => {
    const core = setupCore(2, { totalRounds: 1, bankruptcyOn: true, bankruptcyLimit: 8 });
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [XC("xc"), N("k", "red", 9)]);
    core.forTest_setHand("p1", Array.from({ length: 10 }, (_, i) => N(`b${i}`, "blue", (i % 13) + 1)));
    expect(core.play("p0", { cards: ["xc"], chosenColor: "blue", exchangeTargetId: "p1" }).ok).toBe(true);
    expect(core.getPublicState().players.find((p) => p.playerId === "p0")!.bankrupt).toBe(true);
  });

  it("two reverses (even count) return the turn to self with 3 players", () => {
    const core = setupCore(3);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [RV("r1", "red"), RV("r2", "red"), N("k", "red", 2)]);
    expect(core.play("p0", { cards: ["r1", "r2"] }).ok).toBe(true);
    const pub = core.getPublicState();
    expect(pub.currentTurnPlayerId).toBe("p0");
    expect(pub.direction).toBe(1); // even -> direction unchanged
  });

  it("reflect bounces to the previous attacker who then takes the pile", () => {
    const core = setupCore(3);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setPending(4, "p0");
    core.forTest_setTurn("p1");
    core.forTest_setHand("p1", [RF("rf"), N("k", "red", 2)]);
    expect(core.play("p1", { cards: ["rf"], chosenColor: "red" }).ok).toBe(true);
    let pub = core.getPublicState();
    expect(pub.currentTurnPlayerId).toBe("p0");
    expect(pub.pendingAttack).toBe(4);
    expect(pub.direction).toBe(-1);
    core.forTest_setHand("p0", [N("x", "blue", 9)]);
    expect(core.draw("p0").ok).toBe(true);
    pub = core.getPublicState();
    expect(pub.pendingAttack).toBe(0);
    expect(pub.players.find((p) => p.playerId === "p0")!.handCount).toBe(5);
  });

  it("multi +2 of mixed colors stacks the full amount", () => {
    const core = setupCore(2);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setTurn("p0");
    core.forTest_setHand("p0", [P2("a", "red"), P2("b", "blue"), N("k", "red", 1)]);
    expect(core.play("p0", { cards: ["a", "b"] }).ok).toBe(true); // red+2 legal opener, blue+2 grouped
    expect(core.getPublicState().pendingAttack).toBe(4);
    expect(core.getPublicState().top?.color).toBe("blue"); // last card sets color
  });
});

// ------- bot full-game driver -------
const botMove = (core: AlloutCore, pub: AlloutPublicState): void => {
  const turn = pub.currentTurnPlayerId;
  if (!turn) throw new Error("play phase with no current turn");
  const me = core.getStateFor(turn);
  const activeOthers = pub.players.filter((p) => p.playerId !== turn && !p.finished).map((p) => p.playerId);

  const attempt = (cardId: string | null): boolean => {
    if (!cardId) return false;
    const card = me.hand.find((c) => c.id === cardId);
    if (!card) return false;
    const extra: { chosenColor?: "red"; exchangeTargetId?: string } = {};
    const colorless = ["plus4", "plus7", "exchange", "reflect", "wild"].includes(card.kind);
    if (colorless) extra.chosenColor = "red";
    if (card.kind === "exchange") {
      if (activeOthers.length === 0) return false;
      extra.exchangeTargetId = activeOthers[0];
    }
    return core.play(turn, { cards: [cardId], ...extra }).ok;
  };

  if (pub.drawnPendingPlayerId === turn) {
    if (attempt(me.drawnCardId)) return;
    core.pass(turn);
    return;
  }
  for (const c of me.hand) {
    if (attempt(c.id)) return;
  }
  core.draw(turn);
};

const playGame = (core: AlloutCore): void => {
  for (let i = 0; i < 300000; i += 1) {
    if (core.isOver()) return;
    const pub = core.getPublicState();
    if (pub.phase === "roundEnd") {
      core.nextRound(true);
      continue;
    }
    if (pub.phase !== "play") return;
    botMove(core, pub);
  }
  throw new Error("game did not terminate");
};

describe("allout full games (bot loop)", () => {
  for (const n of [2, 3, 4, 6]) {
    it(`completes a ${n}-player, 2-round game with a valid ranking`, () => {
      const core = new AlloutCore();
      core.start({ players: mkPlayers(n), randomSeed: `bot-${n}` });
      core.configure(true, { totalRounds: 2, bankruptcyOn: false, bankruptcyLimit: 15 });
      playGame(core);
      const result = core.isOver();
      expect(result).not.toBeNull();
      expect(result!.ranking.length).toBe(n);
      expect(result!.winnerPlayerIds.length).toBeGreaterThanOrEqual(1);
    });
  }

  it("completes a 4-player game with bankruptcy on", () => {
    const core = new AlloutCore();
    core.start({ players: mkPlayers(4), randomSeed: "bot-bankrupt" });
    core.configure(true, { totalRounds: 2, bankruptcyOn: true, bankruptcyLimit: 12 });
    playGame(core);
    expect(core.isOver()).not.toBeNull();
  });
});

describe("allout robustness", () => {
  it("removing the current victim mid-attack hands the turn (and pile) onward", () => {
    const core = setupCore(3);
    core.forTest_setTop(N("top", "red", 7), "red");
    core.forTest_setPending(4, "p0");
    core.forTest_setTurn("p1"); // p1 is the current victim
    core.onPlayerRemoved("p1");
    const pub = core.getPublicState();
    expect(pub.currentTurnPlayerId).not.toBe("p1");
    expect(pub.currentTurnPlayerId).not.toBeNull(); // game not frozen
    expect(pub.players.some((p) => p.playerId === "p1")).toBe(false);
  });

  it("removing the drawn-pending player advances cleanly", () => {
    const core = setupCore(3);
    core.forTest_setTurn("p1");
    core.draw("p1"); // p1 now has a drawn-pending card
    expect(core.getPublicState().drawnPendingPlayerId).toBe("p1");
    core.onPlayerRemoved("p1");
    const pub = core.getPublicState();
    expect(pub.drawnPendingPlayerId).toBeNull();
    expect(pub.currentTurnPlayerId).not.toBe("p1");
  });

  it("disconnected players do not deadlock the early-end vote", () => {
    const core = setupCore(3);
    core.onPlayerLeave("p2"); // disconnected, cannot vote
    expect(core.proposeEnd(true, "p0").ok).toBe(true); // host auto-agrees
    core.voteEnd("p1", { agree: true }); // 2 of 2 connected agree -> end
    expect(core.isOver()).not.toBeNull();
  });

  it("a temporarily disconnected player does not end the game by themselves", () => {
    const core = setupCore(4);
    core.onPlayerLeave("p3");
    expect(core.proposeEnd(true, "p0").ok).toBe(true); // 1 of 3 connected
    expect(core.isOver()).toBeNull();
  });
});
