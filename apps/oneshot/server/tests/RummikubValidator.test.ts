import { describe, expect, it } from "vitest";
import {
  buildRummikubDeck,
  classifyMeld,
  handSum,
  isValidMeld,
  meldValue,
  type Tile,
  type TileColor,
} from "@oneshot/shared";

// Terse tile constructors for readable specs.
let seq = 0;
const n = (color: TileColor, num: number): Tile => ({
  id: `${color}-${num}-${seq++}`,
  kind: "num",
  color,
  num,
});
const j = (): Tile => ({ id: `joker-${seq++}`, kind: "joker" });

describe("classifyMeld — groups", () => {
  it("accepts a 3-tile group of distinct colors", () => {
    const cls = classifyMeld([n("red", 7), n("blue", 7), n("black", 7)]);
    expect(cls.valid).toBe(true);
    if (cls.valid) expect(cls.kind).toBe("group");
  });

  it("accepts a 4-tile group (all four colors)", () => {
    expect(isValidMeld([n("red", 5), n("blue", 5), n("black", 5), n("orange", 5)])).toBe(true);
  });

  it("rejects a group with a duplicate color", () => {
    expect(isValidMeld([n("red", 7), n("red", 7), n("blue", 7)])).toBe(false);
  });

  it("rejects a group of 5 (more than four colors possible)", () => {
    // Same-number 5-long can't be a group; also can't be a run (mixed colors).
    expect(isValidMeld([n("red", 7), n("blue", 7), n("black", 7), n("orange", 7), j()])).toBe(false);
  });

  it("fills a missing color with a joker", () => {
    const cls = classifyMeld([n("red", 9), n("blue", 9), j()]);
    expect(cls.valid).toBe(true);
    if (cls.valid) {
      expect(cls.kind).toBe("group");
      expect(Object.values(cls.jokerValues)[0]).toBe(9);
    }
  });
});

describe("classifyMeld — runs", () => {
  it("accepts a plain consecutive run", () => {
    const cls = classifyMeld([n("red", 4), n("red", 5), n("red", 6)]);
    expect(cls.valid).toBe(true);
    if (cls.valid) expect(cls.kind).toBe("run");
  });

  it("rejects a run with a color break", () => {
    expect(isValidMeld([n("red", 4), n("blue", 5), n("red", 6)])).toBe(false);
  });

  it("rejects a non-consecutive run", () => {
    expect(isValidMeld([n("red", 4), n("red", 6), n("red", 7)])).toBe(false);
  });

  it("treats 12-13-joker as 11-12-13 (joker extends down, never wraps past 13)", () => {
    const cls = classifyMeld([n("red", 12), n("red", 13), j()]);
    expect(cls.valid).toBe(true);
    if (cls.valid) expect(Object.values(cls.jokerValues)[0]).toBe(11);
  });

  it("rejects reals too far apart for any window (1 and 13 with one joker)", () => {
    expect(isValidMeld([n("red", 1), n("red", 13), j()])).toBe(false);
  });

  it("accepts 11-12-13 exactly at the top", () => {
    expect(isValidMeld([n("red", 11), n("red", 12), n("red", 13)])).toBe(true);
  });

  it("fills an interior gap with a joker", () => {
    const cls = classifyMeld([n("blue", 4), j(), n("blue", 6)]);
    expect(cls.valid).toBe(true);
    if (cls.valid) {
      expect(cls.kind).toBe("run");
      expect(Object.values(cls.jokerValues)[0]).toBe(5);
    }
  });

  it("uses a joker to extend the low end", () => {
    // joker-2-3 => joker must be 1
    const cls = classifyMeld([j(), n("red", 2), n("red", 3)]);
    expect(cls.valid).toBe(true);
    if (cls.valid) expect(Object.values(cls.jokerValues)[0]).toBe(1);
  });

  it("rejects a run with a duplicate number", () => {
    expect(isValidMeld([n("red", 5), n("red", 5), n("red", 6)])).toBe(false);
  });
});

describe("classifyMeld — length + jokers", () => {
  it("rejects a 2-tile meld", () => {
    expect(isValidMeld([n("red", 7), n("blue", 7)])).toBe(false);
  });

  it("accepts a long run with two jokers", () => {
    // 4 _ 6 7 _  -> 4 5 6 7 8
    const cls = classifyMeld([n("red", 4), j(), n("red", 6), n("red", 7), j()]);
    expect(cls.valid).toBe(true);
    if (cls.valid) expect(cls.kind).toBe("run");
  });

  it("accepts a 3-joker meld as a group", () => {
    expect(isValidMeld([j(), j(), j()])).toBe(true);
  });
});

describe("meldValue", () => {
  it("sums a plain run", () => {
    expect(meldValue([n("red", 4), n("red", 5), n("red", 6)])).toBe(15);
  });

  it("counts a joker as the value it represents in a run", () => {
    expect(meldValue([n("blue", 4), j(), n("blue", 6)])).toBe(15); // 4+5+6
  });

  it("counts a joker as the group number", () => {
    expect(meldValue([n("red", 10), n("blue", 10), j()])).toBe(30); // 10*3
  });

  it("returns 0 for an invalid meld", () => {
    expect(meldValue([n("red", 4), n("blue", 5), n("red", 6)])).toBe(0);
  });
});

describe("handSum", () => {
  it("counts a joker as 30 in hand", () => {
    expect(handSum([j(), n("red", 5)])).toBe(35);
  });
});

describe("buildRummikubDeck", () => {
  it("builds 106 tiles for one deck", () => {
    const deck = buildRummikubDeck(1);
    expect(deck.length).toBe(106); // 13*4*2 + 2
    expect(deck.filter((t) => t.kind === "joker").length).toBe(2);
    expect(new Set(deck.map((t) => t.id)).size).toBe(106); // all ids unique
  });

  it("builds 212 tiles for two decks", () => {
    const deck = buildRummikubDeck(2);
    expect(deck.length).toBe(212); // 13*4*4 + 4
    expect(deck.filter((t) => t.kind === "joker").length).toBe(4);
    expect(new Set(deck.map((t) => t.id)).size).toBe(212);
  });
});
