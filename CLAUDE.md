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
- `.env`는 git-ignored다. `setup.sh`가 `*/.env.example`에서 생성한다.
- **모든 상태/에러 페이지는 `/_states` 라우트에서 한눈에 미리볼 수 있다.**

---

## 2. 아키텍처 지도

| 영역 | 위치 |
|---|---|
| 디자인 토큰 + 공용 컴포넌트 CSS | `client/src/design/terminal.css` |
| 화면별 레이아웃 CSS (`.scr--*`) | `client/src/app/app.css` |
| 테마 시스템 | `client/src/theme/index.ts` (`THEMES`, `useTheme`) |
| 다국어 | `client/src/i18n/index.ts` (`useT`, `gameTitle`, `gameTagline`) |
| 아바타 | `client/src/design/avatars.ts` + `public/themes/<theme>/avatars/` |
| 게임 표시 메타 | `client/src/design/games.ts` (`GAME_META`, `GAME_ORDER`) |
| 공용 React 컴포넌트 | `client/src/ui/terminal.tsx` (`Backdrop`, `AvatarImg`, `SettingsModal`, `LangToggle`) |
| 상태/에러 페이지 | `client/src/ui/states.tsx` (`StateScreen`, `StateKind`) |
| 화면 라우팅 | `client/src/app/App.tsx` |
| 서버 게임 규칙 | `server/src/games/<id>/`, 등록은 `server/src/games/registry.ts` |
| 게임 카탈로그 / 타입 | `shared/src/games/catalog.ts`, `shared/src/schema/domain.ts` (`GameId`) |

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

## 4. 새 게임 추가 레시피 (복붙용 스캐폴드)

게임 하나를 붙이는 표준 절차. **프레젠테이션은 위 §3 규칙을 그대로 따른다.**

### (A) 공유 타입 / 카탈로그
1. `shared/src/schema/domain.ts` — `GameId` 유니온에 `"foo"` 추가.
2. `shared/src/games/catalog.ts` — 카탈로그 항목 추가:
   `{ id: "foo", title: "푸게임", minPlayers, maxPlayers, complexity: 1|2|3, supportsJoinInProgress, defaultOptions, status: "available" | "coming_soon" }`

### (B) 서버 게임 규칙 (권위 서버)
3. `server/src/games/foo/FooModule.ts` — `GameModule` 인터페이스 구현(`start`/`handleAction`/`getPublicState`/`getStateFor`/`isOver` 등).
   - 규칙·검증·랜덤은 **서버만**. 비밀정보는 `getStateFor(playerId)`로만 내려보낸다(다른 플레이어 패/역할 노출 금지).
4. `server/src/games/registry.ts` — 모듈 등록.
5. 가능하면 `server/tests/`에 봇 테스트 추가.

### (C) 클라이언트 표시 메타 + 다국어
6. `client/src/design/games.ts` — `GAME_META`에 `foo: { glyph, accent, min, max }` + `GAME_ORDER`에 추가.
7. `client/src/i18n/index.ts` — `ko`·`en` 둘 다에 `game.foo`, `gametag.foo` 추가.

### (D) 게임 화면 (테마-세이프)
8. `client/src/games/foo/FooGameScreen.tsx`:
```tsx
import type { PartyRoomState } from "@oneshot/shared";
import { useT } from "../../i18n";
import { Backdrop, AvatarImg } from "../../ui/terminal";

export const FooGameScreen = ({
  roomState,
  privateState,
}: {
  roomState: PartyRoomState;
  privateState: unknown;
}) => {
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
11. `client/src/app/App.tsx` — 라우팅 분기 추가:
```tsx
} else if (roomState?.phase === "game" && roomState.activeGame?.gameId === "foo") {
  screen = <FooGameScreen roomState={roomState} privateState={privateGameState} />;
}
```

### (E) 검증
12. `corepack pnpm -r typecheck` + 서버 테스트.
13. 실제로 한 판 돌려 **cyber·cozy × ko·en** 4조합 확인. 깨지는 곳은 §3 규칙 위반이다.

---

## 5. 완료 체크리스트 (PR 전)

- [ ] 색/폰트/간격을 토큰으로만 썼는가? (하드코딩 hex/px 없음)
- [ ] 레이아웃을 `.scr--<name>`로 스코프했는가?
- [ ] **cozy 오버라이드**를 넣고 cozy에서 직접 확인했는가?
- [ ] 사용자 텍스트가 i18n(ko·en) 양쪽에 있는가?
- [ ] 플레이어 아이콘에 `AvatarImg`(themeId 전달)를 썼는가?
- [ ] 새 에러/상태가 필요하면 `states.tsx`에 kind로 추가했는가?
- [ ] 게임 규칙/검증/비밀정보가 서버에만 있는가?
- [ ] typecheck + 서버 테스트 통과?
- [ ] **2 테마 × 2 언어 + `/_states`** 확인?
