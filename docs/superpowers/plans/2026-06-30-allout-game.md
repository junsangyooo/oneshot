# ALL OUT (올아웃) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OneShot 게임 허브에 색 기반 UNO 변형 셰딩 게임 `allout`을 추가한다 — 권위 서버 규칙 + 2테마×2언어 클라이언트.

**Architecture:** 서버 `AlloutCore`(순수 규칙 엔진) + `AlloutModule`(GameModule 어댑터), upstage와 동형. 색 선택·교환 대상은 **play 액션 payload에 포함**(별도 대기 phase 없음 → 추방 데드락 회피). 클라이언트는 phase별 뷰 + 색 휠 모달 + 멀티카드 선택.

**Tech Stack:** TypeScript, React, Colyseus(기존), pnpm workspace(`apps/oneshot`), vitest.

## Global Constraints

- pnpm은 `apps/oneshot`에서 `corepack pnpm`으로 실행. 검증: `corepack pnpm -r typecheck`, `corepack pnpm --filter @oneshot/server test`, `corepack pnpm --filter @oneshot/client build`.
- 색/폰트/간격 **토큰만** 사용(하드코딩 hex/px 금지). 4 카드색은 새 토큰 `--card-red/-yellow/-blue/-green`(+ 대비 잉크)으로 `:root`(cyber)·`[data-theme="cozy"]` 양쪽 정의.
- 레이아웃은 `.scr--allout`로 스코프. 공용 원자(`.btn`,`.modal`,`RulesModal`,`AvatarImg`) 재사용.
- 사용자 텍스트는 i18n(ko·en) 양쪽. 게임명 `gameTitle`/`gameTagline` 경유.
- 비밀(손패)은 `getStateFor`로만. `getPublicState()`엔 handCount만.
- 모바일: 손패만 스크롤·1차 액션 고정, 상단바 ≤560px 1열, 터치 ≥44px.
- 추방/끊김 견고성: 대기 액션 주체 추방 시 정지 금지·유령참조 제거·투표는 접속 인원 기준.
- 완료 = typecheck + server test + client build + (cyber·cozy)×(ko·en) + `/_states` + 모바일 폭.

---

## 설계 결정 (스펙 대비 확정)

1. **색 선택은 play payload에 포함**(`chosenColor`), Exchange 대상도 payload(`exchangeTargetId`). → 별도 `chooseColor`/대상선택 대기 phase 없음.
2. **방어(Shield/Reflect)는 일반 play로 처리** — 서버가 `pendingAttack>0`일 때만 합법으로 검증. 별도 phase 없음.
3. **시작 카드는 항상 숫자 카드** — 뒤집은 카드가 특수/색무관이면 덱에 되돌리고 다시 뽑음. 첫 턴 색 선택 모호성 제거(스펙의 "특수 시작=효과없음/색무관=첫 플레이어 색지정"을 단순화).
4. **draw 분기**: 공격 없을 때 = 1장 뽑기(뽑은 카드 포함 멀티세트로 즉시 내거나 pass). 공격 중일 때 = 누적 더미 전부 받기(pendingAttack=0, 턴 넘김).
5. **멀티카드**: 같은 `value`의 number 세트, 또는 같은 `kind`의 function 세트. 숫자↔기능 혼합 불가. 마지막 카드가 다음 색 기준.
6. **Reverse 멀티/2인**: 방향 k회 반전. `k` 짝수 또는 2인 → 같은 플레이어 다시.

---

## 파일 맵

**shared** (`apps/oneshot/shared/src/`)
- Create `games/allout.ts` — 카드/상태/액션/상수 전체.
- Modify `schema/domain.ts:3` — `GameId`에 `"allout"`.
- Modify `games/catalog.ts` — catalog 항목.
- Modify `index.ts` — `export * from "./games/allout";`

**server** (`apps/oneshot/server/src/`)
- Create `games/allout/alloutCore.ts` — 규칙 엔진.
- Create `games/allout/AlloutModule.ts` — 어댑터(upstage 동형).
- Modify `games/registry.ts` — 등록.
- Create `tests/allout.test.ts` — 봇 풀게임 + 엣지.

**client** (`apps/oneshot/client/src/`)
- Modify `design/games.ts` — `GAME_META.allout` + `GAME_ORDER`.
- Modify `i18n/index.ts` — ko·en 키.
- Create `games/allout/AlloutGameScreen.tsx` — 화면.
- Create `games/allout/AlloutCard.tsx` — 카드 렌더(색·kind별).
- Modify `games/registry.tsx` — `GAME_SCREENS.allout`.
- Modify `app/app.css` — `.scr--allout` cyber 레이아웃.
- Modify `design/terminal.css` — 카드색 토큰 + cozy 오버라이드.
- Create `public/themes/{cyber,cozy}/games/allout.png` — 썸네일(선택, (Task 11)).

---

## Task 1: shared 타입 / 카탈로그 / GameId

**Files:** Create `shared/src/games/allout.ts`; Modify `shared/src/schema/domain.ts`, `shared/src/games/catalog.ts`, `shared/src/index.ts`.

**Produces:** 아래 전체 타입/상수/액션. 모든 후속 task가 이 계약에 의존.

- [ ] **Step 1: `allout.ts` 작성** (전체 코드)

```ts
// ALL OUT (올아웃) — 색 기반 UNO 변형 셰딩 게임. shared wire types.
// 권위 서버: 덱/딜/검증/랜덤/승패/점수. 손패는 getStateFor(playerId)로만.

export type AlloutColor = "red" | "yellow" | "blue" | "green";
export const ALLOUT_COLORS: AlloutColor[] = ["red", "yellow", "blue", "green"];

// 색무관 kind: plus4 plus7 exchange reflect wild. 색있는 kind: number plus2 reverse shield.
export type AlloutCard =
  | { id: string; kind: "number"; color: AlloutColor; value: number } // 1..13
  | { id: string; kind: "plus2"; color: AlloutColor }
  | { id: string; kind: "plus4" }
  | { id: string; kind: "plus7" }
  | { id: string; kind: "exchange" }
  | { id: string; kind: "reverse"; color: AlloutColor }
  | { id: string; kind: "shield"; color: AlloutColor }
  | { id: string; kind: "reflect" }
  | { id: string; kind: "wild" }; // 색변환

export type AlloutKind = AlloutCard["kind"];
export const ALLOUT_COLORLESS: AlloutKind[] = ["plus4", "plus7", "exchange", "reflect", "wild"];
export const ALLOUT_ATTACK: AlloutKind[] = ["plus2", "plus4", "plus7"];

export type AlloutOptions = Record<string, never>; // setup phase에서 설정
export const defaultAlloutOptions: AlloutOptions = {};

export const ALLOUT_ROUNDS_MIN = 1;
export const ALLOUT_ROUNDS_MAX = 10;
export const ALLOUT_ROUNDS_DEFAULT = 3;
export const ALLOUT_BANKRUPT_MIN = 8; // 시작 7장 초과
export const ALLOUT_BANKRUPT_MAX = 20;
export const ALLOUT_BANKRUPT_DEFAULT = 15;
export const ALLOUT_START_HAND = 7;

export type AlloutPhase = "setup" | "play" | "roundEnd" | "ended";

export type AlloutPlayerPublic = {
  playerId: string;
  handCount: number;
  rank: number | null; // 이번 라운드 등수(1=1등), 진행 중 null
  cumulativeScore: number; // 라운드 등수 합(낮을수록 우승)
  finished: boolean; // 이번 라운드 완주(손패 0) 또는 파산 탈락
  bankrupt: boolean; // 파산으로 탈락
};

export type AlloutTop = {
  card: AlloutCard; // 마지막으로 놓인 카드
  color: AlloutColor; // 매칭 기준 색(색무관 카드면 지정색)
};

export type AlloutEndVote = { proposedBy: string; votes: Record<string, boolean> };

export type AlloutPublicState = {
  phase: AlloutPhase;
  roundNumber: number; // 1-based
  totalRounds: number;
  bankruptcyOn: boolean;
  bankruptcyLimit: number;
  doubleDeck: boolean; // 9~16명
  drawPileCount: number;
  order: string[]; // 좌석/턴 순서(라운드 시작 시 직전 등수순)
  players: AlloutPlayerPublic[];
  currentTurnPlayerId: string | null;
  direction: 1 | -1; // 1=정방향
  top: AlloutTop | null;
  pendingAttack: number; // 누적 공격 장수(0=없음)
  attackFromId: string | null; // 직전에 공격을 얹은 사람(Reflect 대상 계산용)
  drawnPendingPlayerId: string | null; // draw 후 그 카드로 낼지/패스할지 대기 중인 플레이어
  lastRoundRanking: string[] | null;
  endVote: AlloutEndVote | null;
};

export type AlloutPrivateState = {
  hand: AlloutCard[]; // 내 손패(정렬: 색→숫자→기능)
  drawnCardId: string | null; // 방금 뽑아 아직 낼지 결정 안 한 카드 id
};

// --- action payloads ---
export type AlloutConfigurePayload = {
  totalRounds: number; // [MIN,MAX] clamp
  bankruptcyOn: boolean;
  bankruptcyLimit: number; // [MIN,MAX] clamp
};
export type AlloutPlayPayload = {
  cards: string[]; // 카드 id들(순서 = 놓는 순서, 마지막이 색 기준)
  chosenColor?: AlloutColor; // 색무관 카드 낼 때 필수
  exchangeTargetId?: string; // exchange 낼 때 필수
};
export type AlloutVoteEndPayload = { agree: boolean };

export const ALLOUT_ACTIONS = {
  configure: "allout:configure", // host: setup -> play(라운드1)
  play: "allout:play",
  draw: "allout:draw", // 공격중=더미받기 / 평상시=1장
  pass: "allout:pass", // draw 후 안 내고 턴 종료
  nextRound: "allout:nextRound", // host: roundEnd -> 다음 라운드
  proposeEnd: "allout:proposeEnd",
  voteEnd: "allout:voteEnd",
} as const;

// 덱 배수: 9명 이상이면 2배.
export const alloutDeckCopies = (playerCount: number): number => (playerCount >= 9 ? 2 : 1);
```

- [ ] **Step 2: `domain.ts:3` 수정**

```ts
export type GameId = "kinggame" | "upstage" | "liar" | "fool-liar" | "arithmetic" | "allout";
```

- [ ] **Step 3: `catalog.ts`에 항목 추가** (import + 배열에)

```ts
import { defaultAlloutOptions } from "./allout";
// ... 배열에:
  {
    id: "allout",
    title: "올아웃",
    minPlayers: 2,
    maxPlayers: 16,
    complexity: 3,
    supportsJoinInProgress: false,
    defaultOptions: defaultAlloutOptions,
    status: "available",
  },
```

- [ ] **Step 4: `index.ts`에 export 추가**

```ts
export * from "./games/allout";
```

- [ ] **Step 5: typecheck + commit**

Run: `corepack pnpm --filter @oneshot/shared typecheck` → PASS
`git add -A && git commit -m "feat(allout): shared types, actions, catalog entry"`

---

## Task 2: AlloutCore — 덱/딜/라운드 시작 + setup + 상태 직렬화

**Files:** Create `server/src/games/allout/alloutCore.ts`; Test `server/tests/allout.test.ts`.

**Interfaces (Produces):** upstage 동형 public API —
`start({players, randomSeed})`, `configure(isHost, payload)`, `play(playerId, payload)`, `draw(playerId)`, `pass(playerId)`, `nextRound(isHost)`, `proposeEnd(isHost, playerId)`, `voteEnd(playerId, payload)`, `onPlayerLeave/Return/Removed(id)`, `getPublicState()`, `getStateFor(id)`, `isOver()`. 모두 `ActionResult`.

내부 상태(필드): `players: PublicPlayerState[]`, `randomizer`, `phase`, `totalRounds`, `bankruptcyOn`, `bankruptcyLimit`, `roundNumber`, `doubleDeck`, `hands: Map<string, AlloutCard[]>`, `drawPile: AlloutCard[]`, `discardTop: AlloutCard`, `activeColor: AlloutColor`, `pendingAttack: number`, `attackFromId: string|null`, `order: string[]`, `direction: 1|-1`, `currentTurnId: string|null`, `finished: string[]`(완주/탈락 순서), `bankrupt: Set<string>`, `cumulative: Map<string,number>`, `drawnPending: {playerId, cardId}|null`, `disconnected: Set<string>`, `endVote`, `lastRoundRanking`, `result`.

- [ ] **Step 1: 실패 테스트 — 덱 구성** (`buildDeck` via 라운드 시작 후 총 카드 수 검증)

```ts
import { describe, it, expect } from "vitest";
import { AlloutCore } from "../src/games/allout/alloutCore";
import type { PublicPlayerState } from "@oneshot/shared";

const mkPlayers = (n: number): PublicPlayerState[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, nickname: `P${i}`, avatarKey: "a", themeId: "cyber",
    seatIndex: i, isHost: i === 0, connectionStatus: "online" as const,
    joinedAt: 0, lastSeenAt: 0,
  }));

const setupCore = (n: number, opts?: Partial<{ totalRounds: number; bankruptcyOn: boolean; bankruptcyLimit: number }>) => {
  const core = new AlloutCore();
  core.start({ players: mkPlayers(n), randomSeed: "seed-allout" });
  core.configure(true, { totalRounds: 2, bankruptcyOn: false, bankruptcyLimit: 15, ...opts });
  return core;
};

describe("allout deck & deal", () => {
  it("deals 7 each, single deck for <=8, draw pile = 80-7n-1", () => {
    const core = setupCore(4);
    const pub = core.getPublicState();
    expect(pub.phase).toBe("play");
    expect(pub.players.every((p) => p.handCount === 7)).toBe(true);
    expect(pub.drawPileCount).toBe(80 - 7 * 4 - 1);
    expect(pub.top?.card.kind).toBe("number"); // 시작은 항상 숫자
    expect(pub.doubleDeck).toBe(false);
  });
  it("doubles deck for 9+ players (160 cards)", () => {
    const core = setupCore(9);
    const pub = core.getPublicState();
    expect(pub.doubleDeck).toBe(true);
    expect(pub.drawPileCount).toBe(160 - 7 * 9 - 1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** Run: `corepack pnpm --filter @oneshot/server test allout` → FAIL (module not found)

- [ ] **Step 3: `alloutCore.ts` 구현 — buildDeck / start / configure / beginRound / 상태 직렬화**

핵심 로직:
- `buildDeck(copies)`: copies번 반복하며 — number 4색×1..13(각 1장), plus2 4색×2, plus4 ×4, plus7 ×1, exchange ×1, reverse 4색×1, shield 4색×1, reflect ×2, wild ×4. id는 `${kind}-${color?}-${copy}-${seq}` 유니크. 단일덱 합 80 단언.
- `start`: upstage `start`와 동형. `order = seatIndex 순`, `cumulative=0`, `phase="setup"`, `doubleDeck = alloutDeckCopies(n)>1`.
- `configure(isHost, payload)`: phase==="setup"·isHost 검증. payload(totalRounds·bankruptcyOn·bankruptcyLimit) 타입검증 + clamp. 저장 후 `beginRound()`.
- `beginRound()`: `roundNumber+=1`, hands/finished/bankrupt/drawnPending 리셋. 덱 셔플(`randomizer.shuffle`). 7장씩 `order` 순 딜. 남은 더미에서 **숫자 카드가 나올 때까지** 시작 카드 pop(특수면 덱 끝으로 보냄). `discardTop=시작카드`, `activeColor=시작카드.color`. `pendingAttack=0`, `attackFromId=null`, `direction=1`, `currentTurnId=order[0]`, `phase="play"`. (첫 라운드 order=입장순, 이후 라운드는 직전 finished 순으로 이미 재배치됨 — Task 5 `endRound`.)
- `getPublicState()`: upstage 패턴. players 매핑(handCount/rank/cumulative/finished/bankrupt), top=`{card:discardTop,color:activeColor}`(play 중), drawPileCount, direction 등.
- `getStateFor(id)`: `{ hand: sortHand(hands[id]), drawnCardId: drawnPending?.playerId===id ? drawnPending.cardId : null }`.
- `sortHand`: 색(ALLOUT_COLORS 순)→number value→기능 kind 순 정렬(표시 일관성).
- 미구현 액션(play/draw/pass/...)은 `fail("INVALID_ACTION", …)` 임시 스텁.

- [ ] **Step 4: 테스트 통과 확인** → PASS

- [ ] **Step 5: Commit** `git commit -m "feat(allout): core deck/deal/round-setup + state"`

---

## Task 3: AlloutCore — play 검증 (parseSet · 매칭 합법성 · 멀티카드)

**Files:** Modify `alloutCore.ts`; `tests/allout.test.ts`.

**Interfaces (Consumes):** Task 2 상태. **Produces:** `play(playerId, payload)` 정상 동작(공격/특수 효과는 Task 4–5에서 확장; 여기선 number/reverse/wild 기본 + 합법성).

규칙:
- `parseSet(cards)`: 빈 배열 fail. 모두 같은 `kind`인가? number면 모두 같은 `value`. 그 외엔 모두 동일 kind. 반환 `{kind, value?, count, lastColor?}` (lastColor = 마지막 카드 색, 색있는 kind만).
- 합법성 `isPlayable(set, top, pendingAttack)`:
  - pendingAttack>0 (공격 중): Task 4에서 처리(여기선 pendingAttack===0 가정, >0이면 fail "지금은 막거나 받아야 합니다" 임시).
  - 색무관 kind: wild/exchange는 pendingAttack===0에서만(공격 위 금지), 합법. plus4/plus7/reflect는 Task 4.
  - number 세트: `value===top.number(top.card.kind==="number"?value:null)` **또는** set에 `color===activeColor` 카드 존재 → 합법.
  - reverse/shield/plus2(색있는 기능): `kind===top.card.kind` **또는** set에 `color===activeColor` 존재 → 합법. (shield/plus2는 Task 4 공격맥락에서 재검증.)
- `chosenColor` 요구: 색무관 kind이면 payload.chosenColor ∈ ALLOUT_COLORS 필수.
- commit: 손패에서 제거, `discardTop = 마지막 카드`, `activeColor = lastColor ?? chosenColor`. effect 적용(Task 4–5). 빈 손패면 `finished.push` + rank. 그 후 `advanceTurn`.
- number/wild/reverse만 이 task에서 효과 처리. reverse는 Task 4(방향)로 미뤄도 되나 여기서 간단히: 방향 반전 + 짝수/2인 본인차례. (Task 4와 중복 피하려 reverse 방향로직은 Task 4에 둠 — 여기선 number·wild만 효과, reverse는 "놓이되 효과는 Task 4" 주석.)

- [ ] **Step 1: 실패 테스트** — 합법/불법 play

```ts
describe("allout play validation", () => {
  it("rejects a card that matches neither color nor number", () => {
    // p0 손패를 알 수 없으므로: getStateFor로 현재 손패를 읽어, top과 안 맞는 카드를 골라 fail 확인
    const core = setupCore(2);
    const me = core.getStateFor(core.getPublicState().currentTurnPlayerId!);
    const top = core.getPublicState().top!;
    const bad = me.hand.find(
      (c) => c.kind === "number" && c.color !== top.color && c.value !== (top.card.kind === "number" ? top.card.value : -1),
    );
    if (bad) {
      const r = core.play(core.getPublicState().currentTurnPlayerId!, { cards: [bad.id] });
      expect(r.ok).toBe(false);
    }
  });
  it("accepts a color-matching number and updates top/turn", () => {
    const core = setupCore(2);
    const turn = core.getPublicState().currentTurnPlayerId!;
    const top = core.getPublicState().top!;
    const good = core.getStateFor(turn).hand.find((c) => c.kind === "number" && c.color === top.color);
    if (good) {
      const r = core.play(turn, { cards: [good.id] });
      expect(r.ok).toBe(true);
      expect(core.getPublicState().currentTurnPlayerId).not.toBe(turn);
    }
  });
});
```

- [ ] **Step 2: FAIL 확인** → 임시 스텁이라 합법 play도 fail.
- [ ] **Step 3: 구현** — `parseSet`, `isPlayable`(공격 0 경로), commit + `advanceTurn`(단순 next, 방향=현재). wild 효과(색만), number 효과(없음).
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: Commit** `git commit -m "feat(allout): play validation, parseSet, multi-card"`

---

## Task 4: AlloutCore — 공격 누적 · Shield · Reflect · draw/받기 · 방향/Reverse

**Files:** Modify `alloutCore.ts`; `tests/allout.test.ts`.

규칙:
- **공격 얹기**(plus2/plus4/plus7): effect로 `pendingAttack += {2,4,7}×count`, `attackFromId = playerId`, 그 후 `advanceTurn`(다음 사람이 victim). plus2는 `kind===plus2`(다른 +2 위) 또는 색매칭에서만 합법(Task 3 규칙 + 공격중엔 아래).
- **공격 중(pendingAttack>0) victim의 합법 수**:
  - plus2: top이 plus2거나 activeColor 매칭 시 얹기 가능.
  - plus4/plus7: 언제나 얹기 가능.
  - shield: `kind===shield` && `color===activeColor`일 때만 → `pendingAttack=0`, attackFromId=null, advanceTurn(공격 소멸, 다음 사람 평상시).
  - reflect: 언제나 → `attackFromId`(=직전 공격자)에게 pendingAttack 유지한 채 넘김 + **방향 반전**. 즉 `direction*=-1`, `currentTurnId=attackFromId`, `attackFromId=playerId`(되받은 사람이 다음 반사 대상). chosenColor로 activeColor 갱신.
  - 그 외 카드/숫자: fail("막거나 받아야 합니다").
- **draw(playerId)**:
  - 공격중: victim이 `pendingAttack`장 더미에서 뽑아 손패에 추가(`drawFromPile(n)`), `pendingAttack=0`, attackFromId=null, advanceTurn. 파산 체크(Task 5).
  - 평상시: 1장 뽑아 손패 추가, `drawnPending={playerId,cardId}`. 턴 유지(아직 currentTurn). 파산 체크.
- **pass(playerId)**: `drawnPending?.playerId===playerId`일 때만 합법 → drawnPending=null, advanceTurn. (공격중 pass 불가.)
- **play after draw**: `drawnPending?.playerId===playerId`이면 play의 cards에 `drawnPending.cardId` 포함 강제. 합법이면 drawnPending=null 후 진행.
- **방향/Reverse**: reverse effect → `direction *= (-1)^count`. `selfAgain = (count % 2 === 0) || activePlayerCount===2`. selfAgain이면 advanceTurn 대신 currentTurn 유지(같은 사람 다시). 아니면 advanceTurn(새 방향).
- `advanceTurn`: `nextActiveAfter(from, direction)` — finished/bankrupt 제외, direction 방향 순회.
- `drawFromPile(n)`: 더미 부족 시 discardTop 제외한 버린 더미 리셔플(여기선 버린 카드 추적이 없으므로 **간소화: 더미 소진 시 새 덱을 셔플해 보충**하되 카드 id 충돌 방지 위해 reshuffleSeq 증가시켜 id suffix 부여). 주석으로 명시.

- [ ] **Step 1: 실패 테스트** — 공격 누적/받기, shield, reflect, reverse 2인
```ts
describe("allout attacks", () => {
  it("plus2 stacks and victim draws the pile", () => { /* 손패 주입 헬퍼로 결정적 시나리오 */ });
  it("shield of active color clears the stack", () => { /* ... */ });
  it("reflect bounces stack to previous attacker and reverses", () => { /* ... */ });
  it("reverse with 2 players returns turn to self", () => { /* ... */ });
});
```
구현 편의를 위해 테스트용 **결정적 손패 주입** 헬퍼(`core.__setHandForTest(id, cards)` — `/* test-only */` 주석, 또는 seed 고정 시나리오)를 추가한다. (권장: 작은 `setHand`/`setTop` 테스트 헬퍼를 코어에 두되 prod 경로 미사용.)

- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — 위 규칙 전부.
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: Commit** `git commit -m "feat(allout): attack stacking, shield, reflect, draw, reverse"`

---

## Task 5: AlloutCore — Exchange · 파산 · 라운드 종료 · 점수 · isOver

**Files:** Modify `alloutCore.ts`; `tests/allout.test.ts`.

규칙:
- **Exchange**: pendingAttack===0에서만. `exchangeTargetId` 검증(존재·본인 아님·`!finished`·`!bankrupt`). 두 손패 swap. chosenColor로 activeColor. advanceTurn. swap 후 양쪽 파산 체크.
- **파산 체크** `checkBankrupt(id)`: `bankruptcyOn && handCount >= bankruptcyLimit && !finished` → `bankrupt.add(id)`, `finished.push(id)`(완주 목록 맨 뒤로 = 더 꼴찌), currentTurn이 그였으면 advanceTurn. 라운드 종료 체크.
- **라운드 종료** `checkRoundOver()`: active(=`!finished`) ≤ 1이면 종료. 남은 1명 finished에 추가. **등수 = finished 순서**(1등=먼저 비운 사람; 파산자는 들어간 순서대로 뒤쪽 = 먼저 파산한 사람이 더 꼴찌가 되도록 파산 시 push 순서 보장). `cumulative[id]+= rank(=index+1)`. `lastRoundRanking=[...finished]`. `order=[...finished]`(다음 라운드 직전등수순). phase="roundEnd".
- **nextRound(isHost)**: phase==="roundEnd"·isHost. `roundNumber>=totalRounds`면 `finish()`. 아니면 `beginRound()`.
- **finish(summary)**: upstage 동형 — cumulative 오름차순 ranking, 최저점 winners, phase="ended".
- **isOver**: `result`.

- [ ] **Step 1: 실패 테스트** — 풀게임(2~4인 봇) 끝까지, 파산 ON 탈락, 점수 합산.
```ts
it("plays a full 2-round game to completion (bot loop)", () => {
  const core = setupCore(3, { totalRounds: 2 });
  // 봇: 현재 턴 플레이어의 합법 수를 찾아 play, 없으면 draw->(낼수있으면play else pass).
  // 가드 루프 5000회. 종료 시 isOver() != null, ranking 3명, winner 최저 cumulative.
});
it("bankruptcy eliminates a player at the limit (auto last)", () => { /* ... */ });
```
봇 헬퍼 `autoPlay(core)`는 public getState/getStateFor만 사용(권위 검증 경유). 합법수 탐색: number 색/숫자매칭 → 단일 play, 공격중이면 shield/reflect/plus 우선 else draw(받기).

- [ ] **Step 2: FAIL** → **Step 3: 구현** → **Step 4: PASS**
- [ ] **Step 5: Commit** `git commit -m "feat(allout): exchange, bankruptcy, round-end scoring, finish"`

---

## Task 6: AlloutModule + 등록 + 생명주기/투표 견고성

**Files:** Create `server/src/games/allout/AlloutModule.ts`; Modify `server/src/games/registry.ts`; `tests/allout.test.ts`.

- [ ] **Step 1: 실패 테스트 — 견고성 회귀**
```ts
describe("allout robustness", () => {
  it("removing the current attacker mid-attack does not freeze", () => {
    // 공격 누적 상태에서 victim(현재 턴) onPlayerRemoved -> currentTurn 다음으로 넘어가고 진행 가능
  });
  it("disconnected players don't deadlock the early-end vote", () => {
    const core = setupCore(3);
    core.onPlayerLeave("p2");           // 끊김
    core.proposeEnd(true, "p0");        // host 발의(자동 찬성)
    core.voteEnd("p1", { agree: true }); // 접속 2명 중 2명 찬성 -> 종료
    expect(core.isOver()).not.toBeNull();
  });
  it("removing the drawnPending player advances cleanly", () => { /* ... */ });
});
```
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — `AlloutModule`(UpstageModule 동형 switch). `onPlayerRemoved`(alloutCore): players/hands/cumulative/order/finished/bankrupt/disconnected/drawnPending에서 제거; `attackFromId===id`면 null; `currentTurnId===id`면 advanceTurn; `drawnPending?.playerId===id`면 null 후 advanceTurn; endVote 재정산; checkRoundOver. `onPlayerLeave`=disconnected.add + endVote 재정산. `onPlayerReturn`=delete. `resolveEndVote`/`proposeEnd`/`voteEnd`는 upstage 동형(접속 인원 분모). registry에 `["allout", () => new AlloutModule()]` + import.
- [ ] **Step 4: PASS — 전체 서버 테스트** `corepack pnpm --filter @oneshot/server test` → PASS
- [ ] **Step 5: Commit** `git commit -m "feat(allout): module, registry, lifecycle robustness"`

---

## Task 7: 클라이언트 메타 + i18n + 레지스트리 + 화면 스켈레톤

**Files:** Modify `client/src/design/games.ts`, `client/src/i18n/index.ts`, `client/src/games/registry.tsx`; Create `client/src/games/allout/AlloutGameScreen.tsx`, `client/src/games/allout/AlloutCard.tsx`.

- [ ] **Step 1: `games.ts`** — `GAME_META.allout = { glyph: "◆", accent: "red", min: 2, max: 16 }`, `GAME_ORDER`에 `"allout"` 추가.
- [ ] **Step 2: `i18n/index.ts`** — ko·en에 `game.allout`, `gametag.allout`, 그리고 `allout.*` 키 전부(setup/play/roundEnd/vote/rules/색·kind 라벨/공격·방어 힌트). (Task 8·10에서 참조하는 모든 키를 여기 정의.) 핵심 키 목록:
  `allout.loading, allout.you, allout.setup.{title,rounds,bankruptcy,bankruptcyOn,bankruptcyOff,limit,start,waitingHost}, allout.play.{yourTurn,turnOf,lead,draw,pass,play,take,defend,chooseColor,pickTarget,attack,direction.cw,direction.ccw,bankruptSoon,lastCard,out,bankruptOut}, allout.color.{red,yellow,blue,green}, allout.roundEnd.{title,rankCol,scoreCol,next,finish,waitingHost}, allout.vote.*(upstage 동형), allout.rules.{title,p1..p7}, allout.proposeEnd`.
- [ ] **Step 3: `registry.tsx`** — import + `GAME_SCREENS.allout = AlloutGameScreen`.
- [ ] **Step 4: `AlloutCard.tsx`** — 카드 1장 렌더. props `{card, selected?, dim?, onClick?}`. 색있는 카드는 `data-color`(red/yellow/blue/green)로 토큰 색 적용(클래스 `ao-card ao-card--<kind>`), 라벨: number=숫자, plus2="+2", plus4="+4", plus7="+7"(특별 스타일 `ao-card--joker`), exchange="⇄"(`ao-card--exchange`), reverse="⟲", shield="⛨", reflect="↩", wild=4색 휠 글리프. 텍스트는 i18n 불필요(기호) — 단 접근성 aria-label은 i18n.
- [ ] **Step 5: `AlloutGameScreen.tsx` 스켈레톤** — UpstageGameScreen 골격 복사: `useT`, `useRoomStore(s=>s.send)`, `pub=activeGame.publicState as AlloutPublicState`, `me as AlloutPrivateState`, `sendAction`, 상단바(readout + 라운드 표시 + `?`·⚙·proposeEnd), `setup` 뷰(host: rounds 스텝퍼 + 파산 세그/limit 스텝퍼 + 시작 / else 대기), 그 외 phase는 placeholder. `RulesModal`/`SettingsModal` 연결.
- [ ] **Step 6: build + commit** `corepack pnpm --filter @oneshot/client build` → PASS. `git commit -m "feat(allout): client meta, i18n, registry, screen skeleton + setup"`

---

## Task 8: 클라이언트 play 뷰 (턴/방향/손패/멀티카드/색휠/방어)

**Files:** Modify `AlloutGameScreen.tsx`.

`PlayView` 컴포넌트(파일 내) — 구조:
- **좌석 링**: `pub.order` 매핑. 각 좌석 `AvatarImg` + 이름 + handCount(또는 out/bankruptOut). 클래스: `is-turn`(currentTurn 글로우 펄스), `is-attacker`(attackFromId), `is-out`(finished/bankrupt). **턴 방향 화살표**(`pub.direction`로 cw/ccw 표시).
- **중앙**: `top` 카드(`AlloutCard`) + `activeColor` 색칩. `pendingAttack>0`이면 큰 "누적 +X" 배지(`ao-attack`).
- **상태줄**: 내 턴이면 yourTurn, 아니면 turnOf{name}. 힌트: 공격중이면 defend("막거나 {n}장 받기"), 평상시면 lead/follow. 반직관 규칙(누적공격·멀티카드) 상시 노출.
- **손패**(`me.hand`): `AlloutCard` 버튼. 내 턴일 때 **낼 수 있는 카드 글로우 / 못 내는 카드 dim**. 합법성은 클라 헬퍼 `canPlay(card, top, pendingAttack, drawnCardId)`로 미러(서버가 최종 권위). drawnPending이면 그 카드만 활성 + 함께 낼 같은 숫자만 활성.
- **멀티카드 선택**: `selected: string[]`. 첫 카드 선택 후 **호환 카드만 클릭 유지**(같은 value 또는 같은 kind), 비호환 dim. "내기(N장)" 버튼.
- **색 휠 모달**: 선택 카드가 색무관 kind면 play 시 색 휠(공용 `.modal` 구조) 띄워 `chosenColor` 받고 전송. 4색 버튼(토큰색).
- **Exchange 대상**: 선택이 exchange면 대상 선택 모달(본인·완주·파산 제외 좌석) → `exchangeTargetId`.
- **액션 버튼**: 평상시 [내기][뽑기]. 공격중 [내기(방어/얹기)][받기(N장)]. drawnPending이면 [내기][패스]. `myTurn` 아니면 비활성.
- `sendAction(ALLOUT_ACTIONS.play, {cards, chosenColor?, exchangeTargetId?})` / `.draw` / `.pass`.
- `useEffect`로 phase·currentTurn·drawnPending 변화 시 selected 리셋.

- [ ] **Step 1: PlayView 구현 + canPlay 미러 헬퍼**
- [ ] **Step 2: build** → PASS
- [ ] **Step 3: Commit** `git commit -m "feat(allout): play view — turn/direction, multicard, color wheel, defense"`

---

## Task 9: CSS — 카드색 토큰 + .scr--allout cyber 레이아웃 + cozy 오버라이드 + 이펙트

**Files:** Modify `client/src/design/terminal.css`, `client/src/app/app.css`.

- [ ] **Step 1: `terminal.css` `:root`(cyber)에 카드색 토큰** — `--card-red/-yellow/-blue/-green`(네온톤) + `--card-ink`(대비 글자색). `[data-theme="cozy"]`에 동일 토큰 **따뜻한 파스텔**로 오버라이드.
- [ ] **Step 2: `app.css`에 `.scr--allout` cyber 레이아웃** — `height:100svh; display:grid; grid-template-rows:auto 1fr auto`. `.ao-card`(각진 HUD, `data-color`별 `border/box-shadow:var(--card-*)`), `.ao-card--joker`(무지개 그라데이션 테두리+글로우), `.ao-card--exchange`(회오리 글리프), 좌석 `.ao-seat.is-turn`(글로우 펄스 keyframe), 방향 화살표, `.ao-attack` 펄스, 손패 스크롤 행 + 액션 고정. `@media(max-width:560px)` 상단바 1열, `@media(max-width:720px)` height:auto·손패 max-height.
- [ ] **Step 3: `terminal.css` cozy 오버라이드** — `[data-theme="cozy"] .scr--allout`: 카드 둥근 모서리+소프트 3D 그림자, 좌석 원형, 코너/스캔라인 숨김, joker=무지개 파스텔, 손글씨 제목.
- [ ] **Step 4: 이펙트(토큰 기반 keyframes)** — +2/+4 스탬프, shield 막→파쇄, reflect 반사 빔, reverse 화살표 회전, joker 7색 폭발. (CSS 애니메이션 + 상태 클래스 토글; 과하지 않게.)
- [ ] **Step 5: build + 시각 확인 메모** → Commit `git commit -m "feat(allout): card-color tokens, scr--allout cyber+cozy, effects"`

---

## Task 10: roundEnd 뷰 + 투표 모달 + RulesModal + 상태 강조

**Files:** Modify `AlloutGameScreen.tsx`.

- [ ] **Step 1: `RoundEndView`** — upstage HandEndView 동형. 등수표(rank/name/cumulative), host [다음 라운드]/[마치기], else 대기.
- [ ] **Step 2: 투표 모달** — upstage 동형(접속 인원 기준 tally, agree/reject, 투표함).
- [ ] **Step 3: RulesModal 문단 ko·en** — 핵심: 색/숫자 매칭, 멀티카드(같은 숫자/기능), 누적 공격, +2/+4/+7, Shield(같은색)·Reflect(반사+역방향)는 공격받을 때만, Exchange/색변환은 비공격 위, Reverse(짝수/2인 본인차례), 파산, 순위 합산 우승. (p1..p7)
- [ ] **Step 4: 상태 강조** — 손패 1장 `lastCard` 글로우, 파산 임박(handCount≥limit-2) 경고, 탈락 표시.
- [ ] **Step 5: build + commit** `git commit -m "feat(allout): round-end, vote modal, rules, status highlights"`

---

## Task 11: 테마별 썸네일 자산 (선택)

**Files:** Create `client/public/themes/cyber/games/allout.png`, `client/public/themes/cozy/games/allout.png`.

- [ ] **Step 1:** `visual-image-create` 스킬 2회 호출(cyber·cozy). `{GAME_CONCEPT}` = `four overlapping playing cards in red/yellow/blue/green fanned out, one card flying away (emptying a hand)`. §4-G 템플릿(cyber=다크+네온 시안/마젠타, cozy=크림+앰버). 512×512 리사이즈 저장.
- [ ] **Step 2: commit** `git commit -m "feat(allout): cyber/cozy game thumbnails"`

---

## Task 12: 최종 검증

- [ ] **Step 1:** `corepack pnpm -r typecheck` → PASS
- [ ] **Step 2:** `corepack pnpm --filter @oneshot/server test` → PASS
- [ ] **Step 3:** `corepack pnpm --filter @oneshot/client build` → PASS
- [ ] **Step 4: 수동** — dev 서버로 한 판: (cyber·cozy)×(ko·en) 4조합 + `/_states` + 모바일 폭(≤560 상단바 1열·가로 넘침 없음·손패 스크롤/액션 고정). 멀티카드·색휠·공격누적·shield·reflect·exchange·파산·라운드 종료 동작 확인.
- [ ] **Step 5:** 완료 체크리스트(§5) 점검 후 PR.

---

## Self-Review (스펙 대비)

- 80장 구성/2배덱 → Task1·2. 7장 분배/시작 숫자카드 → Task2. 색·숫자 매칭/멀티카드 → Task3. 누적공격/Shield/Reflect/draw/Reverse → Task4. Exchange/색변환/파산/순위합산/N라운드 → Task5. 색지정·교환대상(payload) → Task1·3·8. 투표 취소 → Task6. 견고성(추방/끊김) → Task6. 2테마×2언어/모바일/이펙트/UX(턴·방향·하이라이트·멀티카드 UI) → Task7–10. 썸네일 → Task11. 검증 → Task12.
- 미해결/주의: `drawFromPile` 더미 소진 리셔플 id 충돌(Task4에서 reshuffleSeq로 회피). 테스트 결정성 위한 손패 주입 헬퍼(test-only, Task4). 클라 `canPlay`는 미러일 뿐 서버가 최종 권위.
