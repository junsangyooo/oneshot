import { describe, expect, it } from "vitest";
import type { Tile } from "@oneshot/shared";
import { autoSplit, checkCommit, jokerInfo, normalizeMeld, place, stageFromServer } from "./staging";

const T = (color: "red" | "blue" | "orange" | "black", num: number, tag = ""): Tile => ({
  id: `${color}-${num}-${tag}`,
  kind: "num",
  color,
  num,
});
const JOKER = (tag: string): Tile => ({ id: `joker-${tag}`, kind: "joker" });

const faces = (tiles: Tile[]): string[] =>
  tiles.map((t) => (t.kind === "joker" ? "JK" : `${t.color[0]}${t.num}`));
const boardFaces = (board: { tiles: Tile[] }[]): string[][] => board.map((m) => faces(m.tiles));

describe("autoSplit", () => {
  it("splits a run broken by a duplicate into two valid runs", () => {
    const merged = [T("red", 5), T("red", 6), T("red", 7, "a"), T("red", 7, "b"), T("red", 8), T("red", 9)];
    const parts = autoSplit(merged, 3);
    expect(parts).not.toBeNull();
    expect(parts!.map(faces)).toEqual([
      ["r5", "r6", "r7"],
      ["r7", "r8", "r9"],
    ]);
  });

  it("leaves an already-valid meld untouched", () => {
    const tiles = [T("blue", 3), T("blue", 4), T("blue", 5)];
    expect(autoSplit(tiles, 1)).toEqual([tiles]);
  });

  it("returns null when no single cut makes both halves valid", () => {
    // a blue tile wedged into a red run can't be rescued by splitting
    const merged = [T("red", 5), T("red", 6), T("red", 7), T("blue", 9)];
    expect(autoSplit(merged, 4)).toBeNull();
  });
});

describe("normalizeMeld", () => {
  it("orders a run ascending regardless of how it was dropped", () => {
    const out = normalizeMeld([T("orange", 12), T("orange", 13), T("orange", 11)]);
    expect(faces(out)).toEqual(["o11", "o12", "o13"]);
  });

  it("slots a joker into the gap it fills", () => {
    const out = normalizeMeld([T("red", 7), T("red", 5), JOKER("a")]);
    expect(faces(out)).toEqual(["r5", "JK", "r7"]);
  });

  it("orders a group by colour", () => {
    const out = normalizeMeld([T("black", 4), T("blue", 4), T("red", 4)]);
    expect(out.map((t) => (t.kind === "num" ? t.color : "joker"))).toEqual(["red", "blue", "black"]);
  });

  it("leaves an invalid meld alone so the player can see what they built", () => {
    const messy = [T("red", 5), T("blue", 9), T("red", 6)];
    expect(faces(normalizeMeld(messy))).toEqual(["r5", "b9", "r6"]);
  });
});

describe("place", () => {
  it("auto-splits when a tile is wedged into an existing run", () => {
    const stage = stageFromServer(
      [{ id: "m1", tiles: [T("red", 5), T("red", 6), T("red", 7, "a"), T("red", 8), T("red", 9)] }],
      [T("red", 7, "b")],
    );
    const next = place(stage, ["red-7-b"], { zone: "meld", meldId: "m1", index: 2 }, true);
    expect(next).not.toBeNull();
    expect(boardFaces(next!.board)).toEqual([
      ["r5", "r6", "r7"],
      ["r7", "r8", "r9"],
    ]);
    expect(next!.hand).toHaveLength(0);
  });

  it("normalizes a brand-new set dropped in any order", () => {
    const stage = stageFromServer([], [T("orange", 12), T("orange", 13), T("orange", 11)]);
    const next = place(stage, ["orange-12-", "orange-13-", "orange-11-"], { zone: "new" }, false);
    expect(boardFaces(next!.board)).toEqual([["o11", "o12", "o13"]]);
  });

  it("refuses to pull a tile that was already on the table back into hand", () => {
    const stage = stageFromServer([{ id: "m1", tiles: [T("red", 5), T("red", 6), T("red", 7)] }], []);
    expect(place(stage, ["red-5-"], { zone: "hand" }, true)).toBeNull();
  });

  it("refuses to touch the board before the initial meld", () => {
    const stage = stageFromServer([{ id: "m1", tiles: [T("red", 5), T("red", 6), T("red", 7)] }], []);
    expect(place(stage, ["red-5-"], { zone: "new" }, false)).toBeNull();
  });

  // The server rejects any pre-initial meld that mixes board tiles with hand
  // tiles ("첫 등록에서는 이미 놓인 세트를 건드릴 수 없습니다"), so the staging
  // mirror must refuse the drop too — otherwise the green check lies and the
  // commit bounces.
  it("refuses to drop a hand tile INTO an existing set before the initial meld", () => {
    const stage = stageFromServer(
      [{ id: "m1", tiles: [T("red", 5), T("red", 6), T("red", 7)] }],
      [T("red", 8)],
    );
    expect(place(stage, ["red-8-"], { zone: "meld", meldId: "m1" }, false)).toBeNull();
  });
});

describe("checkCommit — initial meld mirrors the server", () => {
  it("rejects a pre-initial board where a set mixes locked and played tiles", () => {
    const stage = stageFromServer(
      [{ id: "m1", tiles: [T("red", 5), T("red", 6), T("red", 7)] }],
      [T("red", 8), T("red", 10), T("blue", 10), T("black", 10)],
    );
    // wedge r8 into the locked run, and stage a legal 30-point group besides
    const wedged = place(stage, ["red-8-"], { zone: "meld", meldId: "m1" }, true)!;
    const withGroup = place(wedged, ["red-10-", "blue-10-", "black-10-"], { zone: "new" }, true)!;
    const check = checkCommit(withGroup, false);
    expect(check.ok).toBe(false);
  });

  it("accepts a clean 30-point initial meld next to an untouched board", () => {
    const stage = stageFromServer(
      [{ id: "m1", tiles: [T("red", 5), T("red", 6), T("red", 7)] }],
      [T("red", 10), T("blue", 10), T("black", 10)],
    );
    const staged = place(stage, ["red-10-", "blue-10-", "black-10-"], { zone: "new" }, true)!;
    expect(checkCommit(staged, false)).toEqual({ ok: true });
  });
});

describe("jokerInfo", () => {
  it("reports the value and colour a joker stands for in a run", () => {
    const tiles = [T("red", 5), JOKER("a"), T("red", 7)];
    expect(jokerInfo(tiles)).toEqual({ "joker-a": { num: 6, color: "red" } });
  });

  it("reports only the number for a group joker", () => {
    const tiles = [T("red", 9), T("blue", 9), JOKER("a")];
    expect(jokerInfo(tiles)).toEqual({ "joker-a": { num: 9, color: undefined } });
  });

  it("reports nothing for an invalid meld", () => {
    expect(jokerInfo([T("red", 5), T("blue", 9), JOKER("a")])).toEqual({});
  });
});
