import { describe, expect, it } from "vitest";
import type { Tile } from "@oneshot/shared";
import { autoExtend } from "./tileSort";

const T = (color: "red" | "blue" | "orange" | "black", num: number, tag = ""): Tile => ({
  id: `${color}-${num}-${tag}`,
  kind: "num",
  color,
  num,
});
const JOKER: Tile = { id: "joker-a", kind: "joker" };

describe("autoExtend (long-press grab)", () => {
  it("takes the whole run around the pressed tile", () => {
    const hand = [T("orange", 11), T("orange", 12), T("orange", 13), T("red", 4)];
    expect(autoExtend(hand, "orange-12-")).toEqual(["orange-11-", "orange-12-", "orange-13-"]);
  });

  // The grab is not gated on the result being a legal meld — a 7-8 you mean to
  // drop onto an existing 6 has to come along too.
  it("takes a two-tile partial run", () => {
    const hand = [T("blue", 7), T("blue", 8), T("red", 2)];
    expect(autoExtend(hand, "blue-7-")).toEqual(["blue-7-", "blue-8-"]);
  });

  it("takes a two-colour partial group", () => {
    const hand = [T("red", 9), T("blue", 9), T("orange", 2)];
    expect(autoExtend(hand, "red-9-")).toEqual(["red-9-", "blue-9-"]);
  });

  it("prefers the longer of run and group", () => {
    const hand = [T("red", 5), T("red", 6), T("red", 7), T("blue", 5), T("black", 5)];
    expect(autoExtend(hand, "red-5-")).toEqual(["red-5-", "red-6-", "red-7-"]);
  });

  it("falls back to just the pressed tile when nothing connects", () => {
    const hand = [T("red", 3), T("blue", 9), T("black", 13)];
    expect(autoExtend(hand, "red-3-")).toEqual(["red-3-"]);
  });

  it("never auto-pulls a joker, and pressing one grabs only it", () => {
    const hand = [T("red", 5), T("red", 6), JOKER];
    expect(autoExtend(hand, "joker-a")).toEqual(["joker-a"]);
    expect(autoExtend(hand, "red-5-")).toEqual(["red-5-", "red-6-"]);
  });

  it("does not put the same colour twice in a group", () => {
    const hand = [T("blue", 3, "a"), T("blue", 3, "b"), T("red", 3)];
    const got = autoExtend(hand, "blue-3-a");
    expect(got).toHaveLength(2);
    expect(new Set(got)).toEqual(new Set(["blue-3-a", "red-3-"]));
  });
});
