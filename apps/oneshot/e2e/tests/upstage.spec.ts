import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

/* 업스테이지 (Upstage) — locks in the trick-taking core: low beats high and the
   server reflects every play/pass, the penalty tax exchange settles instead of
   hanging the hand, and a rejected end-vote locks re-proposals with a cooldown.
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

// Seat three players and drive 업스테이지 through setup + the draw reveal.
const startUpstage = async (browser: Browser, { penalty }: { penalty: boolean }) => {
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

  await host.locator('.mod:has(.nm:text-is("업스테이지"))').click();
  await host.locator(".btn--init").click();

  await expect(host.locator(".up-setup")).toBeVisible({ timeout: 10_000 });
  for (const guest of [guest1, guest2]) {
    await expect(guest.getByText("방장이 설정하는 중이에요...")).toBeVisible({ timeout: 10_000 });
  }
  if (penalty) {
    await host.locator(".up-seg__btn", { hasText: "켜기" }).click();
    await expect(host.locator(".up-seg__btn.is-on")).toHaveText("켜기");
  }
  await host.getByRole("button", { name: "게임 시작" }).click();

  // hand-1 draw: every seat sees all three flipped cards, then anyone starts
  for (const page of pages) {
    await expect(page.locator(".up-draw__cell")).toHaveCount(3, { timeout: 10_000 });
    await expect(page.locator(".up-draw__cell .up-card")).toHaveCount(3);
  }
  await host.getByRole("button", { name: "이 순서로 시작" }).click();
  return { contexts, pages };
};

// The turn order comes from the random draw, so tests discover whose turn it is.
// `exclude` skips seats that already acted — a just-acted page can flash a stale
// turn indicator for a beat before the server broadcast lands.
const findTurnPage = async (pages: Page[], exclude: ReadonlySet<number> = new Set()): Promise<number> => {
  for (let tries = 0; tries < 40; tries += 1) {
    for (let i = 0; i < pages.length; i += 1) {
      if (exclude.has(i)) continue;
      if (await pages[i]!.locator(".up-status__turn").isVisible().catch(() => false)) return i;
    }
    await pages[0]!.waitForTimeout(250);
  }
  throw new Error("no seat ever became the turn player");
};

const handCounts = (pages: Page[]) =>
  Promise.all(pages.map((page) => page.locator(".up-hand .up-card").count()));

test.describe("업스테이지", () => {
  test("a full trick: low-beats-high play and passes are reflected on every seat", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "room budget: one project runs the suite");
    const { contexts, pages } = await startUpstage(browser, { penalty: false });

    // play phase: 3 rail seats, exactly one lit turn, the whole 80-card deck dealt
    for (const page of pages) {
      await expect(page.locator(".rail-seat")).toHaveCount(3, { timeout: 10_000 });
      await expect(page.locator(".rail-seat.is-turn")).toHaveCount(1);
      await expect(page.locator(".up-pile__empty")).toBeVisible();
    }
    const before = await handCounts(pages);
    expect(before.reduce((a, b) => a + b, 0), "the full 80-card deck is dealt").toBe(80);

    // the leader dumps their WEAKEST number (hands sort strongest-first), so the
    // next seat can surely beat it and the pass below is a real choice
    const leadIndex = await findTurnPage(pages);
    const leader = pages[leadIndex]!;
    await expect(leader.getByRole("button", { name: "패스" })).toBeDisabled(); // a lead cannot pass
    await leader.locator(".up-hand .up-card:not(.up-card--star)").last().click();
    await expect(leader.locator(".up-hand .up-card.is-selected")).toHaveCount(1);
    await leader.getByRole("button", { name: "내기" }).click();

    // the played card lands on the pile of EVERY seat (server broadcast)...
    for (const page of pages) {
      await expect(page.locator(".up-pile__cards .up-card")).toHaveCount(1, { timeout: 10_000 });
    }
    // ...and really left the leader's hand
    const after = await handCounts(pages);
    expect(after.reduce((a, b) => a + b, 0)).toBe(79);
    expect(after[leadIndex]).toBe(before[leadIndex]! - 1);

    // Both followers fold. A weakest-card lead is always beatable (26+ cards
    // can't all be ≥ the table's highest rank), so the auto-pass never fires and
    // both passes are real clicked choices.
    const firstIndex = await findTurnPage(pages, new Set([leadIndex]));
    await pages[firstIndex]!.getByRole("button", { name: "패스" }).click();
    // a pass is server state: the leader's rail shows the 패스 badge on that seat
    await expect(leader.locator(".rail-seat__badge")).toHaveCount(1, { timeout: 10_000 });
    const secondIndex = await findTurnPage(pages, new Set([leadIndex, firstIndex]));
    await pages[secondIndex]!.getByRole("button", { name: "패스" }).click();

    // everyone passed -> the trick dissolves and the same leader leads again
    for (const page of pages) {
      await expect(page.locator(".up-pile__empty")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".rail-seat__badge")).toHaveCount(0);
      await expect(page.locator(".rail-seat.is-turn")).toHaveCount(1);
    }
    await expect(leader.locator(".up-status__turn")).toBeVisible({ timeout: 10_000 });

    for (const ctx of contexts) await ctx.close();
  });

  test("the penalty tax exchange settles and the hand reaches play", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "room budget: one project runs the suite");
    const { contexts, pages } = await startUpstage(browser, { penalty: true });

    // penalty hand 1 opens in tax — or in declare when one seat drew both stars
    await expect(pages[0]!.locator(".up-declare, .up-tax").first()).toBeVisible({ timeout: 10_000 });
    if (await pages[0]!.locator(".up-declare").isVisible().catch(() => false)) {
      let declared = false;
      for (const page of pages) {
        const skip = page.getByRole("button", { name: "그냥 진행" });
        if (await skip.isVisible().catch(() => false)) {
          await skip.click();
          declared = true;
          break;
        }
      }
      expect(declared, "exactly one seat holds the declare choice").toBe(true);
    }

    // tax: one receiver picks cards, the others wait on a visible pending chip
    for (const page of pages) {
      await expect(page.locator(".up-tax")).toBeVisible({ timeout: 10_000 });
    }
    const receiverFlags = await Promise.all(
      pages.map((page) =>
        page.getByRole("heading", { name: "되돌려줄 카드를 고르세요" }).isVisible().catch(() => false),
      ),
    );
    expect(receiverFlags.filter(Boolean).length, "exactly one seat owes the return").toBe(1);
    const receiver = pages[receiverFlags.indexOf(true)]!;
    const waiter = pages[receiverFlags.indexOf(false)]!;
    await expect(waiter.locator(".up-chip")).toHaveCount(1);

    // 3 players -> the top seat returns exactly 2 cards; fewer keeps the CTA locked
    const returnBtn = receiver.getByRole("button", { name: /되돌려주기/ });
    await receiver.locator(".up-hand .up-card").nth(0).click();
    await expect(returnBtn).toBeDisabled();
    await receiver.locator(".up-hand .up-card").nth(1).click();
    await expect(returnBtn).toBeEnabled();
    await returnBtn.click();

    // the exchange settles: play starts everywhere, no card was lost in transit
    for (const page of pages) {
      await expect(page.locator(".up-status")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".rail-seat")).toHaveCount(3);
    }
    const counts = await handCounts(pages);
    expect(counts.reduce((a, b) => a + b, 0), "80 cards survive the tax exchange").toBe(80);

    for (const ctx of contexts) await ctx.close();
  });

  test("a rejected end vote closes everywhere and locks re-proposals with a countdown", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "room budget: one project runs the suite");
    const { contexts, pages } = await startUpstage(browser, { penalty: false });
    const [host, guest1, guest2] = pages as [Page, Page, Page];

    await expect(host.locator(".up-status")).toBeVisible({ timeout: 10_000 });
    await host.getByRole("button", { name: /종료 투표/ }).click();

    // the vote modal opens on every seat; the proposer has already auto-voted yes
    for (const page of pages) {
      await expect(page.locator(".up-vote")).toBeVisible({ timeout: 10_000 });
    }
    await expect(host.getByText("투표 중...")).toBeVisible();
    await expect(host.locator(".up-vote__tally")).toHaveText("1 찬성 / 3명");

    // both guests reject -> the vote fails, the modal leaves every seat
    await guest1.getByRole("button", { name: "반대" }).click();
    await guest2.getByRole("button", { name: "반대" }).click();
    for (const page of pages) {
      await expect(page.locator(".up-vote")).toHaveCount(0, { timeout: 10_000 });
      // the propose button becomes a disabled countdown on EVERY seat
      const cooldown = page.getByRole("button", { name: /재투표/ });
      await expect(cooldown).toBeVisible({ timeout: 10_000 });
      await expect(cooldown).toBeDisabled();
      // and the game itself keeps running
      await expect(page.locator(".up-status")).toBeVisible();
    }

    for (const ctx of contexts) await ctx.close();
  });

  test("the end vote is a non-blocking chip: play continues and a majority ends to lobby", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "room budget: one project runs the suite");
    const { contexts, pages } = await startUpstage(browser, { penalty: false });
    const [host, guest1] = pages as [Page, Page];

    await expect(host.locator(".up-status")).toBeVisible({ timeout: 10_000 });
    await host.getByRole("button", { name: /종료 투표/ }).click();

    // a small toolbar chip, never a modal — no backdrop may cover the table
    for (const page of pages) {
      await expect(page.locator(".up-vote")).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".modal-backdrop")).toHaveCount(0);
    }
    await expect(host.locator(".up-vote__row .btn")).toHaveCount(0); // proposer already voted
    await expect(guest1.locator(".up-vote__row .btn")).toHaveCount(2);

    // NON-BLOCKING: the turn player can still lead a card while the vote is open
    const leadIndex = await findTurnPage(pages);
    const leader = pages[leadIndex]!;
    await leader.locator(".up-hand .up-card:not(.up-card--star)").last().click();
    await leader.getByRole("button", { name: "내기" }).click();
    for (const page of pages) {
      await expect(page.locator(".up-pile__cards .up-card")).toHaveCount(1, { timeout: 10_000 });
      await expect(page.locator(".up-vote")).toBeVisible(); // the vote survived the play
    }

    // one more agree makes the connected majority -> straight back to the lobby
    const agreeSeat = pages.find((_, i) => i !== 0)!;
    await agreeSeat.getByRole("button", { name: "찬성" }).click();
    for (const page of pages) {
      await expect(page.locator(".scr--lobby")).toBeVisible({ timeout: 10_000 });
    }

    for (const ctx of contexts) await ctx.close();
  });
});
