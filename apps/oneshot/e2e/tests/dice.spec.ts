import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

/* Dice(주사위) flows against the terminal UI (ko locale, cyber theme defaults).
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

/* host: pick the dice module in the lobby and launch it with N rounds */
const startDice = async (host: Page, rounds: number) => {
  await host.locator(".mod", { hasText: "주사위" }).first().click();
  await expect(host.locator(".hero .title")).toHaveText(/주사위/i);
  await host.locator(".btn--init").click();
  await expect(host.getByRole("heading", { name: "주사위 설정" })).toBeVisible({ timeout: 10_000 });
  for (let i = 1; i < rounds; i += 1) {
    await host.locator(".dice-stepper button").last().click();
  }
  await expect(host.locator(".dice-stepper__v")).toHaveText(String(rounds));
  await host.locator(".dice-cta").click();
};

const rollButton = (page: Page) => page.getByRole("button", { name: "주사위 굴리기" });

const rollAll = async (pages: Page[]) => {
  for (const page of pages) {
    await rollButton(page).click();
  }
};

test("three players play a full 2-round dice game to the results screen", async ({ browser }) => {
  const { contexts, pages } = await openThreeSeats(browser);
  const [host, guest1] = pages as [Page, Page, Page];

  await startDice(host, 2);
  for (const page of pages) {
    await expect(rollButton(page)).toBeVisible({ timeout: 10_000 });
  }
  // no end-vote button during round 1
  await expect(host.getByRole("button", { name: /종료 투표/ })).toHaveCount(0);

  await rollAll(pages);
  // the settle gate keeps the drama: results must NOT pop in instantly...
  await expect(host.getByRole("heading", { name: "1라운드 결과" })).toHaveCount(0);
  // ...but appear once the dice have landed
  await expect(host.getByRole("heading", { name: "1라운드 결과" })).toBeVisible({ timeout: 10_000 });
  await expect(host.locator(".dice-table__row")).toHaveCount(3);
  // every pod shows a rank badge and a sum
  await expect(host.locator(".dice-pod__rank")).toHaveCount(3);
  await expect(host.locator(".dice-pod__sum")).toHaveCount(3);

  // ANYONE can advance — a guest presses next
  await expect(guest1.getByRole("button", { name: "다음 라운드" })).toBeVisible({ timeout: 10_000 });
  await guest1.getByRole("button", { name: "다음 라운드" }).click();

  // round 2: end-vote button unlocks for everyone
  await expect(host.getByRole("button", { name: /종료 투표/ })).toBeVisible({ timeout: 10_000 });
  await expect(guest1.getByRole("button", { name: /종료 투표/ })).toBeVisible({ timeout: 10_000 });

  await rollAll(pages);
  await expect(host.getByRole("heading", { name: "2라운드 결과" })).toBeVisible({ timeout: 10_000 });
  await host.getByRole("button", { name: "최종 결과 보기" }).click();

  for (const page of pages) {
    await expect(page.getByRole("heading", { name: "게임 종료" })).toBeVisible({ timeout: 10_000 });
  }
  // no horizontal overflow on any seat (mobile project runs this on Pixel 7)
  for (const page of pages) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  for (const context of contexts) await context.close();
});

test("host end vote from round 2 cancels the game back to the lobby", async ({ browser }) => {
  const { contexts, pages } = await openThreeSeats(browser);
  const [host, guest1, guest2] = pages as [Page, Page, Page];

  await startDice(host, 3);
  await rollAll(pages);
  await expect(host.getByRole("button", { name: "다음 라운드" })).toBeVisible({ timeout: 10_000 });
  await host.getByRole("button", { name: "다음 라운드" }).click();

  await expect(host.getByRole("button", { name: /종료 투표/ })).toBeVisible({ timeout: 10_000 });
  await host.getByRole("button", { name: /종료 투표/ }).click();

  // proposer auto-voted yes and waits; guests get agree/reject
  await expect(host.getByText("투표 중...")).toBeVisible({ timeout: 10_000 });
  await expect(guest2.getByRole("button", { name: "찬성" })).toBeVisible({ timeout: 10_000 });
  await guest1.getByRole("button", { name: "찬성" }).click();

  // 2/3 majority — everyone lands back in the lobby with the team kept
  for (const page of pages) {
    await expect(page.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
  }
  for (const context of contexts) await context.close();
});

test("a guest-proposed vote that gets rejected locks re-proposals with a countdown", async ({ browser }) => {
  const { contexts, pages } = await openThreeSeats(browser);
  const [host, guest1, guest2] = pages as [Page, Page, Page];

  await startDice(host, 3);
  await rollAll(pages);
  await expect(guest1.getByRole("button", { name: "다음 라운드" })).toBeVisible({ timeout: 10_000 });
  await guest1.getByRole("button", { name: "다음 라운드" }).click();

  // a GUEST opens the vote (auto-yes), the other two reject it
  await expect(guest1.getByRole("button", { name: /종료 투표/ })).toBeVisible({ timeout: 10_000 });
  await guest1.getByRole("button", { name: /종료 투표/ }).click();
  await expect(host.getByRole("button", { name: "반대" })).toBeVisible({ timeout: 10_000 });
  await host.getByRole("button", { name: "반대" }).click();
  await expect(guest2.getByRole("button", { name: "반대" })).toBeVisible({ timeout: 10_000 });
  await guest2.getByRole("button", { name: "반대" }).click();

  // rejected → every seat shows a disabled countdown instead of the vote button
  for (const page of pages) {
    const cooldownBtn = page.getByRole("button", { name: /재투표/ });
    await expect(cooldownBtn).toBeVisible({ timeout: 10_000 });
    await expect(cooldownBtn).toBeDisabled();
  }
  // and the game itself continues (round 2 keeps rolling)
  await expect(rollButton(host)).toBeVisible({ timeout: 10_000 });

  for (const context of contexts) await context.close();
});

test("a disconnected player is auto-rolled so the round never stalls", async ({ browser }) => {
  const { contexts, pages } = await openThreeSeats(browser);
  const [host, guest1] = pages as [Page, Page, Page];

  await startDice(host, 1);
  await expect(rollButton(host)).toBeVisible({ timeout: 10_000 });

  // third seat drops mid-round
  await contexts[2]!.close();

  await rollButton(host).click();
  await rollButton(guest1).click();

  await expect(host.getByRole("heading", { name: "1라운드 결과" })).toBeVisible({ timeout: 15_000 });
  await expect(host.locator(".dice-pod__auto")).toHaveCount(1);
  await expect(host.locator(".dice-table__row")).toHaveCount(3);

  for (const context of contexts.slice(0, 2)) await context.close();
});
