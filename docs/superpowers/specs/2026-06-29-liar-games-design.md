# 라이어 게임 2종 — 설계 문서

> OneShot 파티 허브에 추가하는 두 개의 신규 게임: **라이어**(`liar`)와 **바보 라이어**(`fool-liar`).
> 작성일: 2026-06-29. 본 문서는 `apps/oneshot/CLAUDE.md` §4 "새 게임 추가 레시피"를 따른다.

---

## 1. 목적 / 범위

친구들이 한 방에 모여 즐기는 라이어 게임. **앱의 역할은 "비밀 단어를 공정하게 배분하고 각자에게만 보여주는 것"까지**다.
토론·라이어 지목·투표·정답 추리는 **오프라인(친구들끼리 말로)** 진행한다. 따라서:

- 순위/점수 계산 없음.
- 방장이 "게임 종료"를 누르면 **아무것도 공개하지 않고** 바로 로비로 돌아간다(kinggame과 동일한 빈 결과 → "다시하기" 화면).

두 게임의 차이는 **라이어에게 어떤 카드를 주느냐** 단 하나다.

| 게임 | 시민 카드 | 라이어 카드 | 라이어가 자기 정체를 아는가 |
|---|---|---|---|
| **라이어** (`liar`) | 정답 단어 (예: 사과) | `"라이어"` | **안다** |
| **바보 라이어** (`fool-liar`) | 정답 단어 (예: 사과) | 같은 카테고리의 **다른 단어**(라이어 전원 동일, 예: 포도) | **모른다** |

---

## 2. 게임 스펙 (CLAUDE.md §4-0 표)

| 항목 | `liar` | `fool-liar` |
|---|---|---|
| `id` | `"liar"` | `"fool-liar"` |
| 이름 ko / en | 라이어 / Liar | 바보 라이어 / Fool Liar |
| 태그라인 ko | 한 명은 다른 답을 받았다 | 라이어도 자기가 라이어인 줄 모른다 |
| 태그라인 en | One of you got a different word | Even the liar doesn't know |
| `glyph` | `◑` (가면/이중성 느낌) | `◍` (TBD, §아래 참고) |
| `accent` | `"red"` | `"gold"` |
| `minPlayers` / `maxPlayers` | 3 / `null` | 3 / `null` |
| `complexity` | 2 | 1 |
| `supportsJoinInProgress` | `false` | `false` |
| `defaultOptions` | `{}` (로비 옵션 없음) | `{}` |
| `status` | `"available"` | `"available"` |

> glyph/accent는 디자인 토큰 범위 내에서 최종 조정 가능. 두 게임이 구분되도록 서로 다른 glyph·accent를 쓴다.

---

## 3. 게임 흐름 (phase)

두 게임 동일한 2-phase 구조. kinggame의 `setup` → `command`/`revealed` 패턴을 단순화한 형태.

```
setup  →  reveal  →  (호스트 종료) → isOver(빈 결과) → results("다시하기")
```

### phase: `setup` (호스트만 조작)
호스트가 두 가지를 정한다:
1. **카테고리** — 9개 중 택1 (§4 목록)
2. **라이어 수** — `1 .. maxLiars` 중 택1, `maxLiars = floor(playerCount / 5) + 1`
   - 3~4명 → 1 (고정)
   - 5~9명 → 1 또는 2
   - 10~14명 → 1 / 2 / 3
   - 15~19명 → 1 / 2 / 3 / 4 …

비-호스트는 "방장이 설정 중" 대기 화면을 본다(kinggame `king.setup.waitingHost` 패턴).

호스트가 시작 → `configure` 액션 전송 → 서버가:
- 카테고리 내 단어 풀에서 **랜덤 정답 1개** 선정(주입된 seed 기반 `Randomizer`)
- `fool-liar`라면 정답과 다른 단어 1개를 라이어용으로 추가 선정(같은 카테고리)
- `SecretDealer`로 라이어 N명을 랜덤 배정, 나머지는 시민
- phase → `reveal`

### phase: `reveal` (전원)
- 각 플레이어는 **자기 카드 1장**만 본다(`getStateFor`).
- 카드는 기본 **가려진 상태**. **탭하면 토글**(한 번 보면 계속 보임, 다시 탭하면 숨김).
  - cyber: 글리치/스캔라인 블록으로 덮인 카드 → 탭 시 단어 노출
  - cozy: 뒤집힌 카드(카드 뒷면) → 탭 시 앞면 단어
- 화면에는 카테고리 이름(예: "과일")도 표시(모두 공개 정보).
- 호스트는 화면 상단에 **"게임 종료"** 버튼 상시 노출.

### 종료
호스트 "게임 종료" → `endGame` 액션 → 서버 `result = { ranking: [], winnerPlayerIds: [], summary: "..." }` → `isOver()` 반환 → 방이 results phase(빈 순위 + "다시하기")로 전환. **정답·라이어 신원은 공개하지 않는다.**

---

## 4. 카테고리 / 단어 풀

카테고리 9개, 각 **50개 이상**, 모든 단어 `{ ko, en }` 병기. 한국 친구들이 추리 가능한 보편적 단어로 구성.

1. 국가 (countries)
2. 과일 (fruits)
3. 채소 (vegetables)
4. 동물 (animals)
5. 직업 (jobs)
6. 스포츠 (sports)
7. 가구 (furniture)
8. 브랜드 (brands)
9. 곤충 (insects)

### 데이터 구조 (shared)
i18n dict에 단어를 넣지 않는다(콘텐츠는 데이터). 대신 shared에 단어 풀 파일을 둔다:

```ts
// shared/src/games/liarCategories.ts
export type LiarWord = { ko: string; en: string };
export type LiarCategory = { id: LiarCategoryId; words: LiarWord[] };
export type LiarCategoryId =
  | "countries" | "fruits" | "vegetables" | "animals"
  | "jobs" | "sports" | "furniture" | "brands" | "insects";

export const LIAR_CATEGORIES: Record<LiarCategoryId, LiarWord[]> = { ... };
```

- **카테고리 이름**은 노출 텍스트이므로 i18n(`liarcat.fruits` = "과일"/"Fruits").
- **단어**는 데이터의 `{ko,en}`에서 현재 언어로 골라 표시.
- 단어 선정/정답·라이어 단어 결정은 **서버에서만**. 클라이언트는 자기 카드 단어를 `getStateFor`로 받아 표시만.

---

## 5. 서버 설계 (권위 서버)

### 공유 로직
두 게임은 단어 배정 한 줄만 다르므로 공통 베이스를 둔다.

```
server/src/games/liar/LiarModule.ts         // liar: 라이어 카드 = "라이어"
server/src/games/fool-liar/FoolLiarModule.ts // fool-liar: 라이어 카드 = 다른 단어
server/src/games/liar/liarCore.ts            // 공통 setup/reveal/endGame/state 로직
```

`liarCore.ts`가 phase 관리·configure 검증·SecretDealer 배정·getPublicState/getStateFor 골격을 담고,
두 모듈은 "라이어에게 줄 카드 텍스트를 어떻게 만드는가"(`buildLiarCard(answer, category, randomizer)`)만 주입한다.

### 타입 (shared)
```ts
// shared/src/games/liar.ts (두 게임 공용)
export type LiarPhase = "setup" | "reveal";
export type LiarOptions = Record<string, never>;       // 로비 옵션 없음

export type LiarPublicState = {
  phase: LiarPhase;
  categoryId: LiarCategoryId | null;   // setup 중엔 null
  liarCount: number;                    // 공개 OK (누가 라이어인지는 비공개)
  maxLiars: number;                     // setup UI용
};

export type LiarPrivateState = {
  card: string | null;   // 내 카드 단어("라이어" 또는 실제 단어). reveal phase에만 채워짐
  // 역할(시민/라이어)은 클라에 내려보내지 않는다.
  //  - liar: 카드가 "라이어"면 본인이 라이어임을 자연히 앎(스펙 의도)
  //  - fool-liar: 카드만 보이고 시민/라이어 구분 불가(스펙 의도: 라이어도 모름)
};

export type LiarConfigurePayload = {
  categoryId: LiarCategoryId;
  liarCount: number;
};
```

### 액션
```
liar:configure      payload: { categoryId, liarCount }   // 호스트 전용, phase=setup
liar:endGame        payload 없음                          // 호스트 전용
```
`fool-liar`도 동일 액션 타입 네임스페이스를 게임별로 구분(`fool-liar:configure` 등).

### 보안 체크 (CLAUDE.md §4-F)
- [x] 정답·라이어 단어·누가 라이어인지 = 서버에만. `getPublicState`에 미포함.
- [x] `getStateFor(playerId)`는 그 플레이어의 카드만 반환.
- [x] `configure` payload 검증: `categoryId`가 유효한지, `1 ≤ liarCount ≤ maxLiars`인지, phase=setup인지, `isHost`인지.
- [x] `endGame`은 `isHost` 게이팅.
- [x] `onPlayerRemoved`: 추방된 플레이어의 카드/배정을 상태에서 제거(public state엔 애초에 신원이 없어 유령 위험 낮음).
- [x] 새 HTTP 엔드포인트 없음(게임 액션은 WS).

### 테스트
`server/tests/`에 봇 테스트: 3·5·10명에서 setup→reveal 진행, 라이어 수 경계(maxLiars), 시민/라이어 카드가 의도대로 배정되는지, fool-liar에서 라이어 전원이 **동일한** 다른 단어를 받는지, 추방 엣지.

---

## 6. 클라이언트 설계 (테마-세이프)

### 표시 메타 / i18n
- `client/src/design/games.ts`: `GAME_META`에 `liar`, `fool-liar` 추가(glyph/accent/min/max) + `GAME_ORDER`.
- `client/src/i18n/index.ts`: ko·en에 `game.liar`/`game.fool-liar`, `gametag.*`, 카테고리명 `liarcat.*`, setup/reveal UI 문구.

### 화면
```
client/src/games/liar/LiarGameScreen.tsx        // liar
client/src/games/fool-liar/FoolLiarGameScreen.tsx // fool-liar
client/src/games/liar/LiarSetup.tsx   (공용)     // 카테고리+라이어수 선택 UI
client/src/games/liar/LiarCard.tsx    (공용)     // 탭 토글 가리기 카드
```
두 화면은 거의 동일 → 공용 컴포넌트(`LiarSetup`, `LiarCard`)를 공유하고 게임 화면은 phase 라우팅 + 게임별 라벨만 담당.
`registry.tsx`의 `GAME_SCREENS`에 두 줄 추가.

### CSS
- `app.css`: `.scr--liar`, `.scr--fool-liar` (또는 공용 `.scr--liar` 스코프 재사용 + variant) — CYBER 기본 레이아웃. 색/폰트/간격은 토큰만.
- `terminal.css`: cozy 오버라이드(둥근 카드, 카드 뒤집기 모션) + 가리기 이펙트(cyber 글리치/스캔라인, cozy 카드백).
- 플레이어 아이콘은 `<AvatarImg avatarKey themeId />`.

---

## 7. 변경 파일 체크리스트

**shared**
- [ ] `schema/domain.ts` — GameId에 `liar`,`fool-liar` (이미 존재)
- [ ] `games/catalog.ts` — 두 항목 `status: "available"`로 변경(이미 항목 존재)
- [ ] `games/liar.ts` — 공용 타입(신규)
- [ ] `games/liarCategories.ts` — 9개 카테고리 단어 풀(신규)
- [ ] `index.ts` — 신규 파일 export

**server**
- [ ] `games/liar/liarCore.ts`, `games/liar/LiarModule.ts`, `games/fool-liar/FoolLiarModule.ts`
- [ ] `games/registry.ts` — 두 모듈 등록
- [ ] `tests/` — 봇 테스트

**client**
- [ ] `design/games.ts` — 메타 + 순서
- [ ] `i18n/index.ts` — ko·en
- [ ] `games/liar/*`, `games/fool-liar/*` — 화면 + 공용 컴포넌트
- [ ] `games/registry.tsx` — GAME_SCREENS 등록
- [ ] `app/app.css` — cyber 레이아웃
- [ ] `design/terminal.css` — cozy 오버라이드 + 가리기 이펙트

**검증**
- [ ] `corepack pnpm -r typecheck` + 서버 테스트 (apps/oneshot 내)
- [ ] cyber·cozy × ko·en 4조합 + `/_states`

---

## 8. 결정 사항 / 미해결

**확정**
- 앱은 단어 배분까지만, 종료 시 공개 없이 바로 로비.
- 가리기 = 탭 토글(한 번 보면 계속).
- 라이어 수 = `floor(인원/5)+1` 상한, 최소 1.
- 카테고리 9개, 단어 ko·en 병기.

**구현 중 확정할 소소한 것**
- glyph/accent 최종값.
- fool-liar에서 라이어가 1명일 때도 정답과 다른 단어 1개를 받음(자명).
- 단어 풀 50+개 실제 리스트(구현 시 작성, 보편·고유명 위주).
