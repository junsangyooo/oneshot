import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

/* TILE (Rummikub) — locks in the first-time-player fixes:
   the rotate wall must never trap a desktop window, the long-press set-select
   must survive letting go, a cancelled drag must put the tiles back, and the
   action bar must not overflow a phone.
   Requires the dev servers (client :5173 + server :2567) to be running. */

const nicknameInput = (page: Page) => page.getByPlaceholder("이름을 입력하세요...");

// Games auto-fullscreen on touch devices; a fullscreen window can't be resized,
// which would break the viewport assertions below. Opt every test context out.
const gameContext = async (browser: Browser) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => localStorage.setItem("oneshot.fullscreen", "off"));
  return ctx;
};

const createRoom = async (page: Page, nickname: string): Promise<string> => {
  await page.goto("/");
  await nicknameInput(page).fill(nickname);
  await page.getByRole("button", { name: "방 만들기" }).click();
  await expect(page.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
  const link = await page.locator(".link-url").innerText();
  const code = link.match(/\/r\/([A-Z0-9]{4,8})/)?.[1];
  expect(code, `invite link should contain a room code: ${link}`).toBeTruthy();
  return code as string;
};

const joinRoom = async (page: Page, code: string, nickname: string): Promise<void> => {
  await page.goto(`/r/${code}`);
  await nicknameInput(page).fill(nickname);
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
};

// A portrait phone legitimately gets the rotate prompt; take its escape hatch so
// the specs can drive the board. (A desktop window must never see it at all —
// that is asserted separately.)
const dismissRotate = async (page: Page): Promise<void> => {
  const dismiss = page.getByRole("button", { name: "그대로 계속하기" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await expect(page.locator(".rk-rotate")).toHaveCount(0);
};

// Seat two players, pick TILE, and deal with an unlimited turn clock.
const startTile = async (browser: Browser) => {
  const hostContext = await gameContext(browser);
  const guestContext = await gameContext(browser);
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  const code = await createRoom(host, "초보자");
  await joinRoom(guest, code, "친구B");

  await host.locator(".mod", { hasText: "타일" }).click();
  await expect(host.locator(".cur .title, .sel-title, .title").first()).toContainText(/타일/);
  await host.getByRole("button", { name: /게임 시작/ }).click();
  await expect(host.getByRole("heading", { name: "타일 설정" })).toBeVisible({ timeout: 10_000 });

  // step the turn clock up to "무제한" so the spec never races a timeout
  const up = host.locator(".rk-stepper__arrow").first();
  for (let i = 0; i < 3; i += 1) await up.click();
  await expect(host.locator(".rk-stepper__value")).toHaveText("무제한");
  await host.getByRole("button", { name: "게임 시작" }).click();
  await expect(host.locator(".rk-rack .rk-tile").first()).toBeVisible({ timeout: 10_000 });
  await dismissRotate(host);
  await dismissRotate(guest);

  return { host, guest, hostContext, guestContext };
};

test.describe("TILE", () => {
  test("a desktop window is never walled off by the rotate prompt", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "desktop-only guard");
    const { host, hostContext, guestContext } = await startTile(browser);

    // a tall, narrow desktop window is portrait — but has nothing to rotate
    await host.setViewportSize({ width: 600, height: 900 });
    await expect(host.locator(".rk-rotate")).toHaveCount(0);
    await expect(host.locator(".rk-rack")).toBeVisible();

    await guestContext.close();
    await hostContext.close();
  });

  test("holding picks tiles up one at a time; releasing drops all of it", async ({ browser }) => {
    const { host, hostContext, guestContext } = await startTile(browser);

    const first = host.locator(".rk-rack .rk-tilebtn").first();
    const box = (await first.boundingBox())!;
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();

    // the press reads immediately, but nothing is grabbed for the first second
    await expect(host.locator(".rk-rack .rk-tile.is-press")).toHaveCount(1, { timeout: 300 });
    await host.waitForTimeout(500);
    await expect(host.locator(".rk-tile.is-sel")).toHaveCount(0);

    // first step at ~1s picks up the pressed tile (plus its neighbour when the
    // chain continues), and it never shrinks while the hold lasts
    await host.waitForTimeout(700);
    const afterFirst = await host.locator(".rk-tile.is-sel").count();
    expect(afterFirst).toBeGreaterThan(0);
    await host.waitForTimeout(600);
    expect(await host.locator(".rk-tile.is-sel").count()).toBeGreaterThanOrEqual(afterFirst);

    await host.mouse.up();
    // letting go of a grab leaves you holding nothing
    await expect(host.locator(".rk-tile.is-sel")).toHaveCount(0);

    await guestContext.close();
    await hostContext.close();
  });

  test("starting a drag freezes how much the hold picked up", async ({ browser }) => {
    const { host, hostContext, guestContext } = await startTile(browser);

    const first = host.locator(".rk-rack .rk-tilebtn").first();
    const box = (await first.boundingBox())!;
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();
    await host.waitForTimeout(1150); // one step in
    const held = await host.locator(".rk-tile.is-sel").count();
    expect(held).toBeGreaterThan(0);

    await host.mouse.move(box.x + box.width / 2, box.y - 80, { steps: 6 });
    await host.waitForTimeout(1600); // three more steps would have fired by now

    // the ghost still carries exactly what was held when the drag began
    await expect(host.locator(".rk-ghost .rk-tile")).toHaveCount(held);
    await host.mouse.up();

    await guestContext.close();
    await hostContext.close();
  });

  test("the deck button draws and ends the turn even with tiles staged", async ({ browser }) => {
    const { host, guest, hostContext, guestContext } = await startTile(browser);

    // stage a tile onto the field, then change your mind and draw instead
    const first = host.locator(".rk-rack .rk-tilebtn").first();
    const box = (await first.boundingBox())!;
    const drop = (await host.locator('[data-drop="new"]').boundingBox())!;
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();
    await host.mouse.move(drop.x + drop.width / 2, drop.y + drop.height / 2, { steps: 8 });
    await host.mouse.up();
    await expect(host.locator(".rk-meld:not(.rk-meld--new)")).toHaveCount(1);

    // one staged tile is never a legal turn, so the primary button is still DRAW
    const main = host.locator(".rk-main");
    await expect(main).toBeEnabled(); // stays live even mid-staging
    await expect(host.locator(".rk-main.is-commit")).toHaveCount(0);
    await main.click(); // ONE click — no confirm step

    // staging is discarded, a tile is taken, and the turn moves on
    await expect(host.locator(".rk-meld:not(.rk-meld--new)")).toHaveCount(0);
    await expect(host.locator(".rk-rack .rk-tile")).toHaveCount(15);
    await expect(guest.locator(".rail-seat.is-turn.is-me")).toBeVisible({ timeout: 10_000 });

    await guestContext.close();
    await hostContext.close();
  });

  test("the turn clock ticks down for the player who is not acting", async ({ browser }) => {
    const hostContext = await gameContext(browser);
    const guestContext = await gameContext(browser);
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const code = await createRoom(host, "초보자");
    await joinRoom(guest, code, "친구B");
    await host.locator(".mod", { hasText: "타일" }).click();
    await host.getByRole("button", { name: /게임 시작/ }).click();
    await expect(host.getByRole("heading", { name: "타일 설정" })).toBeVisible({ timeout: 10_000 });
    await host.getByRole("button", { name: "게임 시작" }).click(); // keep the default 60s clock
    await dismissRotate(guest);

    // the waiting player sees the same clock draining, on the active portrait
    const timer = guest.locator(".rail-seat.is-turn .rail-seat__timer");
    await expect(timer).toBeVisible({ timeout: 10_000 });
    const first = Number(await timer.innerText());
    await guest.waitForTimeout(2500);
    const later = Number(await timer.innerText());
    expect(later).toBeLessThan(first);

    await guestContext.close();
    await hostContext.close();
  });

  test("a drag dropped on nothing puts the tile back", async ({ browser }) => {
    const { host, hostContext, guestContext } = await startTile(browser);

    const handCount = await host.locator(".rk-rack .rk-tile").count();
    const first = host.locator(".rk-rack .rk-tilebtn").first();
    const box = (await first.boundingBox())!;
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();
    await host.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 5 });
    await host.mouse.move(10, 6, { steps: 5 }); // dead space in the top bar
    await expect(host.locator(".rk-ghost")).toBeVisible();
    await host.mouse.up();

    await expect(host.locator(".rk-ghost")).toHaveCount(0, { timeout: 2_000 });
    await expect(host.locator(".rk-rack .rk-tile")).toHaveCount(handCount);
    await expect(host.locator(".rk-meld:not(.rk-meld--new)")).toHaveCount(0);

    await guestContext.close();
    await hostContext.close();
  });

  test("the coach line explains why the turn can't end yet", async ({ browser }) => {
    const { host, hostContext, guestContext } = await startTile(browser);

    await expect(host.locator(".rk-coach")).toHaveText(/타일을 필드로 끌어다 놓으세요/);
    // nothing legal staged -> the primary button is the deck, not the green check
    await expect(host.locator(".rk-main")).toBeVisible();
    await expect(host.locator(".rk-main.is-commit")).toHaveCount(0);

    await guestContext.close();
    await hostContext.close();
  });

  test("the play screen never scrolls sideways on a phone", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "phone-only layout guard");
    const { host, hostContext, guestContext } = await startTile(browser);

    const overflow = await host.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(1);
    // the primary button must be inside the viewport AND actually hittable —
    // the control stack once overflowed the right edge and swallowed it
    const main = host.locator(".rk-main");
    await expect(main).toBeVisible();
    const reachable = await host.evaluate(() => {
      const el = document.querySelector(".rk-main")!;
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    expect(reachable, ".rk-main is not covered by another element").toBe(true);

    await guestContext.close();
    await hostContext.close();
  });

  test("undo only exists once the turn has changed something, and it rewinds", async ({ browser }) => {
    const { host, hostContext, guestContext } = await startTile(browser);

    // a permanently greyed button reads as broken, so it isn't rendered at all
    await expect(host.locator(".rk-iconbtn--undo")).toHaveCount(0);

    const handCount = await host.locator(".rk-rack .rk-tile").count();
    await host.locator(".rk-rack .rk-tilebtn").first().click();
    await host.locator('[data-drop="new"]').click();
    await expect(host.locator(".rk-meld:not(.rk-meld--new)")).toHaveCount(1);
    await expect(host.locator(".rk-iconbtn--undo")).toHaveCount(1);

    await host.locator(".rk-iconbtn--undo").click();
    await expect(host.locator(".rk-meld:not(.rk-meld--new)")).toHaveCount(0);
    await expect(host.locator(".rk-rack .rk-tile")).toHaveCount(handCount);
    await expect(host.locator(".rk-iconbtn--undo")).toHaveCount(0);

    await guestContext.close();
    await hostContext.close();
  });

  test("the rail shows exactly one active seat and marks which one is me", async ({ browser }) => {
    const { host, guest, hostContext, guestContext } = await startTile(browser);

    for (const page of [host, guest]) {
      await expect(page.locator(".rail-seat")).toHaveCount(2);
      await expect(page.locator(".rail-seat.is-turn")).toHaveCount(1);
      await expect(page.locator(".rail-seat.is-me")).toHaveCount(1);
      await expect(page.locator(".rail-seat__count")).toHaveCount(2);
    }
    // the host acts first, so the host's own seat is the lit one
    await expect(host.locator(".rail-seat.is-turn.is-me")).toHaveCount(1);
    await expect(guest.locator(".rail-seat.is-turn.is-me")).toHaveCount(0);

    await guestContext.close();
    await hostContext.close();
  });

  test("nothing scrolls: a growing hand shrinks its tiles and stays two rows", async ({ browser }) => {
    const { host, guest, hostContext, guestContext } = await startTile(browser);

    const rackState = (page: Page) =>
      page.evaluate(() => {
        const rack = document.querySelector(".rk-rack")!;
        const tiles = [...document.querySelectorAll<HTMLElement>(".rk-rack .rk-tilebtn")];
        return {
          count: tiles.length,
          rows: new Set(tiles.map((t) => t.offsetTop)).size,
          tileWidth: Math.round(tiles[0]?.getBoundingClientRect().width ?? 0),
          rackOverflow: rack.scrollHeight - rack.clientHeight,
        };
      });

    const before = await rackState(host);
    expect(before.count).toBe(14);

    // draw a dozen times each so the hand outgrows a single comfortable row
    for (let round = 0; round < 12; round += 1) {
      for (const page of [host, guest]) {
        if (await page.evaluate(() => !document.querySelector<HTMLButtonElement>(".rk-main")?.disabled)) {
          await page.locator(".rk-main").click();
          await page.waitForTimeout(150);
        }
      }
    }

    const after = await rackState(host);
    expect(after.count, "hand grew from drawing").toBeGreaterThan(before.count + 6);
    expect(after.rows, "the hand stays two rows").toBeLessThanOrEqual(2);
    expect(after.rackOverflow, "the rack never scrolls").toBeLessThanOrEqual(1);
    // Tiles shrink only as far as they must: on a wide window a grown hand
    // still fits at full size, so "never got bigger" is the invariant here.
    expect(after.tileWidth).toBeLessThanOrEqual(before.tileWidth);

    // Compare a wide window against a narrow one (explicit sizes, so this holds
    // whichever project runs it): the same hand must survive the squeeze by
    // shrinking its tiles — never by scrolling and never by wrapping a 3rd row.
    const measureAt = async (width: number, height: number) => {
      await host.setViewportSize({ width, height });
      await host.waitForTimeout(400);
      return rackState(host);
    };
    const wide = await measureAt(1000, 620);
    const narrow = await measureAt(520, 400);

    expect(narrow.count, "no tile was dropped").toBe(after.count);
    expect(narrow.tileWidth, "tiles shrank to make room").toBeLessThan(wide.tileWidth);
    for (const [label, state] of [["wide", wide] as const, ["narrow", narrow] as const]) {
      expect(state.rows, `${label}: still two rows`).toBeLessThanOrEqual(2);
      expect(state.rackOverflow, `${label}: still no scrolling`).toBeLessThanOrEqual(1);
    }

    // and nothing anywhere on the play screen has become scrollable-with-content
    const scrollers = await host.evaluate(() =>
      [...document.querySelectorAll(".scr--rummikub, .scr--rummikub *")]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return (
            /(auto|scroll)/.test(`${cs.overflowX} ${cs.overflowY}`) &&
            (el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1)
          );
        })
        .map((el) => el.className.toString()),
    );
    expect(scrollers, "no region of the game scrolls").toEqual([]);

    await guestContext.close();
    await hostContext.close();
  });

  test("tiles are fully playable by keyboard alone", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "keyboard is a desktop concern");
    const { host, hostContext, guestContext } = await startTile(browser);

    // Enter on a focused hand tile selects it (keyboard clicks arrive with
    // detail 0 and no pointer events, so this is its own code path)
    await host.locator(".rk-rack .rk-tilebtn").first().focus();
    await host.keyboard.press("Enter");
    await expect(host.locator(".rk-tile.is-sel")).toHaveCount(1);
    // Enter again toggles it back off
    await host.keyboard.press("Enter");
    await expect(host.locator(".rk-tile.is-sel")).toHaveCount(0);

    // select + activate the "new set" drop button = a full keyboard placement
    await host.locator(".rk-rack .rk-tilebtn").first().focus();
    await host.keyboard.press("Enter");
    await host.locator('[data-drop="new"]').focus();
    await host.keyboard.press("Enter");
    await expect(host.locator(".rk-meld:not(.rk-meld--new)")).toHaveCount(1);

    await guestContext.close();
    await hostContext.close();
  });

  test("a 15s clock auto-draws for an idle player and moves on", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "one project is enough for a 17s wait");
    const hostContext = await gameContext(browser);
    const guestContext = await gameContext(browser);
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const code = await createRoom(host, "초보자");
    await joinRoom(guest, code, "친구B");
    await host.locator(".mod", { hasText: "타일" }).click();
    await host.getByRole("button", { name: /게임 시작/ }).click();
    await expect(host.getByRole("heading", { name: "타일 설정" })).toBeVisible({ timeout: 10_000 });
    // step the clock DOWN to the 15s minimum (60 -> 30 -> 15)
    const down = host.locator(".rk-stepper__arrow").last();
    for (let i = 0; i < 2; i += 1) await down.click();
    await expect(host.locator(".rk-stepper__value")).toHaveText("15초");
    await host.getByRole("button", { name: "게임 시작" }).click();
    await expect(host.locator(".rk-rack .rk-tile")).toHaveCount(14, { timeout: 10_000 });
    await dismissRotate(host);
    await dismissRotate(guest);

    // nobody acts: the deadline passes, the idle host is dealt one tile and
    // the turn moves to the guest without any click anywhere
    await expect(guest.locator(".rail-seat.is-turn.is-me")).toBeVisible({ timeout: 20_000 });
    await expect(host.locator(".rk-rack .rk-tile")).toHaveCount(15);

    await guestContext.close();
    await hostContext.close();
  });

  test("an 8-player rail fits a 568x320 phone without scrolling or clipping", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "viewport is set explicitly");
    const hostContext = await gameContext(browser);
    const host = await hostContext.newPage();
    const code = await createRoom(host, "호스트");
    const guestContexts = [];
    for (let i = 0; i < 7; i += 1) {
      const ctx = await gameContext(browser);
      guestContexts.push(ctx);
      const g = await ctx.newPage();
      await joinRoom(g, code, `손님${i + 2}`);
    }
    await host.locator(".mod", { hasText: "타일" }).click();
    await host.getByRole("button", { name: /게임 시작/ }).click();
    await expect(host.getByRole("heading", { name: "타일 설정" })).toBeVisible({ timeout: 10_000 });
    const up = host.locator(".rk-stepper__arrow").first();
    for (let i = 0; i < 3; i += 1) await up.click();
    await host.getByRole("button", { name: "게임 시작" }).click();
    await expect(host.locator(".rk-rack .rk-tile").first()).toBeVisible({ timeout: 10_000 });

    await host.setViewportSize({ width: 568, height: 320 });
    await host.waitForTimeout(800);
    await dismissRotate(host);

    const state = await host.evaluate(() => {
      const rail = document.querySelector(".rk-rail")!;
      const rr = rail.getBoundingClientRect();
      const seats = [...document.querySelectorAll(".rail-seat")];
      const main = document.querySelector(".rk-main")!;
      const mr = main.getBoundingClientRect();
      const hit = document.elementFromPoint(mr.left + mr.width / 2, mr.top + mr.height / 2);
      return {
        seats: seats.length,
        railScroll: rail.classList.contains("is-scroll"),
        clippedSeats: seats.filter((s) => {
          const r = s.getBoundingClientRect();
          return r.bottom > rr.bottom + 2 || r.top < rr.top - 2;
        }).length,
        hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainReachable: main.contains(hit),
      };
    });
    expect(state.seats, "all 8 seats exist").toBe(8);
    // seats shrink to fit (scroll stays a last resort that must not trigger here)
    expect(state.railScroll, "the rail does not need its scroll fallback").toBe(false);
    expect(state.clippedSeats, "no seat is clipped out of view").toBe(0);
    expect(state.hOverflow, "no horizontal overflow").toBeLessThanOrEqual(1);
    expect(state.mainReachable, "the primary button is hittable").toBe(true);

    for (const ctx of guestContexts) await ctx.close();
    await hostContext.close();
  });

  test("the ? help opens the rules, and 777/789 really reorder the rack", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "one project is enough");
    const { host, hostContext, guestContext } = await startTile(browser);

    // ? -> rules modal with the visual set examples
    await host.locator(".rk-toolbar .btn").first().click();
    await expect(host.locator(".modal")).toBeVisible();
    await expect(host.locator(".modal .rk-ex")).toHaveCount(2);
    await host.locator(".modal .x").first().click();
    await expect(host.locator(".modal")).toHaveCount(0);

    const rackOrder = () =>
      host.$$eval(".rk-rack .rk-tile", (els) =>
        els.map((el) => el.className.match(/rk-tile--(\w+)/)?.[1] ?? "joker").join(","),
      );
    const before = await rackOrder();
    await host.getByRole("button", { name: "789" }).click();
    await expect(host.getByRole("button", { name: "789" })).toHaveAttribute("aria-pressed", "true");
    const sorted = await rackOrder();
    // 789 groups by colour: the colour sequence must be non-interleaved
    const runs = sorted.split(",").filter((c, i, a) => i === 0 || c !== a[i - 1]).length;
    const distinct = new Set(sorted.split(",")).size;
    expect(runs, "789 groups the rack by colour").toBe(distinct);
    // toggling off restores the raw order
    await host.getByRole("button", { name: "789" }).click();
    await expect(host.getByRole("button", { name: "789" })).toHaveAttribute("aria-pressed", "false");
    expect(await rackOrder()).toBe(before);

    await guestContext.close();
    await hostContext.close();
  });

  test("anyone can open an end-game vote from settings, and a majority ends it", async ({ browser }) => {
    const { host, guest, hostContext, guestContext } = await startTile(browser);

    await expect(host.locator(".rk-vote")).toHaveCount(0);
    await host.locator(".rk-toolbar .btn").last().click(); // gear
    const propose = host.locator(".settings-extra .btn");
    await expect(propose).toBeEnabled();
    await propose.click();

    // a small chip, not a modal — the board stays usable while the vote is open
    await expect(host.locator(".rk-vote")).toHaveCount(1);
    await expect(guest.locator(".rk-vote")).toHaveCount(1, { timeout: 10_000 });
    await expect(host.locator(".rk-vote__row .btn")).toHaveCount(0); // proposer already voted
    await expect(guest.locator(".rk-vote__row .btn")).toHaveCount(2);

    // a second proposal must not stack a rival vote
    await host.locator(".rk-toolbar .btn").last().click();
    await expect(host.locator(".settings-extra .btn")).toBeDisabled();
    await host.locator(".modal .x").first().click();

    await guest.getByRole("button", { name: "찬성" }).click();
    // canceled games skip the results screen and land straight back in the lobby
    await expect(host.locator(".scr--lobby")).toBeVisible({ timeout: 10_000 });
    await expect(guest.locator(".scr--lobby")).toBeVisible({ timeout: 10_000 });

    await guestContext.close();
    await hostContext.close();
  });
});
