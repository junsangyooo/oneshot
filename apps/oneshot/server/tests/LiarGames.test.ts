import { describe, expect, it } from "vitest";
import type { LiarCategoryId, LiarPrivateState, PublicPlayerState } from "@oneshot/shared";
import { FOOL_LIAR_ACTIONS, LIAR_ACTIONS, LIAR_CATEGORIES, maxLiarsFor } from "@oneshot/shared";
import type { GameModule } from "../src/games/GameModule";
import { FoolLiarModule } from "../src/games/fool-liar/FoolLiarModule";
import { LiarModule } from "../src/games/liar/LiarModule";

type AnyLiar = GameModule<unknown, unknown, unknown>;

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

const act = (module: AnyLiar, playerId: string, type: string, payload: unknown, isHost = false) =>
  module.handleAction({ playerId, action: { type, payload, clientActionId: "test" }, isHost });

const states = (module: AnyLiar, players: PublicPlayerState[]): LiarPrivateState[] =>
  players.map((p) => module.getStateFor(p.id) as LiarPrivateState);

describe("LiarModule (라이어)", () => {
  it("starts in setup with no category or liars", () => {
    const module = new LiarModule();
    module.start({ players: makePlayers(4), options: {}, randomSeed: "s" });
    const pub = module.getPublicState();
    expect(pub.phase).toBe("setup");
    expect(pub.categoryId).toBeNull();
    expect(pub.liarCount).toBe(0);
    expect(pub.maxLiars).toBe(1);
    expect(pub.playerCount).toBe(4);
  });

  it("only the host can configure, and rejects bad payloads", () => {
    const module = new LiarModule();
    const players = makePlayers(6);
    module.start({ players, options: {}, randomSeed: "s" });

    expect(
      act(module, players[1]!.id, LIAR_ACTIONS.configure, { categoryId: "fruits", liarCount: 1 }, false),
    ).toMatchObject({ ok: false, code: "HOST_ONLY" });
    expect(
      act(module, players[0]!.id, LIAR_ACTIONS.configure, { categoryId: "nope", liarCount: 1 }, true),
    ).toMatchObject({ ok: false, code: "INVALID_ACTION" });
    // 6 players -> maxLiars = floor(6/5)+1 = 2; asking for 3 is out of range
    expect(
      act(module, players[0]!.id, LIAR_ACTIONS.configure, { categoryId: "fruits", liarCount: 3 }, true),
    ).toMatchObject({ ok: false, code: "INVALID_ACTION" });
    expect(module.getPublicState().phase).toBe("setup");
  });

  it("deals exactly N liars who each hold the 'liar' card; everyone else shares one answer word", () => {
    for (let round = 0; round < 50; round += 1) {
      const module = new LiarModule();
      const players = makePlayers(7);
      module.start({ players, options: {}, randomSeed: `liar-${round}` });
      const liarCount = (round % maxLiarsFor(7)) + 1; // 1..2
      const res = act(module, players[0]!.id, LIAR_ACTIONS.configure, { categoryId: "animals", liarCount }, true);
      expect(res).toMatchObject({ ok: true });

      const cards = states(module, players).map((s) => s.card);
      const liars = cards.filter((c) => c?.kind === "liar");
      const citizens = cards.filter((c) => c?.kind === "word");
      expect(liars).toHaveLength(liarCount);
      expect(citizens).toHaveLength(7 - liarCount);

      // All citizens share the single answer word index.
      const answerIndexes = new Set(
        citizens.map((c) => (c?.kind === "word" ? c.wordIndex : -1)),
      );
      expect(answerIndexes.size).toBe(1);

      // Public state never leaks who/what.
      const pub = module.getPublicState();
      expect(pub.phase).toBe("reveal");
      expect(pub.liarCount).toBe(liarCount);
      expect(JSON.stringify(pub)).not.toContain("wordIndex");
    }
  });

  it("double-configure is rejected", () => {
    const module = new LiarModule();
    const players = makePlayers(4);
    module.start({ players, options: {}, randomSeed: "s" });
    expect(act(module, players[0]!.id, LIAR_ACTIONS.configure, { categoryId: "jobs", liarCount: 1 }, true)).toMatchObject({ ok: true });
    expect(act(module, players[0]!.id, LIAR_ACTIONS.configure, { categoryId: "jobs", liarCount: 1 }, true)).toMatchObject({ ok: false, code: "INVALID_ACTION" });
  });

  it("host ends the game with an empty ranking (no public reveal)", () => {
    const module = new LiarModule();
    const players = makePlayers(5);
    module.start({ players, options: {}, randomSeed: "s" });
    act(module, players[0]!.id, LIAR_ACTIONS.configure, { categoryId: "sports", liarCount: 2 }, true);
    expect(module.isOver()).toBeNull();
    expect(act(module, players[1]!.id, LIAR_ACTIONS.endGame, undefined, false)).toMatchObject({ ok: false, code: "HOST_ONLY" });
    expect(act(module, players[0]!.id, LIAR_ACTIONS.endGame, undefined, true)).toMatchObject({ ok: true });
    const result = module.isOver();
    expect(result?.ranking).toEqual([]);
    expect(result?.winnerPlayerIds).toEqual([]);
  });

  it("removing a kicked player drops their card", () => {
    const module = new LiarModule();
    const players = makePlayers(5);
    module.start({ players, options: {}, randomSeed: "s" });
    act(module, players[0]!.id, LIAR_ACTIONS.configure, { categoryId: "brands", liarCount: 1 }, true);
    module.onPlayerRemoved(players[4]!.id);
    expect(module.getStateFor(players[4]!.id).card).toBeNull();
    expect(module.getPublicState().playerCount).toBe(4);
  });
});

describe("FoolLiarModule (바보 라이어)", () => {
  it("liars all hold the SAME word, different from the citizens' answer", () => {
    for (let round = 0; round < 50; round += 1) {
      const module = new FoolLiarModule();
      const players = makePlayers(11); // maxLiars = floor(11/5)+1 = 3
      module.start({ players, options: {}, randomSeed: `fool-${round}` });
      const liarCount = (round % maxLiarsFor(11)) + 1; // 1..3
      const res = act(module, players[0]!.id, FOOL_LIAR_ACTIONS.configure, { categoryId: "vegetables", liarCount }, true);
      expect(res).toMatchObject({ ok: true });

      const cards = states(module, players).map((s) => s.card);
      // No "liar" cards exist in fool-liar — everyone holds a word.
      expect(cards.every((c) => c?.kind === "word")).toBe(true);

      const wordIndexes = cards.map((c) => (c?.kind === "word" ? c.wordIndex : -1));
      const counts = new Map<number, number>();
      for (const idx of wordIndexes) counts.set(idx, (counts.get(idx) ?? 0) + 1);
      // Exactly two distinct words: the answer (citizens) and the decoy (liars).
      expect(counts.size).toBe(2);
      const sorted = [...counts.values()].sort((a, b) => a - b);
      expect(sorted).toEqual([liarCount, 11 - liarCount].sort((a, b) => a - b));
    }
  });

  it("liar action namespaces do not cross between the two games", () => {
    const module = new FoolLiarModule();
    const players = makePlayers(4);
    module.start({ players, options: {}, randomSeed: "s" });
    // A "liar:configure" action must NOT be accepted by the fool-liar module.
    expect(act(module, players[0]!.id, LIAR_ACTIONS.configure, { categoryId: "fruits", liarCount: 1 }, true)).toMatchObject({ ok: false, code: "INVALID_ACTION" });
    expect(module.getPublicState().phase).toBe("setup");
  });
});

describe("category word pools", () => {
  it("every category has at least 50 bilingual words", () => {
    for (const id of Object.keys(LIAR_CATEGORIES) as LiarCategoryId[]) {
      const words = LIAR_CATEGORIES[id];
      expect(words.length).toBeGreaterThanOrEqual(50);
      for (const word of words) {
        expect(word.ko.length).toBeGreaterThan(0);
        expect(word.en.length).toBeGreaterThan(0);
      }
    }
  });
});
