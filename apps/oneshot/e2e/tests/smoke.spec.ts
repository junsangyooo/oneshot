import { expect, test } from "@playwright/test";

test("home screen exposes create and join flows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "원샷" })).toBeVisible();
  await expect(page.getByRole("button", { name: "방 만들기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "입장하기" })).toBeVisible();
});

test("two players can complete a kinggame round and return to lobby", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByLabel("닉네임").fill("민수");
  await host.getByRole("button", { name: "방 만들기" }).click();
  await expect(host.getByRole("heading", { name: "왕게임" })).toBeVisible();
  await expect(host.getByAltText("입장 QR")).toBeVisible();

  const code = (await host.locator(".room-code span").allTextContents()).join("");
  expect(code).toMatch(/^[A-Z0-9]{5}$/);

  await guest.goto(`/r/${code}`);
  await guest.getByLabel("닉네임").fill("지영");
  await guest.getByRole("button", { name: "입장하기" }).click();
  await expect(guest.getByRole("heading", { name: "왕게임" })).toBeVisible();
  await expect(host.locator(".player-row")).toHaveCount(2);

  await host.getByRole("button", { name: "시작", exact: true }).click();
  await expect(host.getByRole("heading", { name: "왕게임" })).toBeVisible();
  await expect(guest.getByRole("heading", { name: "왕게임" })).toBeVisible();

  const hostReveal = host.getByRole("button", { name: "공개" });
  const hostIsKing = await hostReveal.isVisible().catch(() => false);
  const kingPage = hostIsKing ? host : guest;

  await kingPage.getByRole("button", { name: "공개" }).click();
  await expect(host.getByRole("heading", { name: "왕의 지시" })).toBeVisible();
  await expect(guest.getByRole("heading", { name: "왕의 지시" })).toBeVisible();

  await kingPage.getByRole("button", { name: "확인 완료" }).click();
  await expect(host.getByRole("heading", { name: "결과" })).toBeVisible();
  await host.getByRole("button", { name: "방으로 돌아가기" }).click();
  await expect(host.getByRole("heading", { name: "왕게임" })).toBeVisible();

  await guestContext.close();
  await hostContext.close();
});

test("host controls survive disconnect, reconnect, and kick", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  let host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await host.getByLabel("닉네임").fill("호스트");
  await host.getByRole("button", { name: "방 만들기" }).click();
  await expect(host.getByRole("heading", { name: "왕게임" })).toBeVisible();
  const code = (await host.locator(".room-code span").allTextContents()).join("");

  await guest.goto(`/r/${code}`);
  await guest.getByLabel("닉네임").fill("게스트");
  await guest.getByRole("button", { name: "입장하기" }).click();
  await expect(guest.getByRole("heading", { name: "왕게임" })).toBeVisible();
  await expect(guest.getByRole("button", { name: "시작", exact: true })).toBeDisabled();

  await host.close();
  await expect(guest.getByRole("button", { name: "시작", exact: true })).toBeEnabled();

  host = await hostContext.newPage();
  await host.goto("/");
  await expect(host.getByRole("heading", { name: "왕게임" })).toBeVisible();
  await expect(host.getByRole("button", { name: "시작", exact: true })).toBeEnabled();
  await expect(guest.getByRole("button", { name: "시작", exact: true })).toBeDisabled();

  await host.getByLabel("게스트 내보내기").click();
  await expect(host.locator(".player-row")).toHaveCount(1);

  await guestContext.close();
  await hostContext.close();
});
