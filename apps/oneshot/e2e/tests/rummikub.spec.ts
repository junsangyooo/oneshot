import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

/* TILE (Rummikub) — locks in the first-time-player fixes:
   the rotate wall must never trap a desktop window, the long-press set-select
   must survive letting go, a cancelled drag must put the tiles back, and the
   action bar must not overflow a phone.
   Requires the dev servers (client :5173 + server :2567) to be running. */

const nicknameInput = (page: Page) => page.getByPlaceholder("이름을 입력하세요...");

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
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
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

  test("long-press grabs a set; releasing without dragging drops all of it", async ({ browser }) => {
    const { host, hostContext, guestContext } = await startTile(browser);

    const first = host.locator(".rk-rack .rk-tilebtn").first();
    const box = (await first.boundingBox())!;
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();
    // the press must read immediately, well before the grab fires
    await expect(host.locator(".rk-rack .rk-tile.is-press")).toHaveCount(1, { timeout: 200 });
    await host.waitForTimeout(500); // past the 250ms grab threshold
    await expect(host.locator(".rk-rack .rk-tile.is-sel")).not.toHaveCount(0);
    await host.mouse.up();

    // letting go of a grab leaves you holding nothing — never a stray tile or
    // a half-selection (the pressed tile used to be the only one dropped)
    await expect(host.locator(".rk-tile.is-sel")).toHaveCount(0);

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

    const draw = host.locator(".rk-draw");
    await expect(draw).toBeEnabled(); // stays live even mid-staging
    await draw.click();

    // staging is discarded, a tile is taken, and the turn moves on
    await expect(host.locator(".rk-meld:not(.rk-meld--new)")).toHaveCount(0);
    await expect(host.locator(".rk-rack .rk-tile")).toHaveCount(15);
    await expect(guest.locator(".rk-turn.is-mine")).toBeVisible({ timeout: 10_000 });

    await guestContext.close();
    await hostContext.close();
  });

  test("the turn clock ticks down for the player who is not acting", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const code = await createRoom(host, "초보자");
    await joinRoom(guest, code, "친구B");
    await host.locator(".mod", { hasText: "타일" }).click();
    await host.getByRole("button", { name: /게임 시작/ }).click();
    await expect(host.getByRole("heading", { name: "타일 설정" })).toBeVisible({ timeout: 10_000 });
    await host.getByRole("button", { name: "게임 시작" }).click(); // keep the default 60s clock
    await dismissRotate(guest);

    // the waiting player sees the same clock draining
    const timer = guest.locator(".rk-turn__timer");
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
    await expect(host.getByRole("button", { name: "턴 종료" })).toBeDisabled();

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
    await expect(host.getByRole("button", { name: "턴 종료" })).toBeVisible();

    await guestContext.close();
    await hostContext.close();
  });
});
