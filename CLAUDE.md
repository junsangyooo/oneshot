# OneShot — 프로젝트 개발 가이드

친구들이 한 파티 방에 모여 여러 술/파티 게임을 갈아끼우며 즐기는 **웹 우선 실시간 게임 허브**.
실제 제품 코드는 **`apps/oneshot/`** 안에만 있다. 루트의 다른 폴더/프로토타입은 배포 대상이 아니다.

> 이 문서는 **이 프로젝트의 규칙**이다. 새 화면·게임을 만들 때 반드시 따른다.
> 특히 **"두 테마(cyber·cozy)와 두 언어(ko·en)가 항상 같이 동작해야 한다"** 는 게 핵심 불변식이다.
> QA는 화면 단위 렌더 검사(§5)로 끝나지 않는다 — **§6 유저 여정 QA**를 반드시 함께 돈다.
> (화면 단위 QA만 반복하다 Enter=엉뚱한 버튼, URL≠실제 방, 초대 링크에 풀 홈 노출을 전부 놓친 전적이 있다.)

---

## 1. 실행 / 검증

```bash
# 새 머신: 의존성 설치 + .env 생성 (한 번)
bash apps/oneshot/setup.sh

# 개발 서버 (각각 별 터미널)
corepack pnpm --filter @oneshot/server dev   # http://localhost:2567
corepack pnpm --filter @oneshot/client dev   # http://localhost:5173 (점유 시 5174)

# 검증
corepack pnpm -r typecheck
corepack pnpm -r test                        # shared + client + server 유닛
corepack pnpm --filter @oneshot/client build # 클라이언트는 빌드까지 통과시킨다

# e2e (dev 서버 2개가 떠 있어야 한다) — 파일 단위로 나눠서 돌린다
cd apps/oneshot/e2e && npx playwright test rummikub
```

- pnpm은 `corepack pnpm`으로 호출한다(전역 pnpm 없을 수 있음).
- **pnpm 명령은 `apps/oneshot/` 안에서 실행한다.** workspace 루트가 여기다(리포 루트 아님). 리포 루트에서 돌리면 `vitest: command not found`로 실패한다.
- `.env`는 git-ignored다. `setup.sh`가 `*/.env.example`에서 생성한다.
- **모든 상태/에러 페이지는 `/_states` 라우트에서 한눈에 미리볼 수 있다.**
- **⚠️ e2e 전체를 한 번에 돌리지 마라.** 서버가 방 생성을 **분당 30개**로 제한하는데
  (`createRoomLimiter`, `server/src/index.ts`) 전체 스위트는 그보다 훨씬 많이 만든다 → 관계없는 스펙들이
  로비 대신 `SYS//ERR` 화면을 만나 무더기로 실패한다. env 우회 스위치는 없다.
  **파일 단위로, 사이에 ~70초를 두고** 돌려야 신뢰할 수 있는 신호가 나온다.
- **`e2e/tests/cardux.spec.ts`는 깨끗한 체크아웃에서도 실패한다.** 소스에 없는 `.ao-colorchip`을 기다린다.
  내 변경 탓으로 오해하지 말 것 — 의심되면 `git stash` 후 재현해 baseline과 대조한다.
- 배포·환경변수·아키텍처 개요는 루트 [`README.md`](./README.md)에 있다.

---

## 2. 아키텍처 지도

| 영역 | 위치 |
|---|---|
| 디자인 토큰 + 공용 컴포넌트 CSS | `client/src/design/terminal.css` |
| 화면별 레이아웃 CSS (`.scr--*`) | `client/src/app/app.css` |
| 테마 시스템 | `client/src/theme/index.ts` (`THEMES`, `useTheme`) |
| 다국어 | `client/src/i18n/index.ts` (`useT`, `gameTitle`, `gameTagline`) |
| 아바타 | `client/src/design/avatars.ts` + `public/themes/<theme>/avatars/` |
| 게임 표시 메타 | `client/src/design/games.ts` (`GAME_META`, `GAME_ORDER`, `gameThumb`) |
| **게임 화면 레지스트리** | `client/src/games/registry.tsx` (`GAME_SCREENS`, `GameScreenProps`) — 새 게임 화면은 여기 한 줄만 추가 |
| 공용 React 컴포넌트 | `client/src/ui/terminal.tsx` (`Backdrop`, `AvatarImg`, `GameRail`, `SettingsModal`, `RulesModal`) |
| 전체화면 | `client/src/ui/useFullscreen.ts` (`useAutoFullscreen`, `useFullscreenPref`) — 터치 기기에서만 자동 진입 |
| 스크롤 없는 레이아웃 fit | `client/src/games/rummikub/fit.ts` (`useFitTarget`, `useFitHand/Board/Rail`) — §8 |
| 상태/에러 페이지 | `client/src/ui/states.tsx` (`StateScreen`, `StateKind`) |
| 화면 라우팅 | `client/src/app/App.tsx` (게임 phase면 `GAME_SCREENS`에서 조회해 자동 렌더) |
| 서버 게임 규칙 | `server/src/games/<id>/`, 계약은 `server/src/games/GameModule.ts`, 등록은 `server/src/games/registry.ts` |
| 서버 진입점·보안 | `server/src/index.ts` (helmet·compression·rate-limit·CORS·정적 서빙), env는 `server/src/config/env.ts` |
| 게임 카탈로그 / 타입 | `shared/src/games/catalog.ts` (`gameCatalog`), `shared/src/schema/domain.ts` (`GameId`) |

**테마는 최상위 개념이다.** 토큰은 `terminal.css`의 `:root`(= **CYBER** 기본) 와
`[data-theme="cozy"]` 블록(= **COZY** 오버라이드)으로 정의된다. `<html data-theme="...">` 한 줄로 전체가 바뀐다.

---

## 3. ⚠️ 테마·다국어 핵심 규칙 (모든 UI 코드에 적용)

1. **색·폰트·간격·라운드를 하드코딩하지 않는다.** 항상 토큰을 쓴다.
   - `color: var(--ink)` / `var(--ink-dim)` / `var(--accent)` / `var(--cyan)` / `var(--warn)` / `var(--gold)`
   - `border-color: var(--line)` / `var(--line-bright)`
   - `font-family: var(--font-display)` (제목) / `var(--font-mono)` (본문) / `var(--font-ko)`
   - 간격은 `var(--frame-pad)`, 트래킹은 `var(--track-mid)` 등.
   - ❌ `color: #ff8b8b` / `#1a1a1a` 같은 리터럴 금지. (테마 바꿔도 안 변함)

2. **화면 레이아웃은 고유 루트 클래스 `.scr--<name>` 로 스코프한다.** 화면은 한 번에 하나만 마운트되므로
   `.shell`, `.topbar` 같은 이름을 화면마다 다르게 쓰면 충돌한다 → 반드시 `.scr--foo .xxx` 식으로 감싼다.
   공용 원자 컴포넌트(`.btn`, `.field`, `.glyph`, `.modal`, `.readout`, `.corner`, `.fx`)는 **그대로 재사용**한다.

3. **cyber↔cozy 구조 차이는 `[data-theme="cozy"]` 오버라이드로 처리한다.**
   - 기본(`:root`/`app.css`) = **cyber**(다크 HUD: 코너·스캔라인·텔레메트리·각진 테두리).
   - cozy는 보통: 텔레메트리/코너/스캔라인 숨김, 둥근 모서리 + 소프트 3D 그림자, 손글씨 제목, 원형 아바타.
   - 새 화면을 만들면 **반드시 cyber·cozy 둘 다 스크린샷으로 확인**한다. cyber만 보고 끝내면 cozy가 깨진다.

4. **사용자 노출 텍스트를 JSX/마크업에 하드코딩하지 않는다.** `i18n/index.ts`의 `ko`/`en` dict에 키를 추가하고
   `const t = useT(); t("my.key")` 로 쓴다. 게임 이름·태그라인은 `gameTitle(lang,id,fallback)` / `gameTagline(lang,id)`.
   - 단, **HUD "시스템" 영문 플레이버**(예: `SECTOR_ACCESS_CODE`, `BR-K/S/61X-081`)는 의도적으로 영어 고정이라 번역하지 않는다.

5. **플레이어 아이콘은 `<AvatarImg avatarKey={p.avatarKey} themeId={p.themeId} />` 로 그린다.**
   각 플레이어는 자기 테마로 렌더된다(내 테마 ≠ 남의 테마 가능). 직접 `<img>` 하드코딩 금지.

6. **에러/상태 화면은 새로 만들지 말고 `states.tsx`를 쓴다.** 새 상태가 필요하면 `StateKind`에 추가하고
   `PRESETS`에 한 항목(아이콘/색/i18n 키/액션)만 넣는다. 자동으로 두 테마·`/_states`에 반영된다.

7. **게임은 테마 위에 "얹는다".** 테마는 배경·셸·디자인 토큰을 제공하고, 게임은 그 위에서 토큰만 써서 그린다.
   → **게임을 테마별로 두 번 만들지 않는다.** 한 번 만들고 토큰/오버라이드로 두 테마가 따라오게 한다.

8. **모달은 공용 `.modal`만 쓴다(직접 만들지 않는다).** `terminal.css`의 `.modal`은 `max-height: 92svh` + 본문(`.modal-body`)만 스크롤 + 머리/꼬리(`.modal-head`/`.modal-foot`) 고정이 내장돼 있다. 직접 모달을 짜면 **모바일에서 내용이 길 때 저장/확인 버튼이 화면 밖으로 나간다**(실제로 설정 모달에서 터졌던 버그). 게임 도움말은 `RulesModal`, 그 외엔 `.modal-backdrop > .modal > (.modal-head/.modal-body/.modal-foot)` 구조를 그대로 쓴다.

9. **모바일/태블릿도 완료 기준이다.** 데스크톱만 보고 끝내지 않는다.
   - 화면 루트는 `100svh`(주소창 대응). 게임 화면은 `≤720px`에서 `height:auto; overflow:visible`로 풀어 페이지 스크롤을 허용한다.
   - **게임 상단바(`grid-template-columns: 1fr auto 1fr`)는 `≤560px`에서 1열로 접는다**(미디어쿼리). 안 접으면 좌우 컬럼이 콘텐츠보다 좁아져 가로로 넘친다.
   - **터치 타깃 ≥ 44px**(버튼·토글·`lang-dot`·스텝퍼 등). 9px 같은 초소형 글자 지양.
   - **스코프된 툴바 안에 `position:fixed` 요소를 넣지 않는다.** 부모 밖으로 튀어나가 다른 버튼과 겹친다(예전 `LangToggle` 오버랩). 언어 전환은 `SettingsModal`로 통일.
   - **길게 늘어나는 영역(손패 등)은 그 영역만 스크롤시키고 1차 액션 버튼은 고정**한다. 손패를 그냥 흘려보내면 Play/Pass가 화면 밖으로 밀린다(§4-D 패턴 참고).
   - **보조 트리거(설정 등)는 긴 라벨 대신 통용 아이콘 하나**로 둔다(설정=톱니바퀴). 라벨은 `aria-label`/`title`로 남기고
     버튼은 44px 이상. 라벨 텍스트에 의존하면 언어·테마마다 폭이 달라져 레이아웃이 흔들린다.

10. **게임마다 인게임 `?` 도움말(`RulesModal`)을 단다.** 처음 보는 사람이 룰을 모른다 — 온보딩은 "완료"의 일부다. 상단바에 `?` 버튼 + `RulesModal`을 두고, 룰 문단을 `i18n`(ko·en)으로 채운다. 핵심 반(反)직관 규칙(예: "낮은 숫자가 강함")은 도움말뿐 아니라 플레이 화면 힌트에도 상시 노출한다.

11. **⚠️ 테마는 "겉"만 바꾼다 — 기능은 두 테마가 항상 동일하다.** 디자인·이팩트·배치는 달라도 되지만
    **기능·정보·인터랙션은 완전히 같아야 한다.** 실제로 cozy에서 홈 게임 라이브러리 전체가 `display:none`이라
    "cozy 유저는 어떤 게임이 있는지 볼 수조차 없는" 상태로 배포된 적이 있다.
    - ❌ **한 테마에서 기능 블록을 통째로 `display: none` 하지 않는다.** cozy 오버라이드에서 `display:none`은
      **순수 장식**(스캔라인·코너·텔레메트리·글리치)에만 허용된다. 정보·버튼·목록에 쓰면 그건 기능 삭제다.
    - 레이아웃이 안 맞으면 **숨기지 말고 옮긴다** — 위치·크기·스타일을 바꿔 그 테마에 맞게 다시 배치한다.
    - 반대 방향도 같다: 한 테마에만 있는 버튼/정보를 새로 만들지 않는다. 새 기능은 **양쪽 테마에 동시에** 들어간다.
    - 테마별로 달라도 되는 것: 색·폰트·라운드·그림자·애니메이션 종류(cyber=글리치/스캔라인, cozy=퐁 튀는 스프링)·아이콘 모양.
    - 셀프 체크: `grep -n 'display: *none' client/src/design/terminal.css` → cozy 블록의 각 히트가
      **장식인지 기능인지** 하나씩 확인한다.
    - **블록 단위로 숨기지 말고 행/라벨 단위로 갈라낸다.** 실제로 6개 게임이 cozy에서 상단 `.readout`을
      통째로 숨겼는데, 그 안에 **방 코드와 게임 정보(라이어 수·덱 구성)** 가 같이 들어 있었다.
      장식 플레이버 행만 숨기고 정보 행은 남긴다. HUD 라벨(`SECTOR_ID:` 등)은 `.readout__lbl`로
      감싸져 있어 cozy가 라벨만 숨기고 값(`#CODE`)은 보여준다 — 새 readout도 이 구조를 따른다.

12. **"눌릴 것처럼 생긴 건 실제로 눌려야 한다"(죽은 UI 금지).** 목록·카드·토글이 선택 가능해 보이면 실제 상태를 가져야 한다.
    - **기본 선택을 하드코딩하지 않는다.** `i === 0 ? "is-active" : ""` 같은 장식용 활성 표시는 금지 —
      "하나가 켜져 있는데 나머지는 눌러도 반응 없음"이 가장 나쁜 경험이다. 상태가 없으면 **아무것도 선택하지 않은 상태**로 시작한다.
    - 선택 가능한 행은 `<div>`가 아니라 `<button>`으로 만들고 `aria-expanded`/`aria-pressed`를 준다.
    - 펼침 패널은 오버레이가 아니라 **흐름(in-flow)** 에 넣어 아래 항목이 밀리게 한다(모바일에서 잘리지 않는다).

13. **장식은 클릭을 먹지 않는다 — `pointer-events: none` 필수.** `Backdrop`의 코너 브래킷·스캔라인·비네트·글로우처럼
    `position: fixed/absolute`로 화면 위에 덮이는 요소는 **전부** `pointer-events: none`이어야 한다.
    실제로 `.corner`에 이게 빠져 있어 **네 모서리 42×42 영역이 모든 화면에서 클릭을 삼켰고**, 그 자리에 놓인
    타일 게임의 덱 버튼이 아예 안 눌렸다.
    - 화면 **모서리·가장자리에 1차 액션**(뽑기·확인·나가기)을 두면 반드시 **실제로 눌리는지** 확인한다.
    - 증상: Playwright 클릭 로그에 `<span class="corner…"> intercepts pointer events`. 눈으로는 절대 안 보인다.
    - 셀프 체크: `grep -n 'position: *fixed' client/src/design/terminal.css` → 각 히트에 `pointer-events: none`이 있는지.

14. **기기 게이트(회전 안내 등)에는 반드시 탈출구를 둔다.** `(orientation: portrait)` 하나만 보고 화면을 덮으면
    **세로로 긴 데스크톱 창이 통째로 잠긴다** — 데스크톱 유저는 회전할 방법이 없다(실제로 타일에서 터졌다).
    - 조건은 `(orientation: portrait) and (pointer: coarse) and (max-width: …)` 처럼 **터치 + 폭**을 함께 건다.
    - 그리고 **"그대로 계속하기"를 항상 제공**한다. 어떤 게이트도 유저를 막다른 길에 두지 않는다.

15. **완료 기준 = 2 테마 × 2 언어 = 4 조합 + `/_states` + 모바일 폭.** 설정에서 테마/언어를 바꿔가며 확인하고, 창을 좁혀(또는 실기기) 모바일도 확인한다.

**4조합 스크린샷 QA 레시피(검증된 방법).** Chrome 자동화는 localhost에 못 닿고 창 리사이즈도 먹지 않는다 →
`apps/oneshot/e2e/`(Playwright가 설치된 곳)에서 임시 스크립트로 돌린다. 테마/언어는 **평문 localStorage 키**다:

```js
// apps/oneshot/e2e/_shot.mjs  — 확인 후 반드시 삭제한다(리포에 남기지 않음)
import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const theme of ["cyber", "cozy"]) for (const lang of ["ko", "en"]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([t, l]) => {
    localStorage.setItem("oneshot.theme", t);   // 평문: "cyber" | "cozy"
    localStorage.setItem("oneshot.lang", l);    // 평문: "ko" | "en"
  }, [theme, lang]);
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:5173/");
  // 렌더만 보지 말고 기능 동등성을 수치로 뽑는다: 두 테마의 숫자가 같아야 한다
  console.log(theme, lang, await p.locator(".scr--home .game-row").count(),
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));  // 가로 넘침
  await p.screenshot({ path: `/tmp/home-${theme}-${lang}.png` });
  await ctx.close();
}
await b.close();
```

> dev 서버가 5173을 못 잡고 5174/5175로 올라갈 수 있으니 **실제 출력된 포트**를 쓴다.
> 스크린샷만 보지 말고 **요소 개수·`is-active` 개수·가로 넘침을 두 테마에서 비교**한다 — 그래야 "cozy에서 안 보임"류를 잡는다.

---

## 4. 새 게임 추가 — 완전 레시피 (자동 실행용)

> **새 세션에서 "○○게임 추가해줘" 요청을 받으면 이 절차를 처음부터 끝까지 따른다.**
> (0)에서 스펙을 먼저 확정하고, (A)~(E) 파일을 빠짐없이 채우고, (F) 보안을 검증하고, (G)로 자산을 만든다.
> 빠짐없이 하면 typecheck/test 통과 + 2 테마 × 2 언어 동작까지 완성된다. 모호하면 추측하지 말고 (0)에서 질문한다.

### (0) 먼저 확정할 게임 스펙 (코딩 전)

아래를 모두 정한다. 사용자가 안 준 항목은 **합리적 기본값을 제안하고 컨펌받은 뒤** 진행한다.

| 항목 | 설명 | 들어가는 곳 |
|---|---|---|
| `id` | kebab-case 식별자 (예: `"liar"`) | `domain.ts` `GameId`, 전체 |
| 이름 ko / en | 표시 이름 | i18n `game.<id>` (ko·en) + catalog `title`(ko fallback) |
| 태그라인 ko / en | 한 줄 설명 | i18n `gametag.<id>` (ko·en) |
| `glyph` | 유니코드 1자 아이콘 (예: `♔`) | `GAME_META` |
| `accent` | `"red"｜"cyan"｜"gold"｜"gray"` | `GAME_META` |
| `minPlayers` / `maxPlayers` | 인원(무제한이면 `null`) | catalog (+ `GAME_META` min/max는 홈 fallback) |
| `complexity` | `1｜2｜3` | catalog |
| `supportsJoinInProgress` | 진행 중 입장 허용? | catalog |
| `defaultOptions` | 게임 옵션 기본값(없으면 `{}`) | catalog (+ 필요 시 shared 타입) |
| `status` | `"available"｜"coming_soon"` | catalog. **`available`일 때만 홈/로비에 노출** |
| 썸네일(선택) | 테마별 1장씩 | (G) 참고 |
| 규칙 설계 | phase / 액션 / 비밀정보 / 종료조건 | 서버 모듈 (B) |

### (A) 공유 타입 / 카탈로그
1. `shared/src/schema/domain.ts` — `GameId` 유니온에 `"foo"` 추가.
2. `shared/src/games/catalog.ts` — 카탈로그 항목 추가:
   `{ id: "foo", title: "푸게임", minPlayers, maxPlayers, complexity: 1|2|3, supportsJoinInProgress, defaultOptions, status: "available" | "coming_soon" }`
   - `status`가 `"available"`일 때만 홈/로비 게임 목록에 노출된다(`coming_soon`은 자동 숨김). 출시 준비가 되면 이 값만 바꾼다.
2b. (게임 전용 공유 타입 파일을 만들었다면) `shared/src/index.ts`에 `export * from "./games/foo";` 추가.

### (B) 서버 게임 규칙 (권위 서버)
3. `server/src/games/foo/FooModule.ts` — `GameModule<TOptions, TPublicState, TPrivateState>` 구현. 실제 계약(`GameModule.ts`):
```ts
interface GameModule<TOptions, TPublicState, TPrivateState> {
  readonly id: GameId;
  readonly minPlayers: number;
  start(input: { players: PublicPlayerState[]; options: TOptions; randomSeed: string }): void;
  handleAction(input: { playerId: string; action: GameAction; isHost: boolean }): ActionResult;
  getPublicState(): TPublicState;          // 전원 브로드캐스트 — 비밀 절대 금지
  getStateFor(playerId: string): TPrivateState;  // 그 플레이어에게만
  onPlayerLeave(playerId: string): void;   // 임시 끊김(재접속 가능) — 보통 no-op
  onPlayerReturn(playerId: string): void;  // 복귀
  onPlayerRemoved(playerId: string): void; // 영구 추방 — 상태에서 깔끔히 제거
  isOver(): GameResult | null;
}
```
   - 규칙·검증·랜덤은 **서버만**. 랜덤은 주입된 seed 기반 `Randomizer`만 쓴다(테스트 재현성).
   - 비밀정보는 `getStateFor(playerId)`로만. `getPublicState()`에 역할/패/정답/진행 중 미션을 넣지 않는다.
   - 호스트 전용 액션은 `isHost`로, 턴 전용은 `playerId`로 게이팅한다(`isHost`는 임시 방장도 반영됨).
   - 재사용 가능한 공통 모듈: `SecretDealer`(비밀 배정), `Randomizer`(seed 랜덤) 등 — `server/src/games/`·`core` 참고.

   **⚠️ 생명주기·끊김·추방 견고성 (게임이 멈추는 버그가 여기서 난다 — 실제로 다 터졌던 것들):**
   - **추방(`onPlayerRemoved`)이 phase 전이를 막으면 안 된다.** 어떤 phase가 **특정 액션으로만** 다음으로 넘어간다면(예: `tax`는 `taxReturn`으로만, `declare`는 `declare`로만), **그 액션의 주체를 추방했을 때 진행 조건을 재확인**해 다음 phase로 넘겨야 한다. 안 하면 아무도 행동할 수 없어 **영구 정지**한다. (정지 탈출 로직을 헬퍼로 빼고 정상 경로·추방 경로 둘 다 거기로 보낸다.)
   - **phase 임계 매핑은 "설정하는 순간" 스냅샷한다.** 받는이↔주는이 짝, 타깃, 턴 순서 같은 걸 나중에 **가변 상태(`this.order` 등)에서 재계산하지 마라** — 추방이 그 상태를 바꿔 매핑이 깨진다(엉뚱한 사람에게 반환되거나 상대를 못 찾아 정지). 짝을 만들 때 배열로 박아두고 그 스냅샷만 읽는다.
   - **유령 참조를 남기지 않는다.** 추방된 플레이어를 가리키는 `leadId`/`currentPlay`/현재턴/타깃이 `getPublicState()`에 남지 않게 정리한다(§4-F 체크).
   - **투표·정족수는 "접속 인원" 기준**으로 센다. 임시 끊김 플레이어는 좌석엔 남지만 **투표를 못 한다** → 전체 좌석 기준으로 과반을 따지면 **한 명만 끊겨도 영원히 안 닫혀 데드락**한다. `onPlayerLeave`/`onPlayerReturn`에서 `disconnected` 집합을 추적하고, 분모를 접속 인원으로 잡는다. (`onPlayerLeave`는 보통 no-op이지만, 투표 같은 정족수 로직이 있으면 끊김을 반영해야 한다.)
4. `server/src/games/registry.ts` — 모듈 등록(Map에 `["foo", () => new FooModule()]` + import).
5. `server/tests/`에 봇 테스트 추가(2~10명이 한 판을 끝까지 도는지). **추방/재접속 엣지를 반드시 포함**한다: phase 도중(특히 액션 대기 phase) 주체 추방 → 정지하지 않고 진행하는지, 끊김 중 투표가 데드락하지 않는지 회귀 테스트로 박는다.

### (C) 클라이언트 표시 메타 + 다국어
6. `client/src/design/games.ts` — `GAME_META`에 `foo: { glyph, accent, min, max }` + `GAME_ORDER`에 추가.
7. `client/src/i18n/index.ts` — `ko`·`en` 둘 다에 `game.foo`, `gametag.foo` 추가.

### (D) 게임 화면 (테마-세이프)
8. `client/src/games/foo/FooGameScreen.tsx`:
```tsx
import { useT } from "../../i18n";
import { Backdrop, AvatarImg } from "../../ui/terminal";
import type { GameScreenProps } from "../registry";

export const FooGameScreen = ({
  roomState,
  privateState,
  currentPlayerId,
}: GameScreenProps) => {
  const t = useT();
  const players = Object.values(roomState.players).sort((a, b) => a.seatIndex - b.seatIndex);
  return (
    <main className="scr scr--foo">
      <Backdrop />
      {/* 텍스트는 t(), 색/폰트는 토큰, 플레이어는 AvatarImg */}
      <header className="topbar">{/* ... */}</header>
      <section className="foo-board">
        {players.map((p) => (
          <div className="foo-player" key={p.id}>
            <AvatarImg avatarKey={p.avatarKey} themeId={p.themeId} />
            <span>{p.nickname}</span>
          </div>
        ))}
      </section>
    </main>
  );
};
```
9. `client/src/app/app.css` — **CYBER(기본)** 레이아웃을 `.scr--foo` 스코프로:
```css
.scr--foo { height: 100svh; padding: var(--frame-pad); display: grid; grid-template-rows: auto 1fr auto; }
.scr--foo .foo-board { border: 1px solid var(--line); color: var(--ink); }
```
10. `client/src/design/terminal.css` — **COZY 오버라이드**를 cozy 블록 안에 추가:
```css
[data-theme="cozy"] .scr--foo .foo-board { border-radius: 18px; box-shadow: 0 6px 0 rgb(0 0 0 / 0.04); }
```
11. `client/src/games/registry.tsx` — `GAME_SCREENS` 맵에 한 줄 추가. (App.tsx는 이 맵을 보고 자동 렌더하므로 라우팅 분기를 직접 손대지 않는다.)
```tsx
export const GAME_SCREENS: Partial<Record<GameId, ComponentType<GameScreenProps>>> = {
  kinggame: KingGameScreen,
  foo: FooGameScreen, // ← import 후 한 줄 추가
};
```

**도움말(`?`) 모달 — 게임마다 필수(§3-10).** 상단바에 `?` 버튼 + `RulesModal`을 단다. 룰 문단은 i18n(ko·en)에 `foo.rules.title`·`foo.rules.p1..pN` + 공용 `rules.help`/`rules.close`로.
```tsx
import { Backdrop, AvatarImg, SettingsModal, RulesModal } from "../../ui/terminal";
const [rulesOpen, setRulesOpen] = useState(false);
// 상단바 툴바:  <button className="btn btn--sm" aria-label={t("rules.help")} onClick={() => setRulesOpen(true)}><span>?</span></button>
<RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)}
  title={t("foo.rules.title")} paragraphs={[t("foo.rules.p1"), t("foo.rules.p2")]} />
```

**모바일-세이프 플레이 레이아웃(§3-9).** 손패처럼 길어지는 영역을 스크롤 행으로 두고 1차 액션을 고정한다. 안 그러면 카드가 많을 때 Play/Pass가 화면 밖으로 밀린다.
```css
/* 손패가 늘어나도 버튼이 안 밀리게: 손패만 스크롤, 액션은 마지막 고정 행 */
.scr--foo .foo-play { display: grid; grid-template-rows: auto auto 1fr auto; height: 100%; min-height: 0; }
.scr--foo .foo-play .foo-hand { min-height: 0; overflow-y: auto; align-content: start; }
@media (max-width: 720px) { .scr--foo .foo-play { height: auto; } .scr--foo .foo-play .foo-hand { max-height: 38vh; } }
@media (max-width: 560px) { /* 상단바 1열 접기 */
  .scr--foo .topbar { grid-template-columns: 1fr; gap: 10px; justify-items: center; }
}
```

### (F) 보안·권위 서버 체크리스트 (필수 — 매 게임 검증)

- [ ] 규칙·검증·승패·랜덤이 **서버 모듈에만** 있다. 클라이언트는 UI/입력만.
- [ ] 비밀정보(역할/패/정답/진행 중 미션)는 `getStateFor()`로만. `getPublicState()`에 새지 않는다.
- [ ] 모든 액션 `payload`를 서버에서 **parse + 검증**(타입·범위·소유권). 클라가 보낸 값을 신뢰하지 않는다.
- [ ] 권한 게이팅: 호스트 전용은 `isHost`, 턴 전용은 `playerId === 현재 턴` 확인.
- [ ] `onPlayerRemoved`에서 추방된 플레이어의 흔적(번호·좌석·타깃·`leadId`·`currentPlay`)이 public state에 **유령으로 남지 않는다**.
- [ ] **액션 대기 phase(tax/declare/투표 등)에서 그 주체를 추방해도 게임이 정지하지 않는다** — 진행 조건을 재확인해 다음 phase로 넘긴다(§4-B 견고성).
- [ ] phase 임계 매핑(교환 짝·턴 순서 등)은 **가변 상태에서 재계산하지 않고 스냅샷**을 읽는다.
- [ ] 투표·정족수는 **접속 인원** 기준이다(끊김 추적). 한 명 끊겨도 데드락하지 않는다.
- [ ] 새 HTTP 엔드포인트를 추가했다면 rate-limit를 검토한다(`server/src/index.ts`의 `createRoomLimiter` 패턴). 게임 액션은 HTTP가 아니라 WS로.
- [ ] 사용자 입력 텍스트(커스텀 콘텐츠 등)는 길이 제한을 두고, 콘텐츠 정책은 UX로 안내한다.

### (G) 테마별 자산(썸네일) — 규격 + 생성 프롬프트

게임 썸네일은 **선택**이다(현재 로비는 `GAME_META.glyph` 아이콘을 쓴다). 쓰려면 두 테마 모두 만든다.

- **경로**: `client/public/themes/cyber/games/<id>.png` · `client/public/themes/cozy/games/<id>.png`
- **규격**: **512×512 PNG, 풀블리드 정사각**(투명 아님), 중앙 단순·고대비 실루엣(32px로 줄여도 식별). 헬퍼 `gameThumb(id, theme)`가 경로를 만든다.
- **생성**: `visual-image-create` 스킬을 **게임당 2회**(테마별) 호출. 아래 템플릿의 `{GAME_CONCEPT}`만 그 게임을 상징하는 오브젝트로 바꾼다. **두 장은 같은 피사체·같은 구도로, 스타일만 다르게**(favicon에서 검증된 톤). 생성 후 512×512로 리사이즈해 위 경로에 저장.

`{GAME_CONCEPT}` 예: 왕게임=`a crown`, 라이어=`a theatrical mask`, 사칙연산=`plus minus multiply divide symbols`.

**CYBER 프롬프트**
```
A single square game thumbnail icon, 1024x1024, full-bleed background (not transparent), no text.
Subject: {GAME_CONCEPT}. CYBERPUNK style: dark near-black deep-purple background (#0a0710),
glowing neon cyan and magenta rim light, angular HUD/glitch accents, sharp electric edges.
Bold simple high-contrast centered silhouette that stays recognizable at 32px. Flat iconographic vector app-icon style.
```

**COZY 프롬프트**
```
A single square game thumbnail icon, 1024x1024, full-bleed background (not transparent), no text.
Subject: {GAME_CONCEPT}. COZY style: warm cream/beige background, soft amber and orange tones,
rounded hand-drawn storybook texture, gentle warm shadow.
Bold simple high-contrast centered silhouette that stays recognizable at 32px. Flat iconographic vector app-icon style.
```

> 같은 톤 규칙이 favicon/OG에도 적용된다: **cyber = 다크+네온 시안/마젠타+HUD, cozy = 크림+앰버+손그림**. 새 브랜드 이미지를 만들 땐 이 대비를 유지한다.

### (E) 검증
12. `corepack pnpm -r typecheck` + 서버 테스트 (`apps/oneshot` 안에서). 클라이언트는 `pnpm --filter @oneshot/client build`로 빌드까지 통과시킨다.
13. 실제로 한 판 돌려 **cyber·cozy × ko·en** 4조합 + `/_states` + **모바일 폭**(창 좁히기/실기기)을 확인한다. 깨지는 곳은 §3 규칙 위반이다.

**로컬 멀티플레이(3인) 테스트 요령** — 한 브라우저 프로필에서도 3명을 앉힐 수 있다(이전 "불가" 추정은 틀렸다):
- 식별은 `localStorage`의 `oneshot.reconnectToken` 하나로 결정된다. 앱은 부팅 시 그 토큰으로 자동 `reconnect()`하므로, 새 탭이 같은 토큰을 읽으면 **같은 플레이어로 합류**해버린다.
- 따라서 **각 탭에서 join 직전에 `localStorage.removeItem('oneshot.reconnectToken')` 후 새로 Create/Join** 하면 별도 플레이어로 착석한다. 호스트 생성 → (호스트 탭에서 토큰 제거) → 탭2 Join → (토큰 제거) → 탭3 Join 순.
- `createRoom`/`joinByCode`는 토큰을 보내지 않고 새 좌석을 만든다(토큰은 새로고침 시 `reconnect()`에만 쓰임). 라이브 소켓은 토큰을 지워도 안 끊긴다.
- 브라우저 자동화 셸은 **샌드박스라 localhost(:2567/:5173)에 닿지 못한다**(curl/lsof 헛돎). dev 서버는 sandbox 해제로 띄우고, 죽으면 matchmake가 503 → 앱 버그가 아니라 서버 다운임을 먼저 의심한다. Chrome 최소 창폭이 ~500px라 360px는 OS 창으로는 안 되지만 `window.innerWidth`/미디어쿼리는 500px에서 ≤560 분기를 모두 발동하므로 `document.documentElement.scrollWidth > innerWidth`(가로 넘침)로 검증할 수 있다.

---

## 5. 완료 체크리스트 (PR 전)

- [ ] 색/폰트/간격을 토큰으로만 썼는가? (하드코딩 hex/px 없음)
- [ ] 레이아웃을 `.scr--<name>`로 스코프했는가?
- [ ] **cozy 오버라이드**를 넣고 cozy에서 직접 확인했는가?
- [ ] **테마 기능 동등성**: 두 테마에 같은 기능·정보·인터랙션이 다 있는가? cozy에서 `display:none`으로 **기능 블록을 숨기지** 않았는가(장식만 허용)? (§3-11)
- [ ] **죽은 UI 없음**: 선택 가능해 보이는 요소가 실제로 눌리는가? 기본 선택을 하드코딩(`i===0`)하지 않았는가? (§3-12)
- [ ] 사용자 텍스트가 i18n(ko·en) 양쪽에 있는가?
- [ ] 플레이어 아이콘에 `AvatarImg`(themeId 전달)를 썼는가?
- [ ] 새 에러/상태가 필요하면 `states.tsx`에 kind로 추가했는가? 모달은 공용 `.modal`/`RulesModal`을 썼는가(직접 모달 X)?
- [ ] **인게임 `?` 도움말(`RulesModal`)을 달고 룰을 ko·en으로 채웠는가?** (§3-10)
- [ ] **모바일 확인**: 상단바 `≤560px` 1열 접힘 · 가로 넘침 없음 · 터치 타깃 44px · 긴 영역만 스크롤하고 액션 버튼 고정?
- [ ] **장식이 클릭을 안 먹는가**: 새로 덮은 오버레이에 `pointer-events: none`? 화면 모서리·가장자리의 1차 액션이 실제로 눌리는가? (§3-13)
- [ ] **기기 게이트에 탈출구**: 화면을 덮는 안내(회전 등)가 터치+폭 조건까지 보고, "계속하기"가 있는가? (§3-14)
- [ ] **게임 화면이면 §8**: 어느 영역도 스크롤하지 않는가(`overflow` 전수 확인) · 늦게 마운트되는 노드에 `useRef`+`useLayoutEffect` 조합을 쓰지 않았는가 · 플로팅 스택이 인셋 폭 안에 들어가고 1차 버튼이 `elementFromPoint`로 도달 가능한가 · **8인 × 568×320**에서 확인했는가?
- [ ] **드래그·홀드가 있으면 §7**: 드롭 실패 시 원위치 · `pointercancel`/Esc 취소 · 탭 대체 경로 · 비활성 버튼이 이유를 말하는가? 제스처를 **시간 수열로 계측**해 e2e에 박았는가?
- [ ] 게임 규칙/검증/비밀정보가 서버에만 있는가? (§4-F 보안 체크리스트 통과?)
- [ ] **추방/끊김 견고성**: 액션 대기 phase에서 주체 추방 시 정지 안 함 · 유령 참조 없음 · 투표는 접속 인원 기준? 회귀 테스트 추가했는가? (§4-B)
- [ ] 게임 화면을 `GAME_SCREENS`(registry.tsx)에 등록했는가? (App.tsx 직접 분기 X)
- [ ] `coming_soon`/`available` status를 의도대로 설정했는가? (available만 노출)
- [ ] typecheck + 서버 테스트 + **클라이언트 빌드** 통과?
- [ ] **2 테마 × 2 언어 + `/_states` + 모바일 폭** 확인?

---

## 6. 유저 여정 QA (화면 단위 검사와 별개 — 필수)

> §5는 "이 화면이 잘 그려지는가"다. §6은 **"진짜 유저가 처음부터 끝까지 흘러가는가"**다.
> 실제로 §5만 반복하다 놓친 버그들: Enter가 코드를 입력했는데도 방 생성을 누름 ·
> 남의 초대 링크 위에서 방을 만들면 URL이 옛 방을 가리킴 · 코드 복사 버튼이 링크를 복사함 ·
> 초대 링크로 온 사람에게 "방 만들기"가 보임. 전부 화면 사이(키보드·URL·클립보드·진입 경로)에 있었다.

**여정을 바꾸는 변경(홈·조인·로비·라우팅·공유·게임 진입/이탈)이면 아래를 전부 돈다:**

- [ ] **진입 경로별 첫 화면**: 직접 URL(`/`) · 초대 링크(`/r/CODE`) · QR · 잘못된 코드 — 각각 그 맥락에 맞는 화면인가? 초대받은 사람에게 생성 UI가 보이면 안 된다.
- [ ] **키보드-온리 패스**: 모든 폼에서 Enter가 **사용자 의도대로의** 버튼을 누르는가? (코드가 채워져 있으면 참여, 아니면 생성) 탭 순서가 자연스러운가?
- [ ] **URL 불변식**: 주소창 == 실제로 앉아 있는 방. 방 생성/참여/이동 후 `page.url()`을 방 코드와 대조한다. 새로고침·주소 공유가 항상 "지금 그 방"으로 이어져야 한다.
- [ ] **클립보드 불변식**: 복사 버튼은 **라벨 그대로**를 복사한다(코드 버튼=코드, 링크 버튼=URL). e2e에서 `navigator.clipboard.readText()`로 실제 내용을 검증한다.
- [ ] **중간 이탈/복귀**: 게임 중 새로고침(reconnect) · 뒤로가기 · 방장 나감 · 추방당한 사람의 URL — 각각 유령 상태 없이 합리적인 화면에 떨어지는가?
- [ ] **처음 보는 사람 시점**: 지금 화면에서 "다음에 뭘 해야 하는지"가 안내 없이 보이는가? 죽은 선택지(눌러도 의미 없는 버튼)가 없는가?

**작성 규칙:**
- 여정 e2e는 버튼 클릭 헬퍼만 재사용하지 말고 **Enter 경로·URL 대조·클립보드 읽기**를 섞는다. 같은 헬퍼만 돌리면 사각지대가 모든 스펙에 복제된다.
- 여정 버그를 고치면 그 여정을 **e2e로 박제**한다(`e2e/tests/home-enter.spec.ts`, `lobby-copy.spec.ts`가 선례).

---

## 7. 직접 조작(드래그·홀드) 게임 — 공통 규칙

> 타일(Rummikub)이 첫 사례다. 손패를 끌어다 놓는 카드 게임은 전부 이걸 물려받는다.
> 아래는 전부 **실제로 터졌던 것**이고, 화면 렌더 QA(§5)로는 하나도 안 잡혔다.

### 7-1. 드래그는 "취소"가 있어야 완성이다

- **드롭에 실패하면 원래 자리로 되돌아간다.** 드롭존 밖에서 손을 떼거나 불법 이동이면
  타일이 **출발 지점으로 날아가 복귀**(스냅백)해야 한다. 조용히 사라지거나 엉뚱한 데 남으면 유저는 잃어버린 줄 안다.
- **Esc 와 `pointercancel` 도 같은 취소 경로**를 탄다. 특히 모바일에서 브라우저가 스크롤을 가져가면
  `pointerup` 없이 `pointercancel`만 오므로, 이걸 안 다루면 드래그가 허공에 멈춘 채 남는다.
- **드래그 중에 어디로 갈지 보여준다.** 놓을 수 있는 곳은 강조, 불가능한 곳은 거부 표시.
  출발한 자리에는 **반투명 자국**을 남겨 "옮기는 중"임이 읽히게 한다.
- 취소 경로에서 **예약된 타이머를 반드시 정리**한다. 안 그러면 제스처가 끝난 뒤에 타이머가 늦게 발동해 선택이 되살아난다.

### 7-2. 타이밍 제스처(홀드·롱프레스)의 3원칙

1. **즉시 반응한다.** 누르는 순간 눌린 대상이 시각적으로 변해야 한다. 임계 시간까지 무반응이면
   유저는 **"안 눌렸다"** 고 판단하고 손을 뗀다 — 기능이 멀쩡해도 없는 것과 같다.
2. **떼는 경로가 타이머 발동 여부를 알아야 한다.** 롱프레스가 이미 선택을 했는데 `pointerup`이
   그걸 모르고 "탭"으로 처리하면 **방금 한 선택을 되돌린다.** (실제 버그: 세트가 잡혔다가 누른 한 장만 빠져
   항상 한 장 모자란 상태로 끝났다.) `autoSelected` 같은 플래그를 press 상태에 달고 릴리즈에서 분기한다.
3. **누적형이면 유저가 양을 고르게 한다.** 한 번에 다 집지 말고 시간에 따라 하나씩 늘리고,
   **드래그가 시작되면 그 시점에서 동결**한다. 그래야 "3을 잡고 5까지 들렸을 때 끌면 6은 안 온다"가 성립한다.
   (타일: 첫 스텝 750ms, 이후 250ms — `GRAB_FIRST_MS` / `GRAB_STEP_MS`)

### 7-3. 드래그 없이도 되는 길을 반드시 남긴다

- **모든 드래그 동작에 탭 대체 경로**를 둔다(골라서 목표를 탭). 드래그가 어려운 환경·보조기술 유저가 막힌다.
- **키보드 경로도 함께 둔다.** 포인터 핸들러만 단 `<button>`은 키보드로 아무것도 못 한다 —
  Enter/Space는 pointer 이벤트 없이 **`detail === 0`인 click**으로만 도착하므로, `onClick`에서
  `e.detail === 0`일 때 탭 제스처를 미러한다(마우스 클릭은 detail ≥ 1이라 이중 발화 없음).
  `<span role="button">`은 Enter로 click이 **아예 안 생기니** `onKeyDown`을 직접 달거나 진짜 버튼으로 만든다.
  (타일 손패/보드, 왕게임 숫자 카드·슬롯이 선례.)
- **`touch-action`은 "그 영역이 스크롤되는가"를 그대로 따라간다.** 둘 다 틀리면 조용히 망가진다.
  - 스크롤되는 행이면 `touch-action: none` **금지** — 아이템이 제스처를 다 삼켜 **손패를 스크롤할 수 없게 된다.**
    가로 스크롤 행이면 `pan-x`로 가로 스와이프는 스크롤, 세로 이동은 드래그로 갈라준다.
  - 스크롤되지 **않는** 영역이면 반대로 `pan-x`/`pan-y`가 **금지**다. 브라우저가 그 축의 제스처를 가져가
    **타일을 집어 올리는 드래그 자체를 뺏는다.** 여기선 `touch-action: none`이 정답이다.
  - 즉 스크롤 여부를 바꾸면 `touch-action`도 **반드시 같이** 바꾼다. (타일에서 실제로 이 짝이 어긋났다.)
- 드롭 타깃(`＋` 자리 등)은 **탭도 받는 버튼**으로 만든다.

### 7-4. 클라이언트 스테이징에는 "편의"까지 얹는다

서버가 유효로 받아주는 배치가 **사람 눈엔 고장으로 보인다.** 규칙 미러링만으로는 부족하다.

- **자동 분리**: 이미 놓인 세트 사이에 끼워 넣어 무효가 되면, 유효한 두 세트로 알아서 쪼갠다
  (5·6·7·8·9 + 7 → 5·6·7 / 7·8·9). 자를 위치는 **드롭 지점에서 가장 가까운 곳**부터 시도한다.
- **순서 정규화**: 배치 순서대로 두면 `12 13 11` 같은 게 그대로 남는다. 유효한 세트는
  런=오름차순(조커는 메우는 자리에), 그룹=색 순서로 재정렬한다. **무효인 세트는 건드리지 않는다**
  (유저가 고치는 중인 걸 흩뜨리면 안 된다).
- **감춰진 값을 드러낸다**: 조커가 무엇을 대신하는지 등, 엔진이 이미 계산하는 정보는 화면에 표시한다.

### 7-5. 비활성 1차 버튼은 이유를 말한다

- `턴 종료`처럼 조건부로 잠기는 버튼을 **회색으로만 두면 "고장"으로 읽힌다.**
  상시 노출되는 안내 줄(코치 라인)에 **왜 못 누르는지 / 지금 뭘 해야 하는지**를 쓴다.
- 눌러도 아무 일 없는 무반응도 금지다(§3-12). 못 하는 동작이면 **왜 못 하는지 알려준다**
  (예: "첫 등록 전에는 보드를 건드릴 수 없어요").
- **되돌릴 수 없는 동작은 라벨/보조문구로 미리 알린다.** 타일의 `＋`(뽑기)는 그 자리에서 턴이 끝나므로
  코치 라인이 그 사실을 상시 노출한다.
- **전송 중 잠금(busy/pending)은 서버 거절로도 풀려야 한다.** 서버 상태 변화(serverSig·phase·round)로만
  해제하면, 액션이 **거절될 때는 상태가 안 변해** 버튼이 턴/라운드 내내 죽는다(무제한 모드면 영구).
  `useRoomStore`의 `errorSeq`(모든 서버 error 이벤트마다 증가)를 해제 조건에 반드시 포함한다 —
  타일 `busy`, 주사위 `rollPending`이 선례.

### 7-6. 검증 방법 — 렌더 스크린샷으로는 못 잡는다

제스처는 **시간 축**이 있어서 정적 QA로 안 잡힌다. `apps/oneshot/e2e/`에서 Playwright로 **계측**한다.

```js
// 홀드 누적을 시간으로 찍어본다 (임시 스크립트, 확인 후 삭제)
await page.mouse.move(cx, cy);
await page.mouse.down();
for (const _ of [0,1,2,3]) {
  await page.waitForTimeout(250);
  console.log(await page.$$eval(".rk-tile.is-sel", (e) => e.length));
}
await page.mouse.move(cx, cy - 80, { steps: 6 });   // 드래그 시작 → 동결돼야 함
await page.waitForTimeout(1500);
console.log("ghost:", await page.$$eval(".rk-ghost .rk-tile", (e) => e.length));
```

- **숫자로 확인한다.** "되는 것 같다"가 아니라 `0 → 2 → 3 → 4`, 릴리즈 후 `0`, 드래그 후 동결 같은 수열로.
- 고친 제스처는 **e2e로 박제**한다(`e2e/tests/rummikub.spec.ts`가 선례 — 누적·드래그 동결·스냅백·회전 게이트).
- **테마별로도 돌린다.** 제스처는 CSS 히트 영역에 걸리므로 cozy/cyber 양쪽에서 같은 수열이 나와야 한다.

---

## 8. 스크롤 없는 게임 레이아웃 (fit-to-fit)

> 타일(Rummikub)이 이 방식의 기준 구현이다. `client/src/games/rummikub/fit.ts` 참고.
> **게임 화면은 스크롤하지 않는다.** 스크롤해야 보이는 타일은 없는 타일이고, 스크롤 제스처는
> 그 타일을 내는 드래그 제스처와 정면으로 싸운다.

### 8-1. 넘치면 스크롤이 아니라 "줄인다"

- 보드·손패·플레이어 레일은 `overflow: hidden` + **내용 축소**로 맞춘다.
  축소는 **필요한 만큼만** — 넓은 화면에서 억지로 줄이지 않는다.
- 축소로도 안 되면 **마지막 수단으로만** 스크롤을 되살린다(`is-scroll` 클래스).
  **잘라내기(clip)는 절대 금지** — 좌석·타일이 사라지는 건 정보 삭제다(§3-11).
- 플로팅 UI는 화면을 덮되, 보드는 같은 크기의 **padding 인셋**을 예약해 드롭 영역이 겹치지 않게 한다.
  "겹쳐 보이지만 안 겹친다"가 아니라 **실제로 안 겹쳐야** 한다.
- **미디어쿼리가 fit의 스케일 변수를 무력화하지 않게 한다.** 스케일 곱(`calc(26px * var(--rk-seat-scale))`)으로
  줄어들던 속성을 브레이크포인트에서 고정 px로 덮으면 fit이 더 못 줄여 **조용히 스크롤 폴백으로 전락**한다
  (8인 레일이 568×320에서 실제로 그랬다). 브레이크포인트에서도 스케일 곱을 유지한 채 기준값만 바꾼다.
- **`viewport-fit=cover`라서 노치 밑까지 그려진다.** 플로팅 컨트롤의 엣지는 고정 px 대신
  `max(var(--edge), env(safe-area-inset-*))`를 per-side 변수(`--rk-edge-l/r/t/b` 선례)로 두고,
  보드 인셋도 같은 변수로 계산한다. 노치 없는 기기에서는 수치가 완전히 동일해야 한다(e2e로 확인).

### 8-2. 늦게 마운트되는 노드에 `useRef` + `useLayoutEffect`를 쓰지 마라

**이번에 실제로 터진 버그다.** 보드/레일은 `phase === "play"`가 되어야 마운트되는데,
인원수·보드 시그니처 같은 deps는 **setup 단계에서 이미 확정**돼 있다. 그래서

```tsx
const ref = useRef(null);
useLayoutEffect(() => { if (!ref.current) return; fit(ref.current); }, [seatCount]);
```

는 **ref가 null인 채로 한 번 돌고 다시는 실행되지 않는다.** 8인 방에서 레일이 180px 넘쳐
좌석이 잘려 사라졌는데도 조용했다. 노드를 **state에 담는 콜백 ref**를 쓰고 deps에 노드를 넣는다.

```tsx
const [el, setEl] = useState(null);      // useFitTarget()
useLayoutEffect(() => { ... }, [el, seatCount]);
<div ref={setEl} />
```

### 8-3. ResizeObserver는 "넘치는 쪽"을 관찰해야 한다

컨테이너가 `position: absolute` / 고정 높이면 **컨테이너 크기는 영원히 안 변한다.**
변하는 건 안쪽 내용(좌석 합류, 아바타 이미지 로드, 세트 착지)이다.
→ `ro.observe(el)` 뿐 아니라 **`ro.observe(el.firstElementChild)`** 도 해야 한다.
자기 자신이 유발한 변경으로 무한 루프가 돌지 않게 `requestAnimationFrame` 한 프레임으로 묶는다.

### 8-4. 계산하지 말고 **재라**

타일 폭을 산술로 구하면 테두리·서브픽셀·폰트 메트릭 때문에 **1px씩 어긋나고, 그 1px이 3번째 줄을 만든다.**
산술은 초기 추정으로만 쓰고, 그 뒤 **실제 렌더된 박스**(`offsetTop`으로 센 줄 수, `scrollHeight`)로 보정한다.

### 8-5. 플로팅 컨트롤 스택에는 폭 계약이 있다

`--rk-hud-w` 같은 인셋 변수는 **그 안에 들어가는 가장 넓은 행보다 커야 한다.**
안 그러면 스택이 화면 오른쪽 밖으로 밀리고, **1차 버튼이 뷰포트 밖이라 클릭이 아예 안 된다.**
눈으로는 멀쩡해 보인다 — 반드시 아래처럼 **좌표로** 검증한다.

```js
// 버튼이 진짜 눌리는가: 화면 안에 있고, 무엇에도 안 가려졌는가
const r = el.getBoundingClientRect();
const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
// hit === null  → 뷰포트 밖으로 밀려남 (가장 잘 놓치는 케이스)
// !el.contains(hit) → 다른 요소가 덮고 있음
```

### 8-6. 레이아웃 QA는 스크린샷이 아니라 **숫자**로 한다

`apps/oneshot/e2e/`에서 임시 스크립트로 돌리고(확인 후 삭제), **테마 2종 × 여러 뷰포트**에서
같은 수치가 나오는지 본다. 최소 뷰포트는 **568×320(iPhone SE 가로)** 까지 본다.

```js
// 넘치는 요소를 전수 열거 — 클래스명을 미리 알 필요가 없다
[...document.querySelectorAll(".scr--foo, .scr--foo *")]
  .filter((el) => el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1)
  .map((el) => [el.className, getComputedStyle(el).overflowY]);
```

- 함께 뽑을 수치: 좌석 수 · `is-turn` 개수(정확히 1) · `is-me` 개수(정확히 1) ·
  손패 줄 수 · 타일 폭 · 가로 넘침 · 1차 버튼 도달 가능 여부.
- **말줄임(`…`)은 넘침이 아니다.** `scrollable: false`면 스크롤바가 생길 수 없으니 오탐으로 걸러낸다.
- 극단값을 반드시 넣는다: **최대 인원(8인) × 최소 화면**, **손패를 계속 뽑아 키운 상태**.

### 8-7. 미디어쿼리에서 `display: none`으로 도망가지 마라

좁은 화면에서 안 들어간다고 코치 라인·정보 블록을 숨기는 건 §3-11 위반이다(기능 삭제).
줄이거나 옮긴다. 특히 **floating 요소는 숨겨도 공간이 안 생긴다** — 숨길 이유조차 없다.

### 8-8. 전체화면

- `useAutoFullscreen`은 **터치 기기(`pointer: coarse`)에서만** 발동한다. 데스크톱에서 게임 진입만으로
  화면을 삼키면 빠져나갈 길을 못 찾는다. 데스크톱은 설정 모달의 수동 토글만.
- `requestFullscreen()`은 **유저 제스처 안에서만** 성공한다. 마운트 시 한 번 시도하고, 거부되면
  다음 `pointerdown` 한 번에 재시도한다.
- **아이폰 사파리는 이 API가 아예 없다.** `fullscreenSupported()`가 false면 토글을 **숨긴다**(죽은 버튼 금지).
- ⚠️ **전체화면이면 Playwright의 `setViewportSize`가 실패한다.** e2e 컨텍스트는
  `localStorage.setItem("oneshot.fullscreen", "off")`로 **반드시 옵트아웃**한다(`e2e/tests/rummikub.spec.ts`의 `gameContext`).

### 8-9. 디자인을 바꾸면 e2e 스펙도 그 변경의 일부다

UI를 갈아엎으면 옛 셀렉터·옛 라벨을 검증하던 스펙이 무더기로 깨진다. 이건 회귀가 아니라 **계약 갱신**이다.
다만 **깨진 스펙을 지우지 말고 새 계약으로 다시 쓴다** — 그 스펙이 지키던 불변식은 여전히 유효하다.

**단언은 "우연"이 아니라 "불변식"에 건다.** 예: "타일이 줄어든다"는 넓은 화면에서 **줄일 필요가 없어서 틀린다.**
올바른 불변식은 *"넓은 폭보다 좁은 폭에서 타일이 더 작다 + 항상 2줄 + 스크롤 0"* 이다.
"필요한 만큼만"이 요구사항이면 테스트도 그렇게 써야 한다.
