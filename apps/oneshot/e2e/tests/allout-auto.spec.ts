import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/* Drives a real 2-player ALL OUT game with attack-hungry bots until one player
   is attacked while holding no response card, then verifies the auto-take
   banner appears and the game resolves it WITHOUT any button press. */

const nicknameInput = (page: Page) => page.getByPlaceholder("이름을 입력하세요...");

const createRoom = async (page: Page, nickname: string): Promise<string> => {
  await page.goto("/");
  await nicknameInput(page).fill(nickname);
  await page.getByRole("button", { name: "방 만들기" }).click();
  await expect(page.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
  const link = await page.locator(".link-url").innerText();
  return link.match(/\/r\/([A-Z0-9]{4,8})/)?.[1] as string;
};

const joinRoom = async (page: Page, code: string, nickname: string): Promise<void> => {
  await page.goto(`/r/${code}`);
  await nicknameInput(page).fill(nickname);
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
};

// One bot step: resolve modals, then play (attacks first) / draw / pass.
const step = async (page: Page): Promise<void> => {
  // modals first (color wheel / exchange target)
  const seg = page.locator(".ao-wheel__seg");
  if (await seg.count()) {
    await seg.first().click();
    return;
  }
  const target = page.locator(".ao-target");
  if (await target.count()) {
    await target.first().click();
    return;
  }
  if ((await page.locator(".ao-status__turn").count()) === 0) return; // not my turn
  if (await page.locator(".ao-autobanner").count()) return; // hands off — auto in progress

  const enabled = page.locator(".ao-hand .ao-card:not([disabled])");
  const n = await enabled.count();
  if (n > 0) {
    // prefer attack cards to build pressure
    const attack = enabled.filter({ hasText: /\+[247]/ });
    const pick = (await attack.count()) ? attack.first() : enabled.first();
    await pick.click();
    const play = page.getByRole("button", { name: /^내기/ });
    if (await play.isEnabled()) {
      await play.click();
      return;
    }
  }
  const pass = page.getByRole("button", { name: "패스" });
  if ((await pass.count()) && (await pass.isEnabled())) {
    await pass.click();
    return;
  }
  const draw = page.getByRole("button", { name: /뽑기|받기/ });
  if ((await draw.count()) && (await draw.first().isEnabled())) {
    await draw.first().click();
  }
};

test("allout auto-take resolves an unanswerable attack without a button", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const host = await ctxA.newPage();
  const guest = await ctxB.newPage();

  const code = await createRoom(host, "민수");
  await joinRoom(guest, code, "지영");
  await host.locator(".mod", { hasText: "올아웃" }).click();
  await host.getByRole("button", { name: /게임 시작/ }).click();

  await expect(host.getByRole("heading", { name: "올아웃 설정" })).toBeVisible({ timeout: 10_000 });
  // max rounds so the game doesn't end before we hit the auto state
  for (let i = 0; i < 7; i += 1) await host.locator(".ao-stepper .btn").nth(1).click();
  await host.getByRole("button", { name: "게임 시작" }).click();
  await expect(host.locator(".ao-hand .ao-card").first()).toBeVisible({ timeout: 10_000 });

  const pages = [host, guest];
  let sawAutoBanner = false;
  let bannerPage: Page | null = null;

  for (let iter = 0; iter < 300 && !sawAutoBanner; iter += 1) {
    for (const p of pages) {
      if (await p.locator(".ao-autobanner").count()) {
        sawAutoBanner = true;
        bannerPage = p;
        break;
      }
      // if a round ended, advance (host only has the button)
      const next = p.getByRole("button", { name: "다음 라운드" });
      if (await next.count()) {
        await next.click().catch(() => {});
        continue;
      }
      await step(p).catch(() => {}); // tolerate races; server stays authoritative
    }
    await host.waitForTimeout(150);
  }

  expect(sawAutoBanner, "auto banner should appear within the driven game").toBe(true);

  // hands off: the pending attack resolves on its own (banner + attack clear)
  await expect(bannerPage!.locator(".ao-autobanner")).toHaveCount(0, { timeout: 8_000 });
  await expect(bannerPage!.locator(".ao-attack")).toHaveCount(0, { timeout: 8_000 });

  await ctxA.close();
  await ctxB.close();
});
