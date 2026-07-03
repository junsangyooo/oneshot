import { expect, test } from "@playwright/test";

/* The header copy button must copy the room CODE; the link box copies the URL. */

test("code button copies the code, link button copies the invite URL", async ({ browser }) => {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();

  await page.goto("/");
  await page.getByPlaceholder("이름을 입력하세요...").fill("민수");
  await page.getByRole("button", { name: "방 만들기" }).click();
  await expect(page.getByText("초대 링크")).toBeVisible({ timeout: 10_000 });

  const link = await page.locator(".link-url").innerText();
  const code = link.match(/\/r\/([A-Z0-9]{4,8})/)?.[1] as string;
  expect(code).toBeTruthy();

  // header button → room code only
  await page.locator(".sector .copy").click();
  await expect(page.locator(".sector .copy")).toHaveText("✓"); // feedback
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);

  // link-box button → full invite URL
  await page.locator(".link-box .btn").click();
  await expect(page.locator(".link-box .btn")).toContainText("복사됨!");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

  await context.close();
});
