import { describe, expect, it } from "vitest";
import type { Tile } from "@oneshot/shared";
import { grabChain } from "./tileSort";

const T = (color: "red" | "blue" | "orange" | "black", num: number, tag = ""): Tile => ({
  id: `${color}-${num}-${tag}`,
  kind: "num",
  color,
  num,
});
const JOKER: Tile = { id: "joker-a", kind: "joker" };

// grabChain returns the full chain rightwards; the screen reveals it one tile
// at a time, so chain[0..n] is what you hold after n steps.
describe("grabChain (progressive long-press)", () => {
  it("walks a run rightwards from the pressed tile", () => {
    const rack = [T("red", 3), T("red", 4), T("red", 5), T("red", 6)];
    expect(grabChain(rack, "red-3-")).toEqual(["red-3-", "red-4-", "red-5-", "red-6-"]);
  });

  it("only walks rightwards — tiles to the left are never pulled in", () => {
    const rack = [T("red", 3), T("red", 4), T("red", 5), T("red", 6)];
    expect(grabChain(rack, "red-5-")).toEqual(["red-5-", "red-6-"]);
  });

  it("walks a group rightwards and stops at four colours", () => {
    const rack = [T("red", 7), T("blue", 7), T("orange", 7), T("black", 7), T("red", 9)];
    expect(grabChain(rack, "red-7-")).toEqual(["red-7-", "blue-7-", "orange-7-", "black-7-"]);
  });

  it("stops at the first tile that breaks the chain", () => {
    const rack = [T("red", 3), T("red", 4), T("blue", 9), T("red", 5)];
    expect(grabChain(rack, "red-3-")).toEqual(["red-3-", "red-4-"]);
  });

  it("gives just the pressed tile when the neighbour doesn't continue it", () => {
    const rack = [T("red", 3), T("blue", 9), T("black", 13)];
    expect(grabChain(rack, "red-3-")).toEqual(["red-3-"]);
  });

  it("gives just the pressed tile when it is the last in the rack", () => {
    const rack = [T("red", 3), T("red", 4)];
    expect(grabChain(rack, "red-4-")).toEqual(["red-4-"]);
  });

  it("follows the displayed order, not the tile values", () => {
    // a 777-sorted rack puts same numbers together, so the chain is a group
    const rack = [T("red", 5), T("blue", 5), T("black", 5), T("red", 6)];
    expect(grabChain(rack, "red-5-")).toEqual(["red-5-", "blue-5-", "black-5-"]);
  });

  it("never auto-pulls a joker and never chains from one", () => {
    const rack = [T("red", 3), T("red", 4), JOKER, T("red", 5)];
    expect(grabChain(rack, "red-3-")).toEqual(["red-3-", "red-4-"]);
    expect(grabChain(rack, "joker-a")).toEqual(["joker-a"]);
  });

  it("does not take the same colour twice in a group", () => {
    const rack = [T("blue", 3, "a"), T("blue", 3, "b"), T("red", 3)];
    expect(grabChain(rack, "blue-3-a")).toEqual(["blue-3-a"]);
  });
});
