import { describe, expect, it } from "vitest";
import type {
  PublicPlayerState,
  UpstageCard,
  UpstagePublicState,
} from "@oneshot/shared";
import { UPSTAGE_ACTIONS } from "@oneshot/shared";
import { UpstageModule } from "../src/games/upstage/UpstageModule";

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

const act = (module: UpstageModule, playerId: string, type: string, payload?: unknown, isHost = false) =>
  module.handleAction({ playerId, action: { type, payload, clientActionId: "t" }, isHost });

const startGame = (count: number, seed = "seed") => {
  const module = new UpstageModule();
  const players = makePlayers(count);
  module.start({ players, options: {}, randomSeed: seed });
  return { module, players, host: players[0]! };
};

const effValue = (cards: UpstageCard[], maxRank: number): number => {
  const numbers = cards.filter((c) => c.value !== "star").map((c) => c.value as number);
  return numbers.length === 0 ? maxRank + 1 : numbers[0]!;
};

// A simple legal-move bot. Returns true if it acted (play/pass), false if no move.
const botTurn = (module: UpstageModule, pub: UpstagePublicState): void => {
  const me = pub.currentTurnPlayerId!;
  const priv = module.getStateFor(me);
  const hand = priv.hand;
  const stars = hand.filter((c) => c.value === "star");
  const byValue = new Map<number, UpstageCard[]>();
  for (const c of hand) {
    if (c.value === "star") continue;
    const arr = byValue.get(c.value) ?? [];
    arr.push(c);
    byValue.set(c.value, arr);
  }

  if (!pub.currentPlay) {
    // Lead: dump the largest same-number group (weakest value among ties).
    let best: UpstageCard[] | null = null;
    for (const [, group] of [...byValue.entries()].sort((a, b) => b[0] - a[0])) {
      if (!best || group.length > best.length) best = group;
    }
    const lead = best ?? stars;
    act(module, me, UPSTAGE_ACTIONS.play, { cards: lead.map((c) => c.id) });
    return;
  }

  // Follower: find a set of the right count and a strictly lower value.
  const need = pub.currentPlay.count;
  const target = pub.currentPlay.value;
  for (const [value, group] of [...byValue.entries()].sort((a, b) => b[0] - a[0])) {
    if (value >= target) continue;
    const fillers = stars.length;
    if (group.length + fillers >= need) {
      const useNumbers = group.slice(0, Math.min(need, group.length));
      const useStars = stars.slice(0, need - useNumbers.length);
      const cards = [...useNumbers, ...useStars];
      if (effValue(cards, pub.maxRank) < target && cards.length === need) {
        act(module, me, UPSTAGE_ACTIONS.play, { cards: cards.map((c) => c.id) });
        return;
      }
    }
  }
  act(module, me, UPSTAGE_ACTIONS.pass);
};

// Drive a full game to completion with bots. alwaysDeclineRevolt keeps tax flowing.
const driveToEnd = (module: UpstageModule, players: PublicPlayerState[], penalty: boolean, totalHands: number) => {
  const host = players[0]!;
  act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty, totalHands }, true);

  for (let i = 0; i < 200000; i += 1) {
    if (module.isOver()) break;
    const pub = module.getPublicState();
    switch (pub.phase) {
      case "draw":
        act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
        break;
      case "declare":
        act(module, pub.declarePlayerId!, UPSTAGE_ACTIONS.declare, { revolt: false });
        break;
      case "tax": {
        const receiver = pub.pendingTaxReceivers[0]!;
        const priv = module.getStateFor(receiver);
        // return the weakest cards (end of strongest-first sort)
        const owed = receiver === pub.order[0] ? 2 : 1;
        const give = priv.hand.slice(-owed).map((c) => c.id);
        act(module, receiver, UPSTAGE_ACTIONS.taxReturn, { cards: give });
        break;
      }
      case "play":
        botTurn(module, pub);
        break;
      case "handEnd":
        act(module, host.id, UPSTAGE_ACTIONS.nextHand, undefined, true);
        break;
      default:
        throw new Error(`unexpected phase ${pub.phase}`);
    }
  }
  return module.isOver();
};

describe("UpstageModule — setup", () => {
  it("starts in setup; only host configures", () => {
    const { module, players } = startGame(4);
    expect(module.getPublicState().phase).toBe("setup");
    expect(act(module, players[1]!.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 3 })).toMatchObject({
      ok: false,
      code: "HOST_ONLY",
    });
    expect(act(module, players[0]!.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 3 }, true)).toMatchObject(
      { ok: true },
    );
    expect(module.getPublicState().phase).toBe("draw");
  });

  it("clamps totalHands into range", () => {
    const { module, host } = startGame(3);
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 99 }, true);
    expect(module.getPublicState().totalHands).toBe(10);
  });

  it("uses a 13-rank deck for 9+ players, 12 otherwise", () => {
    expect(startGame(8).module.getPublicState().maxRank).toBe(12);
    expect(startGame(9).module.getPublicState().maxRank).toBe(13);
  });
});

describe("UpstageModule — deck & draw", () => {
  it("deals the whole deck each hand (80 cards for <=8 players)", () => {
    const { module, host, players } = startGame(5);
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 1 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    const total = players.reduce((sum, p) => sum + (module.getStateFor(p.id)).hand.length, 0);
    expect(total).toBe(80);
  });

  it("draw orders players by drawn card (lower is better)", () => {
    const { module, host } = startGame(4);
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 1 }, true);
    const pub = module.getPublicState();
    expect(pub.drawnCards).not.toBeNull();
    const order = pub.order;
    const strength = (id: string) => {
      const c = pub.drawnCards![id]!;
      return c.value === "star" ? pub.maxRank + 1 : (c.value);
    };
    for (let i = 1; i < order.length; i += 1) {
      expect(strength(order[i - 1]!)).toBeLessThanOrEqual(strength(order[i]!));
    }
  });
});

describe("UpstageModule — play validation", () => {
  const setup = (count: number) => {
    const { module, host, players } = startGame(count, "play-seed");
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 1 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    return { module, host, players };
  };

  it("rejects a play out of turn", () => {
    const { module, players } = setup(4);
    const pub = module.getPublicState();
    const notTurn = players.find((p) => p.id !== pub.currentTurnPlayerId)!;
    const hand = (module.getStateFor(notTurn.id)).hand;
    expect(act(module, notTurn.id, UPSTAGE_ACTIONS.play, { cards: [hand[0]!.id] })).toMatchObject({
      ok: false,
      code: "NOT_YOUR_TURN",
    });
  });

  it("rejects a mixed-number set", () => {
    const { module } = setup(4);
    const pub = module.getPublicState();
    const me = pub.currentTurnPlayerId!;
    const hand = (module.getStateFor(me)).hand.filter((c) => c.value !== "star");
    const a = hand.find((c) => c.value !== hand[0]!.value);
    if (a) {
      expect(act(module, me, UPSTAGE_ACTIONS.play, { cards: [hand[0]!.id, a.id] })).toMatchObject({ ok: false });
    }
  });

  it("rejects a follower playing an equal/higher value or wrong count", () => {
    const { module } = setup(4);
    const pub = module.getPublicState();
    const leader = pub.currentTurnPlayerId!;
    const leadHand = (module.getStateFor(leader)).hand.filter((c) => c.value !== "star");
    // lead a single weakest number
    const lead = leadHand[leadHand.length - 1]!;
    act(module, leader, UPSTAGE_ACTIONS.play, { cards: [lead.id] });
    const pub2 = module.getPublicState();
    const follower = pub2.currentTurnPlayerId!;
    const fhand = (module.getStateFor(follower)).hand.filter((c) => c.value !== "star");
    // a card with value >= lead value must be rejected
    const weaker = fhand.find((c) => (c.value as number) >= pub2.currentPlay!.value);
    if (weaker) {
      expect(act(module, follower, UPSTAGE_ACTIONS.play, { cards: [weaker.id] })).toMatchObject({ ok: false });
    }
  });
});

describe("UpstageModule — full games complete", () => {
  for (const count of [3, 6, 9]) {
    for (const penalty of [false, true]) {
      it(`${count} players, penalty=${penalty} finishes with a valid ranking`, () => {
        const { module, players } = startGame(count, `full-${count}-${penalty}`);
        const result = driveToEnd(module, players, penalty, 3);
        expect(result).not.toBeNull();
        expect(result!.ranking).toHaveLength(count);
        expect(result!.winnerPlayerIds.length).toBeGreaterThanOrEqual(1);
        // ranks are 1..count
        const ranks = result!.ranking.map((r) => r.rank).sort((a, b) => a - b);
        expect(ranks).toEqual(Array.from({ length: count }, (_, i) => i + 1));
        // winner has the lowest cumulative score
        const scores = result!.ranking.map((r) => r.scoreDelta!);
        expect(Math.min(...scores)).toBe(result!.ranking[0]!.scoreDelta);
      });
    }
  }
});

describe("UpstageModule — penalty exchange preserves hand sizes", () => {
  it("6 players: two-pair exchange, totals unchanged after tax", () => {
    const { module, host, players } = startGame(6, "tax-seed");
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: true, totalHands: 1 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    // possibly a declare window; decline if so
    let pub = module.getPublicState();
    if (pub.phase === "declare") {
      act(module, pub.declarePlayerId!, UPSTAGE_ACTIONS.declare, { revolt: false });
      pub = module.getPublicState();
    }
    expect(pub.phase).toBe("tax");
    expect(pub.pendingTaxReceivers).toHaveLength(2);
    // receivers return; after the exchange, hand sizes return to the balanced
    // deal (80 cards across 6 players => four 13s + two 14s).
    while (module.getPublicState().phase === "tax") {
      const cur = module.getPublicState();
      const receiver = cur.pendingTaxReceivers[0]!;
      const owed = receiver === cur.order[0] ? 2 : 1;
      const priv = module.getStateFor(receiver);
      act(module, receiver, UPSTAGE_ACTIONS.taxReturn, { cards: priv.hand.slice(-owed).map((c) => c.id) });
    }
    const after = players.map((p) => (module.getStateFor(p.id)).hand.length);
    expect(after.reduce((s, n) => s + n, 0)).toBe(80);
    expect([...after].sort((a, b) => a - b)).toEqual([13, 13, 13, 13, 14, 14]);
    expect(module.getPublicState().phase).toBe("play");
  });
});

describe("UpstageModule — public state hides secrets", () => {
  it("never exposes card contents or star ownership in public state", () => {
    const { module, host } = startGame(4);
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: true, totalHands: 1 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    const json = JSON.stringify(module.getPublicState());
    expect(json).not.toContain("holdsBothStars");
    // public players only carry handCount, not hand arrays
    for (const p of module.getPublicState().players) {
      expect(p).not.toHaveProperty("hand");
      expect(typeof p.handCount).toBe("number");
    }
  });
});

describe("UpstageModule — early-end vote", () => {
  it("majority agree ends the game with completed-hand totals", () => {
    const { module, host, players } = startGame(4, "vote-seed");
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 5 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    // propose during play
    expect(act(module, host.id, UPSTAGE_ACTIONS.proposeEnd, undefined, true)).toMatchObject({ ok: true });
    // others agree
    for (const p of players.slice(1)) {
      act(module, p.id, UPSTAGE_ACTIONS.voteEnd, { agree: true });
    }
    expect(module.isOver()).not.toBeNull();
  });

  it("anyone can propose; a rejected vote clears and starts a cooldown", () => {
    const { module, host, players } = startGame(4, "vote2");
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 5 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    // a non-host guest opens the vote
    expect(act(module, players[1]!.id, UPSTAGE_ACTIONS.proposeEnd)).toMatchObject({ ok: true });
    for (const p of [host, players[2]!, players[3]!]) act(module, p.id, UPSTAGE_ACTIONS.voteEnd, { agree: false });
    expect(module.getPublicState().endVote).toBeNull();
    expect(module.isOver()).toBeNull();
    // rejected → nobody (host included) can re-propose during the cooldown
    expect(module.getPublicState().endVoteCooldownUntil).not.toBeNull();
    expect(act(module, host.id, UPSTAGE_ACTIONS.proposeEnd, undefined, true)).toMatchObject({ ok: false });
  });

  it("any player can advance draw -> hand 1 and handEnd -> next hand", () => {
    const { module, host, players } = startGame(4, "advance");
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 5 }, true);
    expect(module.getPublicState().phase).toBe("draw");
    expect(act(module, players[2]!.id, UPSTAGE_ACTIONS.startHand)).toMatchObject({ ok: true });
    expect(module.getPublicState().phase).toBe("play");
  });
});

describe("UpstageModule — removal", () => {
  it("drops a kicked player without leaving ghosts", () => {
    const { module, host, players } = startGame(5, "kick-seed");
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 1 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    const victim = players[3]!;
    module.onPlayerRemoved(victim.id);
    const pub = module.getPublicState();
    expect(pub.order).not.toContain(victim.id);
    expect(pub.players.find((p) => p.playerId === victim.id)).toBeUndefined();
  });

  // Regression: kicking a pending tax receiver used to delete its debt WITHOUT
  // re-checking "all settled?", stranding the hand in `tax` forever.
  const reachTax = (count: number, seed: string) => {
    const { module, host, players } = startGame(count, seed);
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: true, totalHands: 1 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    if (module.getPublicState().phase === "declare") {
      act(module, module.getPublicState().declarePlayerId!, UPSTAGE_ACTIONS.declare, { revolt: false });
    }
    return { module, host, players };
  };

  it("kicking the only pending tax receiver advances to play (no hang)", () => {
    const { module } = reachTax(5, "tax-kick");
    expect(module.getPublicState().phase).toBe("tax");
    const receiver = module.getPublicState().pendingTaxReceivers[0]!;
    module.onPlayerRemoved(receiver);
    expect(module.getPublicState().phase).toBe("play");
  });

  it("kicking a middle player mid-tax (6p) lets remaining receivers still settle", () => {
    const { module, players } = reachTax(6, "tax-kick-6");
    const pub = module.getPublicState();
    expect(pub.phase).toBe("tax");
    expect(pub.pendingTaxReceivers).toHaveLength(2);
    // remove a player who is neither receiver nor giver of one pair
    const involved = new Set([...pub.pendingTaxReceivers, pub.order[pub.order.length - 1]]);
    const middle = players.find((p) => !involved.has(p.id))!;
    module.onPlayerRemoved(middle.id);
    // drive remaining receivers to completion — must not get stuck
    let guard = 0;
    while (module.getPublicState().phase === "tax" && guard++ < 10) {
      const cur = module.getPublicState();
      const r = cur.pendingTaxReceivers[0]!;
      const owed = r === cur.order[0] ? 2 : 1;
      const priv = module.getStateFor(r);
      const res = act(module, r, UPSTAGE_ACTIONS.taxReturn, { cards: priv.hand.slice(-owed).map((c) => c.id) });
      expect(res).toMatchObject({ ok: true });
    }
    expect(module.getPublicState().phase).toBe("play");
  });
});

describe("UpstageModule — early-end vote with disconnects", () => {
  it("resolves against the CONNECTED base (a disconnect can't deadlock it)", () => {
    const { module, host, players } = startGame(4, "vote-dc");
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 5 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    act(module, host.id, UPSTAGE_ACTIONS.proposeEnd, undefined, true); // host auto-yes
    module.onPlayerLeave(players[3]!.id); // one drops -> connected base = 3
    act(module, players[1]!.id, UPSTAGE_ACTIONS.voteEnd, { agree: true }); // 2/3 connected
    expect(module.isOver()).not.toBeNull();
  });

  it("a connected-majority reject clears the vote (no hang)", () => {
    const { module, host, players } = startGame(4, "vote-dc2");
    act(module, host.id, UPSTAGE_ACTIONS.configure, { penalty: false, totalHands: 5 }, true);
    act(module, host.id, UPSTAGE_ACTIONS.startHand, undefined, true);
    act(module, host.id, UPSTAGE_ACTIONS.proposeEnd, undefined, true);
    module.onPlayerLeave(players[3]!.id);
    act(module, players[1]!.id, UPSTAGE_ACTIONS.voteEnd, { agree: false });
    act(module, players[2]!.id, UPSTAGE_ACTIONS.voteEnd, { agree: false });
    expect(module.getPublicState().endVote).toBeNull();
    expect(module.isOver()).toBeNull();
  });
});
