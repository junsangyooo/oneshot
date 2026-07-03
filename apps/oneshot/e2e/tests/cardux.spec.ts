import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/* QA for the allout/upstage card-UX pass: turn gating (all cards disabled when
   it's not your turn), readable card faces (captions, 4-color wild, color chip),
   and both themes. Requires dev servers (client :5173 + server :2567). */

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

const pickGame = async (host: Page, gameId: string): Promise<void> => {
  await host.locator(`.game-tile[data-game="${gameId}"], [data-game="${gameId}"]`).first().click();
};

test.describe("allout card UX", () => {
  test("turn gating, card faces, color chip, auto-action absence of dead options", async ({ browser }) => {
    test.setTimeout(120_000);
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const host = await ctxA.newPage();
    const guest = await ctxB.newPage();

    const code = await createRoom(host, "민수");
    await joinRoom(guest, code, "지영");

    // select allout in the lobby game list
    await host.locator(".mod", { hasText: "올아웃" }).click();
    await host.getByRole("button", { name: /게임 시작/ }).click();

    // host configures and starts round 1
    await expect(host.getByRole("heading", { name: "올아웃 설정" })).toBeVisible({ timeout: 10_000 });
    await host.getByRole("button", { name: "게임 시작" }).click();

    // both see the play board
    await expect(host.locator(".ao-hand .ao-card").first()).toBeVisible({ timeout: 10_000 });
    await expect(guest.locator(".ao-hand .ao-card").first()).toBeVisible({ timeout: 10_000 });

    // active-color chip visible on both
    await expect(host.locator(".ao-colorchip")).toBeVisible();
    await expect(guest.locator(".ao-colorchip")).toBeVisible();

    // exactly one of the two has the turn
    const hostTurn = await host.locator(".ao-status__turn").count();
    const guestTurn = await guest.locator(".ao-status__turn").count();
    expect(hostTurn + guestTurn).toBe(1);

    const active = hostTurn ? host : guest;
    const waiting = hostTurn ? guest : host;

    // (1) NOT my turn → every hand card is disabled AND dimmed
    const waitingCards = waiting.locator(".ao-hand .ao-card");
    const n = await waitingCards.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i += 1) {
      await expect(waitingCards.nth(i)).toBeDisabled();
      await expect(waitingCards.nth(i)).toHaveClass(/is-dim/);
    }
    // waiting player's action buttons are disabled too
    await expect(waiting.getByRole("button", { name: /내기/ })).toBeDisabled();

    // (2) my turn → either a playable (enabled) card exists or draw pulses
    const activeEnabled = await active.locator(".ao-hand .ao-card:not([disabled])").count();
    if (activeEnabled === 0) {
      await expect(active.locator(".btn.is-pulse")).toBeVisible();
    }

    // (3) card faces: number cards carry corner pips; specials carry captions
    const numberPips = await active.locator(".ao-hand .ao-card__pip").count();
    const captions = await active.locator(".ao-hand .ao-card__k").count();
    expect(numberPips + captions).toBeGreaterThan(0);
    // any colorless card must show the 4-color strip or disc or joker rainbow
    const colorless = active.locator('.ao-hand .ao-card[data-color="wild"]:not(.ao-card--joker)');
    const cn = await colorless.count();
    for (let i = 0; i < cn; i += 1) {
      expect(await colorless.nth(i).locator(".ao-card__multi, .ao-card__quad").count()).toBeGreaterThan(0);
    }

    await host.screenshot({ path: "test-results/allout-cyber-host.png", fullPage: true });

    // (4) cozy theme keeps everything visible
    await active.evaluate(() => document.documentElement.setAttribute("data-theme", "cozy"));
    await expect(active.locator(".ao-colorchip")).toBeVisible();
    await expect(active.locator(".ao-hand .ao-card").first()).toBeVisible();
    await active.screenshot({ path: "test-results/allout-cozy.png", fullPage: true });

    await ctxA.close();
    await ctxB.close();
  });
});

test.describe("upstage card UX", () => {
  test("turn gating, star/1 captions, legality-gated play button", async ({ browser }) => {
    test.setTimeout(120_000);
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const ctxC = await browser.newContext();
    const host = await ctxA.newPage();
    const guest = await ctxB.newPage();
    const guest2 = await ctxC.newPage();

    const code = await createRoom(host, "민수");
    await joinRoom(guest, code, "지영");
    await joinRoom(guest2, code, "철수"); // upstage needs 3+ players

    await host.locator(".mod", { hasText: "업스테이지" }).click();
    await expect(host.getByRole("button", { name: /게임 시작/ })).toBeEnabled({ timeout: 10_000 });
    await host.getByRole("button", { name: /게임 시작/ }).click();

    await expect(host.getByRole("heading", { name: "업스테이지 설정" })).toBeVisible({ timeout: 10_000 });
    await host.getByRole("button", { name: "게임 시작" }).click();

    // draw phase → host advances
    await expect(host.getByRole("button", { name: "이 순서로 시작" })).toBeVisible({ timeout: 10_000 });
    await host.getByRole("button", { name: "이 순서로 시작" }).click();

    const pages = [host, guest, guest2];
    for (const p of pages) {
      await expect(p.locator(".up-hand .up-card").first()).toBeVisible({ timeout: 10_000 });
    }

    const turnFlags = await Promise.all(pages.map((p) => p.locator(".up-status__turn").count()));
    expect(turnFlags.reduce((a, b) => a + b, 0)).toBe(1);

    const active = pages[turnFlags.findIndex((f) => f > 0)]!;
    const waiters = pages.filter((_, i) => turnFlags[i] === 0);

    // (1) NOT my turn → every hand card disabled + dimmed
    for (const waiting of waiters) {
      const waitingCards = waiting.locator(".up-hand .up-card");
      const n = await waitingCards.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i += 1) {
        await expect(waitingCards.nth(i)).toBeDisabled();
        await expect(waitingCards.nth(i)).toHaveClass(/is-dim/);
      }
    }
    const waiting = waiters[0]!;

    // (2) my turn, leading → all cards enabled; play disabled until a selection
    await expect(active.getByRole("button", { name: /^내기/ })).toBeDisabled();
    const firstCard = active.locator(".up-hand .up-card:not([disabled])").first();
    await firstCard.click();
    await expect(active.getByRole("button", { name: /^내기/ })).toBeEnabled();

    // (3) star cards show 조커 caption, 1 shows 최강 (when present in either hand)
    for (const p of [active, waiting]) {
      const stars = p.locator(".up-hand .up-card--star");
      const sc = await stars.count();
      for (let i = 0; i < sc; i += 1) await expect(stars.nth(i).locator(".up-card__k")).toHaveText("조커");
      const best = p.locator(".up-hand .up-card--best");
      const bc = await best.count();
      for (let i = 0; i < bc; i += 1) await expect(best.nth(i).locator(".up-card__k")).toHaveText("최강");
    }

    // (4) play a card; follower sees constraint hint + always-on "낮은 숫자가 강해요"
    await active.getByRole("button", { name: /^내기/ }).click();
    await expect(waiting.locator(".up-pile__cards .up-card").first()).toBeVisible({ timeout: 10_000 });
    await expect(waiting.getByText("낮은 숫자가 강해요")).toBeVisible();

    await host.screenshot({ path: "test-results/upstage-cyber.png", fullPage: true });
    await active.evaluate(() => document.documentElement.setAttribute("data-theme", "cozy"));
    await active.screenshot({ path: "test-results/upstage-cozy.png", fullPage: true });

    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
  });
});
