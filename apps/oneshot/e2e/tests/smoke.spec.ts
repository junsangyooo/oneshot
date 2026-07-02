import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/* Smoke against the current terminal UI (ko locale, cyber theme defaults).
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

test("home screen exposes create and join flows", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand")).toHaveText(/OneShot/i);
  await expect(page.getByRole("button", { name: "방 만들기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "입장하기" })).toBeVisible();
  // both actions stay disabled until a nickname is entered
  await expect(page.getByRole("button", { name: "방 만들기" })).toBeDisabled();
});

test("unknown room code lands on the room-not-found state", async ({ page }) => {
  await page.goto("/");
  await nicknameInput(page).fill("고스트");
  await page.locator(".field--code input").fill("ZZZZZ");
  await page.getByRole("button", { name: "입장하기" }).click();
  await expect(page.getByRole("heading", { name: "존재하지 않는 방" })).toBeVisible({ timeout: 10_000 });
});

test("host creates, guest joins, host reaches kinggame setup", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  const code = await createRoom(host, "민수");
  await joinRoom(guest, code, "지영");

  // guest is not the host: start button visible but disabled
  await expect(guest.getByRole("button", { name: /게임 시작/ })).toBeDisabled();

  // host starts the selected game (kinggame, min 2) and sees its setup screen
  await expect(host.getByRole("button", { name: /게임 시작/ })).toBeEnabled();
  await host.getByRole("button", { name: /게임 시작/ }).click();
  await expect(host.getByRole("heading", { name: "왕게임 설정" })).toBeVisible({ timeout: 10_000 });
  await expect(guest.getByText("방장이 모드를 정하는 중이에요...")).toBeVisible();

  // start button ignores clicks until a mode is picked (stays on setup)
  const start = host.getByRole("button", { name: "이 모드로 시작" });
  await expect(start).toBeDisabled();
  await host.getByRole("button", { name: /순한맛/ }).click();
  await expect(start).toBeEnabled();
  await start.click();

  // both clients land in the command phase (either king composer or number card)
  await expect(host.getByText("MODE: MILD")).toBeVisible({ timeout: 10_000 });
  await expect(guest.getByText("MODE: MILD")).toBeVisible();

  await guestContext.close();
  await hostContext.close();
});

test("kick requires confirmation and removes the guest", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  const code = await createRoom(host, "호스트");
  await joinRoom(guest, code, "게스트");

  await host.locator(".op .kick").first().click();
  await expect(host.getByText("내보내기 확인")).toBeVisible();
  await host.getByRole("button", { name: /내보내기$/ }).click();

  await expect(guest.getByText("방에서 나왔어요")).toBeVisible({ timeout: 10_000 });

  await guestContext.close();
  await hostContext.close();
});
