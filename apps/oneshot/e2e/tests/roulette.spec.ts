import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

/* Roulette(룰렛) flows against the terminal UI (ko locale, cyber theme defaults).
   Requires the dev servers (client :5173 + server :2567) to be running.

   Roulette is a single, fully automatic round: starting the game spins the
   wheel immediately with NO further button presses, then lands on a winner
   and moves straight to the results screen. These specs assert exactly that
   — no CTA ever appears mid-spin, and the winner resolves within the spin's
   floor duration (see ROULETTE_SPIN_MS, shared/src/games/roulette.ts). */

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

const openThreeSeats = async (browser: Browser, contextOptions: Parameters<Browser["newContext"]>[0] = {}) => {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < 3; i += 1) {
    const context = await browser.newContext(contextOptions);
    contexts.push(context);
    pages.push(await context.newPage());
  }
  const code = await createRoom(pages[0]!, "호스트");
  await joinRoom(pages[1]!, code, "지영");
  await joinRoom(pages[2]!, code, "민수");
  return { contexts, pages, code };
};

/* host: pick the roulette module in the lobby and launch it — no in-game
   setup exists (no options at all), so this alone starts the auto-spin. */
const startRoulette = async (host: Page) => {
  await host.locator(".mod", { hasText: "룰렛" }).first().click();
  await expect(host.locator(".hero .title")).toHaveText(/룰렛/i);
  await host.locator(".btn--init").click();
};

test("a solo player can spin roulette alone and reach the results screen", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await createRoom(page, "혼자");

  await startRoulette(page);
  // the wheel appears immediately, already spinning — no button to press
  await expect(page.locator(".rl-wheel-wrap")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".rl-label-arm")).toHaveCount(1);

  await expect(page.getByRole("heading", { name: "게임 종료" })).toBeVisible({ timeout: 10_000 });
  // solo winner is the champion on the results screen
  await expect(page.locator(".champ .nm")).toHaveText("혼자");

  await context.close();
});

test("three players auto-spin to a single winner with zero clicks during the round", async ({ browser }) => {
  const { contexts, pages } = await openThreeSeats(browser);
  const [host] = pages as [Page, Page, Page];

  await startRoulette(host);

  for (const page of pages) {
    await expect(page.locator(".rl-wheel-wrap")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".rl-label-arm")).toHaveCount(3);
  }

  // there is genuinely no in-game action to take — no CTA/roll/confirm button
  for (const page of pages) {
    await expect(page.locator(".scr--roulette button:not([aria-label='게임 방법']):not([aria-label='오퍼레이터 설정'])")).toHaveCount(0);
  }

  // resolves to the results screen on its own, within the spin's floor duration
  for (const page of pages) {
    await expect(page.getByRole("heading", { name: "게임 종료" })).toBeVisible({ timeout: 10_000 });
  }

  // exactly one champion, and it's one of our three seated players
  const champName = await host.locator(".champ .nm").innerText();
  expect(["호스트", "지영", "민수"]).toContain(champName);

  // no horizontal overflow on any seat (mobile project runs this on Pixel 7)
  for (const page of pages) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  for (const context of contexts) await context.close();
});

test("a mid-spin disconnect does not stall the round for the remaining players", async ({ browser }) => {
  const { contexts, pages } = await openThreeSeats(browser);
  const [host, guest1] = pages as [Page, Page, Page];

  await startRoulette(host);
  await expect(host.locator(".rl-wheel-wrap")).toBeVisible({ timeout: 5_000 });

  // third seat drops mid-spin
  await contexts[2]!.close();

  // the remaining two still resolve to a result on their own
  await expect(host.getByRole("heading", { name: "게임 종료" })).toBeVisible({ timeout: 10_000 });
  await expect(guest1.getByRole("heading", { name: "게임 종료" })).toBeVisible({ timeout: 10_000 });

  for (const context of contexts.slice(0, 2)) await context.close();
});
