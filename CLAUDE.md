# OneShot — 프로젝트 개발 가이드

친구들이 한 파티 방에 모여 여러 술/파티 게임을 갈아끼우며 즐기는 **웹 우선 실시간 게임 허브**.
실제 제품 코드는 **`apps/oneshot/`** 안에만 있다. 루트의 다른 폴더/프로토타입은 배포 대상이 아니다.

> 이 문서는 **이 프로젝트의 규칙**이다. 새 화면·게임을 만들 때 반드시 따른다.
> 특히 **"두 테마(cyber·cozy)와 두 언어(ko·en)가 항상 같이 동작해야 한다"** 는 게 핵심 불변식이다.

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
corepack pnpm --filter @oneshot/server test
```

- pnpm은 `corepack pnpm`으로 호출한다(전역 pnpm 없을 수 있음).
- **pnpm 명령은 `apps/oneshot/` 안에서 실행한다.** workspace 루트가 여기다(리포 루트 아님). 리포 루트에서 돌리면 `vitest: command not found`로 실패한다.
- `.env`는 git-ignored다. `setup.sh`가 `*/.env.example`에서 생성한다.
- **모든 상태/에러 페이지는 `/_states` 라우트에서 한눈에 미리볼 수 있다.**
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
| 공용 React 컴포넌트 | `client/src/ui/terminal.tsx` (`Backdrop`, `AvatarImg`, `SettingsModal`, `LangToggle`) |
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

8. **완료 기준 = 2 테마 × 2 언어 = 4 조합 + `/_states`.** 설정에서 테마/언어를 바꿔가며 확인한다.

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
4. `server/src/games/registry.ts` — 모듈 등록(Map에 `["foo", () => new FooModule()]` + import).
5. `server/tests/`에 봇 테스트 추가(2~10명이 한 판을 끝까지 도는지). 추방/재접속 엣지 포함.

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

### (F) 보안·권위 서버 체크리스트 (필수 — 매 게임 검증)

- [ ] 규칙·검증·승패·랜덤이 **서버 모듈에만** 있다. 클라이언트는 UI/입력만.
- [ ] 비밀정보(역할/패/정답/진행 중 미션)는 `getStateFor()`로만. `getPublicState()`에 새지 않는다.
- [ ] 모든 액션 `payload`를 서버에서 **parse + 검증**(타입·범위·소유권). 클라가 보낸 값을 신뢰하지 않는다.
- [ ] 권한 게이팅: 호스트 전용은 `isHost`, 턴 전용은 `playerId === 현재 턴` 확인.
- [ ] `onPlayerRemoved`에서 추방된 플레이어의 흔적(번호·좌석·타깃)이 public state에 **유령으로 남지 않는다**.
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
12. `corepack pnpm -r typecheck` + 서버 테스트 (`apps/oneshot` 안에서).
13. 실제로 한 판 돌려 **cyber·cozy × ko·en** 4조합 + `/_states` 확인. 깨지는 곳은 §3 규칙 위반이다.

---

## 5. 완료 체크리스트 (PR 전)

- [ ] 색/폰트/간격을 토큰으로만 썼는가? (하드코딩 hex/px 없음)
- [ ] 레이아웃을 `.scr--<name>`로 스코프했는가?
- [ ] **cozy 오버라이드**를 넣고 cozy에서 직접 확인했는가?
- [ ] 사용자 텍스트가 i18n(ko·en) 양쪽에 있는가?
- [ ] 플레이어 아이콘에 `AvatarImg`(themeId 전달)를 썼는가?
- [ ] 새 에러/상태가 필요하면 `states.tsx`에 kind로 추가했는가?
- [ ] 게임 규칙/검증/비밀정보가 서버에만 있는가? (§4-F 보안 체크리스트 통과?)
- [ ] 게임 화면을 `GAME_SCREENS`(registry.tsx)에 등록했는가? (App.tsx 직접 분기 X)
- [ ] `coming_soon`/`available` status를 의도대로 설정했는가? (available만 노출)
- [ ] typecheck + 서버 테스트 통과?
- [ ] **2 테마 × 2 언어 + `/_states`** 확인?
