import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

/* 왕게임 (King Game) — locks in the core journey and the recent regressions:
   only the king ever sees the mission composer (secret isolation), a tap/keyboard
   assignment fills a slot, slots answer Enter/Space, and Escape/pointercancel
   kills the drag ghost instead of leaving it stranded.
   Requires the dev servers (client :5173 + server :2567) to be running.
   Runs on desktop-chrome only to stay inside the 30-rooms/min budget. */

const nicknameInput = (page: Page) => page.getByPlaceholder("이름을 입력하세요...");

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

// Seat three players, pick 왕게임, start it in 순한맛 mode, and work out who the
// king is (the deal is random, so every test must discover the role at runtime).
const startKingGame = async (browser: Browser) => {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < 3; i += 1) {
    const ctx = await gameContext(browser);
    contexts.push(ctx);
    pages.push(await ctx.newPage());
  }
  const [host, guest1, guest2] = pages as [Page, Page, Page];
  const code = await createRoom(host, "호스트");
  await joinRoom(guest1, code, "지영");
  await joinRoom(guest2, code, "민수");

  await host.locator('.mod:has(.nm:text-is("왕게임"))').click();
  await host.locator(".btn--init").click();

  // setup is host-only: guests wait and never see the mode grid
  await expect(host.locator(".king-setup")).toBeVisible({ timeout: 10_000 });
  for (const guest of [guest1, guest2]) {
    await expect(guest.locator(".king-wait")).toBeVisible({ timeout: 10_000 });
    await expect(guest.locator(".king-mode")).toHaveCount(0);
  }

  await host.locator(".king-mode", { hasText: "순한맛" }).click();
  await expect(host.locator(".king-mode.is-selected")).toHaveCount(1);
  await host.getByRole("button", { name: "이 모드로 시작" }).click();

  for (const page of pages) {
    await expect(page.locator(".king-composer, .king-card--number").first()).toBeVisible({
      timeout: 10_000,
    });
  }
  const composerCounts = await Promise.all(
    pages.map((page) => page.locator(".king-composer").count()),
  );
  const kingIndex = composerCounts.findIndex((count) => count > 0);
  expect(kingIndex, "exactly one seat is the king").toBeGreaterThanOrEqual(0);
  const king = pages[kingIndex]!;
  const subjects = pages.filter((_, i) => i !== kingIndex);
  return { contexts, pages, king, subjects };
};

test.describe("왕게임", () => {
  test("only the king sees the composer; subjects hold distinct secret numbers", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "room budget: one project runs the suite");
    const { contexts, pages, king, subjects } = await startKingGame(browser);

    // secret isolation, counted across every seat: 1 composer, 2 number cards
    const composers = await Promise.all(pages.map((p) => p.locator(".king-composer").count()));
    const numberCards = await Promise.all(pages.map((p) => p.locator(".king-card--number").count()));
    expect(composers.reduce((a, b) => a + b, 0), "exactly one composer exists").toBe(1);
    expect(numberCards.reduce((a, b) => a + b, 0), "exactly two number cards exist").toBe(2);

    // the king never sees a subject card, subjects never see the composer
    await expect(king.locator(".king-card--number")).toHaveCount(0);
    for (const subject of subjects) {
      await expect(subject.locator(".king-composer")).toHaveCount(0);
      await expect(subject.locator(".king-num")).toHaveCount(0);
    }

    // subjects were dealt DIFFERENT numbers out of {1번, 2번}
    const numbers = await Promise.all(
      subjects.map((subject) => subject.locator(".king-card__num").innerText()),
    );
    for (const n of numbers) expect(n).toMatch(/^[12]번$/);
    expect(new Set(numbers).size, "subject numbers are unique").toBe(2);

    // a 3-player deal exposes exactly the two subject numbers to the king
    await expect(king.locator(".king-num")).toHaveCount(2);

    for (const ctx of contexts) await ctx.close();
  });

  test("tap-assign fills the mission, reveal reaches every seat, next turn re-deals", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "room budget: one project runs the suite");
    const { contexts, pages, king } = await startKingGame(browser);

    // the rolled mission decides its own slot count (1 or 2) — fill them all by tap
    const slots = await king.locator(".king-slot").count();
    expect(slots).toBeGreaterThanOrEqual(1);
    expect(slots).toBeLessThanOrEqual(2);
    const confirm = king.getByRole("button", { name: "미션 공개" });
    for (let i = 0; i < slots; i += 1) {
      await expect(confirm).toBeDisabled(); // never enabled before every slot is filled
      await king.locator(".king-num:not(.is-used)").first().click();
      await expect(king.locator(".king-slot.is-filled")).toHaveCount(i + 1);
    }
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // 3s prelude first, then the same reveal lands on every seat
    await expect(king.locator(".king-prelude")).toBeVisible({ timeout: 5_000 });
    const missions: string[] = [];
    for (const page of pages) {
      await expect(page.locator(".king-reveal")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".king-reveal__target")).toHaveCount(slots);
      missions.push(await page.locator(".king-reveal__mission").innerText());
    }
    expect(new Set(missions).size, "every seat reads the same mission").toBe(1);
    // targets resolve to real seated players, never ghost "—" entries
    for (const page of pages) {
      const names = await page.locator(".king-reveal__name").allInnerTexts();
      expect(names).not.toContain("—");
    }

    // the king advances the turn: a fresh deal, exactly one new composer
    await king.getByRole("button", { name: "다음 턴" }).click();
    for (const page of pages) {
      await expect(page.locator(".king-round .val")).toHaveText("02", { timeout: 10_000 });
      await expect(page.locator(".king-composer, .king-card--number").first()).toBeVisible({
        timeout: 10_000,
      });
    }
    const composers = await Promise.all(pages.map((p) => p.locator(".king-composer").count()));
    expect(composers.reduce((a, b) => a + b, 0), "round 2 has exactly one king").toBe(1);

    for (const ctx of contexts) await ctx.close();
  });

  test("keyboard assigns cards, slots answer Enter/Space, Escape kills the drag ghost", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "keyboard is a desktop concern");
    const { contexts, king } = await startKingGame(browser);

    // (a) focused card + Enter fills the first empty slot (detail-0 click path)
    await king.locator(".king-num").first().focus();
    await king.keyboard.press("Enter");
    await expect(king.locator(".king-slot.is-filled")).toHaveCount(1);
    await expect(king.locator(".king-num.is-used")).toHaveCount(1);

    // (b) a filled slot clears on Enter (span[role=button] gets no free key handling)
    await king.locator(".king-slot.is-filled").focus();
    await king.keyboard.press("Enter");
    await expect(king.locator(".king-slot.is-filled")).toHaveCount(0);
    await expect(king.locator(".king-num.is-used")).toHaveCount(0);

    // ...and an empty slot arms itself on Space, so the next card goes there
    await king.locator(".king-slot").first().focus();
    await king.keyboard.press(" ");
    await expect(king.locator(".king-slot.is-active")).toHaveCount(1);
    await king.locator(".king-num").first().focus();
    await king.keyboard.press("Enter");
    await expect(king.locator(".king-slot.is-filled")).toHaveCount(1);
    await expect(king.locator(".king-slot.is-active")).toHaveCount(0);

    // (c) Escape mid-drag removes the ghost and assigns nothing
    const card = king.locator(".king-num:not(.is-used)").first();
    const box = (await card.boundingBox())!;
    await king.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await king.mouse.down();
    await king.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 5 });
    await expect(king.locator(".king-drag-ghost")).toBeVisible();
    await king.keyboard.press("Escape");
    await expect(king.locator(".king-drag-ghost")).toHaveCount(0);
    await king.mouse.up();
    // the cancelled drag never landed: still exactly the one keyboard-filled slot
    await expect(king.locator(".king-slot.is-filled")).toHaveCount(1);
    await expect(king.locator(".king-num.is-used")).toHaveCount(1);

    for (const ctx of contexts) await ctx.close();
  });
});
