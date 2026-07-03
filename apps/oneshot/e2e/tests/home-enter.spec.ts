import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/* Enter on the home form must follow intent: with a room code typed it JOINS,
   without one it creates a room. */

const nicknameInput = (page: Page) => page.getByPlaceholder("이름을 입력하세요...");

test("Enter with a room code joins instead of creating", async ({ browser }) => {
  // host creates a room the normal way
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  await host.goto("/");
  await nicknameInput(host).fill("호스트");
  await nicknameInput(host).press("Enter"); // no code → Enter creates
  await expect(host.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
  const link = await host.locator(".link-url").innerText();
  const code = link.match(/\/r\/([A-Z0-9]{4,8})/)?.[1] as string;

  // guest types the code and presses Enter → must JOIN that room
  const guestCtx = await browser.newContext();
  const guest = await guestCtx.newPage();
  await guest.goto("/");
  await nicknameInput(guest).fill("지영");
  await guest.locator(".field--code input").fill(code);
  await guest.locator(".field--code input").press("Enter");
  await expect(guest.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
  await expect(guest.locator(".sector .code span").first()).toHaveText(`#${code}`);
  // both seats are in the same room
  await expect(host.getByText("지영")).toBeVisible({ timeout: 10_000 });

  await hostCtx.close();
  await guestCtx.close();
});

test("invite URL shows the focused join page; creating elsewhere rewrites the address", async ({ browser }) => {
  // host makes room A
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  await host.goto("/");
  await nicknameInput(host).fill("호스트");
  await host.getByRole("button", { name: "방 만들기" }).click();
  await expect(host.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
  const linkA = await host.locator(".link-url").innerText();
  const codeA = linkA.match(/\/r\/([A-Z0-9]{4,8})/)?.[1] as string;
  // the host's own URL matches their room
  await expect.poll(() => new URL(host.url()).pathname).toBe(`/r/${codeA}`);

  // visitor opens /r/A → focused JOIN page: code shown, no create/code inputs
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/r/${codeA}`);
  await expect(page.locator(".join-code .val")).toHaveText(`#${codeA}`);
  await expect(page.getByRole("button", { name: "입장하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "방 만들기" })).toHaveCount(0);
  await expect(page.locator(".field--code")).toHaveCount(0);
  await page.screenshot({ path: "test-results/join-cyber.png" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "cozy"));
  await page.screenshot({ path: "test-results/join-cozy.png" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "cyber"));

  // escape hatch → full home → create a NEW room; the URL must follow it
  await page.getByRole("link", { name: "대신 새 방 만들기" }).click();
  await nicknameInput(page).fill("나그네");
  await page.getByRole("button", { name: "방 만들기" }).click();
  await expect(page.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
  const codeB = (await page.locator(".sector .code span").first().innerText()).replace("#", "");
  expect(codeB).not.toBe(codeA);
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/r/${codeB}`);
  expect(await page.locator(".link-url").innerText()).toContain(`/r/${codeB}`);

  // and Enter on the join page actually joins (fresh visitor)
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(`/r/${codeA}`);
  await nicknameInput(page2).fill("큐알");
  await nicknameInput(page2).press("Enter");
  await expect(page2.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });
  await expect(page2.locator(".sector .code span").first()).toHaveText(`#${codeA}`);

  await hostCtx.close();
  await ctx.close();
  await ctx2.close();
});
