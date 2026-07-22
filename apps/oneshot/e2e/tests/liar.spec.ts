import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

/* 라이어 (Liar) — locks in the secret-word deal: exactly one seat gets the 라이어
   card, the citizens share one identical word the liar's screen never shows, and
   the host-only end flows every seat to the results screen.
   (The game intentionally has no in-app vote phase — discussion is verbal.)
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

// Seat three players, pick 라이어 (exact match — "바보 라이어" is a separate game),
// and configure the 과일 category with the single liar a 3-player room allows.
const startLiar = async (browser: Browser) => {
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

  await host.locator('.mod:has(.nm:text-is("라이어"))').click();
  await host.locator(".btn--init").click();

  // setup is host-only: guests wait and never see the category grid
  await expect(host.locator(".liar-setup")).toBeVisible({ timeout: 10_000 });
  for (const guest of [guest1, guest2]) {
    await expect(guest.locator(".liar-wait")).toBeVisible({ timeout: 10_000 });
    await expect(guest.locator(".liar-cat")).toHaveCount(0);
  }

  // no hardcoded default: the start CTA stays locked until a category is picked
  await expect(host.getByRole("button", { name: "이 설정으로 시작" })).toBeDisabled();
  await host.locator(".liar-cat", { hasText: "과일" }).click();
  await expect(host.locator(".liar-cat.is-selected")).toHaveCount(1);
  // 3 players allow exactly one liar, and that count is pre-selected
  await expect(host.locator(".liar-count-seg button")).toHaveCount(1);
  await expect(host.locator(".liar-count-seg button.on")).toHaveText("1");
  await host.getByRole("button", { name: "이 설정으로 시작" }).click();

  for (const page of pages) {
    await expect(page.locator(".liar-reveal")).toBeVisible({ timeout: 10_000 });
  }
  return { contexts, pages, host };
};

test.describe("라이어", () => {
  test("exactly one liar; citizens share a word the liar's screen never shows", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "room budget: one project runs the suite");
    const { contexts, pages } = await startLiar(browser);

    // the public frame is identical everywhere: category + liar count, no words
    for (const page of pages) {
      await expect(page.locator(".liar-category")).toHaveText("과일");
      await expect(page.locator(".topbar .readout").first()).toContainText("LIARS: 01");
      // cards start covered so a shared screen leaks nothing
      await expect(page.locator(".liar-card.is-hidden")).toHaveCount(1);
    }

    // every seat flips its own card and reads its secret word
    const words: string[] = [];
    for (const page of pages) {
      await page.locator(".liar-card").click();
      await expect(page.locator(".liar-card.is-revealed")).toHaveCount(1);
      words.push((await page.locator(".liar-card__word").innerText()).trim());
    }

    // the deal: exactly one 라이어 card, two identical citizen words
    const liarSeats = words.map((w, i) => (w === "라이어" ? i : -1)).filter((i) => i >= 0);
    expect(liarSeats, `deal was ${words.join(" / ")}`).toHaveLength(1);
    const citizenWords = words.filter((_, i) => i !== liarSeats[0]);
    expect(citizenWords[0], "citizens share one word").toBe(citizenWords[1]);
    expect(citizenWords[0]).not.toBe("라이어");

    // isolation, asserted negatively: the liar styling exists on one seat only,
    // and the citizens' answer word appears NOWHERE on the liar's screen
    const liarCardCounts = await Promise.all(
      pages.map((page) => page.locator(".liar-card.is-liar").count()),
    );
    expect(liarCardCounts.reduce((a, b) => a + b, 0)).toBe(1);
    const liarPage = pages[liarSeats[0]!]!;
    await expect(liarPage.getByText(citizenWords[0]!)).toHaveCount(0);

    // tapping again re-covers the card (shared-screen safety)
    await liarPage.locator(".liar-card").click();
    await expect(liarPage.locator(".liar-card.is-hidden")).toHaveCount(1);

    for (const ctx of contexts) await ctx.close();
  });

  test("the host-only end flows every seat to the results screen", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "room budget: one project runs the suite");
    const { contexts, pages, host } = await startLiar(browser);

    // guests have no end-game control — the round is the host's to close
    for (const page of pages) {
      if (page === host) continue;
      await expect(page.locator(".liar-toolbar .btn--danger")).toHaveCount(0);
    }

    await host.locator(".liar-toolbar .btn--danger").click();
    // ...behind a confirm, so a stray tap can't nuke the round for everyone
    await expect(host.locator(".modal")).toBeVisible();
    await host.locator(".modal").getByRole("button", { name: "게임 종료" }).click();

    // every seat lands on the results screen naming the game that just ended
    for (const page of pages) {
      await expect(page.locator(".scr--results")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".scr--results .mod")).toHaveText("라이어");
    }

    for (const ctx of contexts) await ctx.close();
  });
});
