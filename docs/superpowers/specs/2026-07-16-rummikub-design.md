# 루미큐브(Rummikub) — 설계 문서

- 날짜: 2026-07-16
- 게임 id: `rummikub`
- 목표: OneShot에 정식 루미큐브를 추가한다. 서버 권위 · 2테마 × 2언어 · 데스크톱/모바일(가로 강제) · 실제 모바일 루미큐브 수준의 조작 편의성.

이 문서는 구현의 단일 근거다. 파일별 레시피는 프로젝트 `CLAUDE.md §4`를 따른다.

---

## 1. 확정된 게임 스펙

| 항목 | 값 |
|---|---|
| id | `rummikub` |
| 이름 ko / en | 루미큐브 / Rummikub |
| 태그라인 ko / en | 타일을 세트로 엮어 먼저 손을 비우는 사람이 승리 / Meld tiles into sets and empty your hand first |
| glyph | `▤` (타일 격자 느낌) — 홈 fallback 아이콘 |
| accent | `gold` |
| minPlayers / maxPlayers | 2 / 8 |
| complexity | 3 |
| supportsJoinInProgress | false (비밀 손패 + 타일 보존 때문) |
| defaultOptions | `{}` (턴 초는 인게임 setup 페이즈에서) |
| status | `available` |
| 썸네일 | 사용자 제공 이미지: cozy=나무 랙, cyber=네온 랙. 512×512로 리사이즈 |

### 규칙 충실도 (사용자 확정)
- **풀 정식 규칙.** 타일 1~13 × 4색 × (덱당 2벌) + 조커. 그룹/런. 초기 30점 멜드(손패만). 등록 후 보드 자유 재조합. 조커 회수.
- **인원/덱:** 2~4명 → 1덱(106장), 5~8명 → 2덱(212장). 게임 시작(딜) 시점의 착석 인원으로 자동 결정.
- **턴 타임아웃:** 자동 드로우 + 턴 넘김(풀 비면 패스).
- **가로모드:** 세로일 때 "가로로 돌려주세요" 게이트 오버레이. 좌·우 양방향 가로 모두 허용. 데스크톱은 자연 가로.
- **카드 페이스:** 테마 무관 통일(크림 타일 + 색 숫자 + 하단 원형 홈).

---

## 2. 권위 모델 (가장 중요)

**클라이언트 스테이징 + 서버 스냅샷 커밋.** 자기 턴 동안 클라가 보드/손패의 **작업 사본**을 무지연으로 자유 조작한다. "턴 종료"에서만 **제안된 보드 전체**(`Meld[]`)를 서버로 보낸다. 서버는 원자적으로 재검증한다:

1. **타일 보존**
   - `oldBoardTiles ⊆ proposedBoardTiles` — 보드 타일은 손으로 되돌릴 수 없다(사라지면 거부).
   - `played = proposedBoardTiles − oldBoardTiles ⊆ myHand` — 추가분은 전부 내 손패에서만. (위조/도난/복제 불가)
   - 다른 플레이어 손패·풀은 이 액션으로 절대 변하지 않는다.
2. **모든 멜드 유효** — 제안 보드의 각 멜드가 그룹 또는 런.
3. **손패 순감소 ≥ 1** — `played.length ≥ 1`.
4. **초기 멜드 규칙** (`!hasDoneInitialMeld`일 때):
   - 기존 보드 멜드는 **한 개도 손대지 않는다**: 제안 보드 = (기존 멜드 전부 그대로) + (새 멜드들). 새 멜드는 **오직 손패 타일**로만 구성.
   - 새로 낸 타일들의 **값 합 ≥ 30**. 조커는 자신이 대표하는 타일의 값으로 계산.
   - 통과 시 `hasDoneInitialMeld = true`.

**조커 회수·보드 재조합은 별도 액션이 없다.** 클라에서 보드를 아무리 주물러도 "커밋 후 보드가 유효 + 보존"이면 합법 → 일반 검증에서 자동 통과. 조커를 손패의 실제 타일로 교체해 다른 멜드로 옮기는 것도, 최종 보드가 전부 유효/보존이면 그대로 인정된다. **검증기 하나가 전부다.** → 적대적 테스트로 집중 검증.

커밋이 거부되면 클라는 스테이징을 서버 상태로 되돌린다(shake + 빨강 플래시 후 복원).

---

## 3. 데이터 모델 (`shared/src/games/rummikub.ts`)

```ts
export type TileColor = "red" | "blue" | "orange" | "black";

export type Tile =
  | { id: string; kind: "num"; color: TileColor; num: number } // num 1..13
  | { id: string; kind: "joker" };

export type Meld = { id: string; tiles: string[] }; // 보드 위 한 세트, 타일 id 순서 보존

export type TurnSeconds = 15 | 30 | 60 | 90 | 120 | 0; // 0 = 무제한
export const RUMMIKUB_TURN_SECONDS: TurnSeconds[] = [15, 30, 60, 90, 120, 0];
export const RUMMIKUB_DEFAULT_TURN_SECONDS: TurnSeconds = 60;

export const RUMMIKUB_START_HAND = 14;
export const RUMMIKUB_INITIAL_MELD_MIN = 30;
export const RUMMIKUB_COLORS: TileColor[] = ["red", "blue", "orange", "black"];
```

### 타일 ID 규약
- 숫자 타일: `` `${color}-${num}-${copy}` `` (예: `red-7-0`). copy는 1덱이면 0..1, 2덱이면 0..3.
- 조커: `` `joker-${copy}` `` (1덱: 0..1, 2덱: 0..3).
- 덱 빌더 `buildDeck(deckCount: 1 | 2): Tile[]`.

### 공유 검증기 (client·server 공용, 순수 함수)
```ts
tileValue(tile, jokerAs?): number             // 숫자=num, 조커=대표값(없으면 0)
export type MeldClass =
  | { valid: true; kind: "group" | "run"; jokerValues: Record<string, number> } // 조커 id → 대표 숫자값
  | { valid: false };
classifyMeld(tiles: Tile[]): MeldClass         // 그룹/런 판정 + 조커 대표값 추론
isValidMeld(tiles: Tile[]): boolean
meldValue(tiles: Tile[]): number               // 유효 멜드의 타일값 합(조커 대표값 포함)
```

**`classifyMeld` 알고리즘**
- 길이 < 3 → invalid.
- 조커 개수 `j`, 비조커 타일 `reals`.
- **그룹 시도:** `reals`의 num이 모두 동일 & 색이 서로 다름 & `reals.length + j ≤ 4` & 전체 길이 3..4. 조커 대표값 = 그 그룹의 num, 대표 색은 남는 색 아무거나. 성립 시 group.
- **런 시도:** `reals`의 색이 모두 동일. num들을 정렬, 중복 없음. 조커로 빈칸/양끝을 채워 길이 = 멜드 길이의 **연속 오름차순**(1..13 범위, wrap 금지)을 만들 수 있는 배치가 존재하면 run. 조커 대표값 = 채운 숫자. (여러 배치 가능 시 최솟값 시작 등 결정적 규칙으로 하나 선택.)
- **전부 조커(reals 비었음):** group으로 간주(서로 다른 색 배정 가능), 대표값은 결정적으로 하나(예: 최대 13). 희귀 엣지, 점수만 영향.
- 두 시도 중 하나라도 성립하면 valid.

검증기는 shared에 두어 클라(실시간 하이라이트)와 서버(권위)가 **같은 코드**를 쓴다.

### 액션 & 페이로드
```ts
export const RUMMIKUB_ACTIONS = {
  configure: "rummikub:configure", // host: { turnSeconds }
  commit:    "rummikub:commit",    // 현재턴: { board: Meld[] }  ← 제안 보드 전체
  draw:      "rummikub:draw",      // 현재턴: 1장 뽑고 턴 종료
  timeout:   "rummikub:timeout",   // 아무 클라: { turnNumber } — deadline 검증
  skipTurn:  "rummikub:skipTurn",  // host: 현재턴 플레이어가 끊겼을 때만
  proposeEnd:"rummikub:proposeEnd",
  voteEnd:   "rummikub:voteEnd",   // { agree: boolean }
} as const;
```

### 공개 상태 (`getPublicState`)
```ts
export type RummikubPublicPlayer = {
  playerId: string; handCount: number; hasDoneInitialMeld: boolean; connected: boolean;
};
export type RummikubPublicState = {
  phase: "setup" | "play" | "ended";
  turnSeconds: TurnSeconds;
  deckCount: 1 | 2;
  board: Meld[];                 // 보드는 공개 (타일 페이스 포함)
  poolCount: number;
  order: string[];               // 좌석 순
  players: RummikubPublicPlayer[];
  currentTurnPlayerId: string | null;
  turnNumber: number;
  turnDeadline: number | null;   // epoch ms, 무제한이면 null
  lastEvent: RummikubLastEvent | null; // 이펙트용: { kind: "draw"|"commit"|"skip"|"timeout", playerId, meldIds? }
  endVoteCooldownUntil: number | null;
  endVote: { agree: string[]; needed: number } | null;
  result: GameResult | null;
};
```
**보드 타일은 절대 비밀이 아니다**(모두가 봄). 손패만 private. 공개 상태에 손패 내용 금지, `handCount`만.

### 개인 상태 (`getStateFor`)
```ts
export type RummikubPrivateState = { hand: Tile[]; hasDoneInitialMeld: boolean };
```

---

## 4. 상태 기계 · 턴 흐름 (`rummikubCore.ts`)

- `start()` → `phase="setup"`, 딜 안 함.
- `configure(isHost, {turnSeconds})` → setup에서만, host만. `turnSeconds` 검증(허용값). **딜 실행**: `deckCount = seated ≤ 4 ? 1 : 2`, `buildDeck` 셔플, 각자 14장, 나머지 풀. `phase="play"`, 첫 턴 = `order[0]`, `turnDeadline` 세팅.
- **턴:** 현재 플레이어는 ①`commit`(유효 → 검증 통과 시 보드 교체, 손패 갱신, `hasDoneInitialMeld` 갱신) 또는 ②`draw`(풀 1장 손패로, 턴 종료). 둘 중 하나만.
  - commit 후 손패 0 → 승리 → `finish`.
  - commit/draw 후 다음 접속 플레이어로 `advanceTurn`, deadline 리셋, `passStreak` 갱신(commit=리셋, draw/timeout-pass=+1).
- **timeout:** `now ≥ deadline` & `turnNumber` 일치 시 현재 플레이어 자동 처리: 풀 있으면 드로우, 없으면 패스 → advance.
- **종료 조건:**
  - 누군가 손패 0 → 승리.
  - 풀 0 & `passStreak ≥ activeCount`(한 바퀴 전원 진행 없음) → 종료, 잔여 최소 합이 승.
  - 조기종료 투표 통과 → `canceled` 로비 복귀.
- `isOver()` → `this.result`.

### 점수 (`GameResult`)
- 손패 소진 승자: `scoreDelta = +Σ(상대 잔여값)`, 각 상대 `= −(자기 잔여값)`. 조커=30, 숫자=액면.
- 풀-고갈 종료: 잔여 최소가 승(동점 허용), 동일 매핑.
- 랭킹은 `scoreDelta` 내림차순.

---

## 5. 킥 / 끊김 견고성 (§4-B, §4-F 준수)

- `onPlayerLeave(id)`: `disconnected.add(id)`, 좌석 유지. 진행 중 endVote 재해결. 그 사람 턴이면 `timeout`이 자동 처리(데드락 없음). 무제한 모드 안전판 = host `skipTurn`.
- `onPlayerReturn(id)`: `disconnected.delete(id)`.
- `onPlayerRemoved(id)`: order/players/hands에서 제거. **잔여 손패는 풀로 반환 후 셔플**(보존/점수 정합). 현재 턴이었으면 `resolveTurnAfterRemoval` 헬퍼로 다음 접속자에게 턴 이양 + deadline 리셋 + 유령 `currentTurnPlayerId` 정리. endVote 표 제거·재해결. `checkOver`(≤1명 남으면 그 사람 승). 방이 `kickPlayer` 후 `isOver()` 스윕.
- 정상 경로·킥 경로 **둘 다** 같은 `advanceTurn`/`checkOver` 헬퍼로 funnel → 정지 불가.
- 투표 정족수 분모 = 접속 인원.

---

## 6. 클라이언트 UX

### 레이아웃 (가로)
- 상단 레일: 상대 좌석(아바타·닉·손패수·현재턴 펄스·초기멜드 배지).
- 중앙 보드: 멜드들을 **보이지 않는 그리드**에 배치. 콘텐츠 폭이 뷰포트를 넘으면 컨테이너 `scale` 자동 축소(줌아웃) + 스크롤/팬.
- 하단: 내 정보줄(나 하이라이트 "나"·손패수·타이머 카운트다운·[777][789] 정렬) + 내 손패 랙(가로 스크롤, 늘면 길어짐/좁으면 2줄) + 고정 액션바([드로우][되돌리기][턴 종료]).
- 턴 종료 버튼은 **스테이징이 유효 커밋(≥1장 냄 + 전 멜드 유효 + 보존 + 초기멜드 조건)일 때만** 활성. 실시간으로 shared 검증기가 판정.

### 편의 기능
- **777 / 789 정렬:** 777=숫자→색, 789=색→숫자(런 정렬). 클라 손패 재정렬(순수 `tileSort.ts`).
- **롱프레스 자동 선택:** 손패 타일 롱프레스 → 그 타일이 낄 최대 유효 세트(런 우선, 없으면 그룹) 계산 → 순차 하이라이트 → "놓기"로 새 멜드 스테이징.
- **보드 재조합:** 포인터 기반 드래그(외부 라이브러리 없음), 그리드 스냅, 탭-다중선택 후 묶음 이동, 멜드 분해/합치기. 전부 스테이징 사본(`staging.ts` 순수 연산: move/split/merge/insert/reset).
- **줌아웃/랙 확장:** 위 레이아웃 규칙.

### 상태/모달
- setup 페이즈: 턴 초 스텝퍼(가운데 수치 + 위/아래 화살표, 끝값이면 화살표 비활성). host만 조작, 비host는 대기.
- `?` RulesModal(ko·en 룰), `⚙` SettingsModal, 조기종료 투표 — 기존 패턴 재사용.
- 가로모드 게이트: 세로 감지 시 오버레이.

### 이펙트 (§ "너무 단순하면 안됨")
- 드로우: 풀→랙 날아오는 keyframe(slide+fade).
- 커밋: 새 멜드 pop + 짧은 글로우(테마 토큰 색).
- 무효 커밋: 보드 shake + 빨강 플래시 후 복원.
- 턴 전환: 현재 플레이어 레일 펄스.
- 승리: 승자 하이라이트.
- 전부 `.scr--rummikub` 스코프 CSS `@keyframes`, `key` 리마운트로 리플레이. 크롬은 토큰 색, 타일 페이스는 게임 스코프 타일 색.

---

## 7. 카드 페이스 / 가로모드 / 아이콘

- 타일 페이스 색은 게임 콘텐츠(카드 문양급) → `--tile-red/--tile-blue/--tile-orange/--tile-black`를 `.scr--rummikub` 스코프에 정의, **테마 독립**. §3-7 "게임은 테마 위에 얹는다"의 합당한 예외로 문서화(§3-1 하드코딩 금지의 예외이며, 크롬은 여전히 토큰 사용).
- 가로모드: `OrientationGate` — `matchMedia("(orientation: portrait)")` 감지, 세로면 오버레이(회전 아이콘 + i18n 문구), 가로면 children 렌더. 양방향 가로 허용(방향 잠금 안 함).
- 썸네일: 제공 이미지 #1(cozy)·#3(cyber)을 512×512 풀블리드로 저장 → `client/public/themes/{cozy,cyber}/games/rummikub.png`.

---

## 8. 파일 체크리스트 (§4 레시피)

**shared**
- `schema/domain.ts` — `GameId`에 `"rummikub"`.
- `games/rummikub.ts` — 타입·상수·액션·검증기·덱빌더.
- `games/catalog.ts` — 항목(min 2, max 8, complexity 3, status available).
- `index.ts` — `export * from "./games/rummikub"`.

**server**
- `games/rummikub/rummikubCore.ts` — 상태·딜·커밋검증·턴·킥·점수.
- `games/rummikub/RummikubModule.ts` — 어댑터.
- `games/registry.ts` — 등록.
- `tests/RummikubModule.test.ts` — 봇 완주(2~8인 × 1/2덱), 초기멜드<30 거부, 조커 회수/보드 재조합 보존, 위조 타일 거부, 킥/타임아웃 데드락 회귀.

**client**
- `games/rummikub/RummikubGameScreen.tsx` (+ SetupView / PlayView / TileFace / OrientationGate).
- `games/rummikub/staging.ts` (순수 스테이징 연산), `tileSort.ts`(정렬·자동선택).
- `design/games.ts` — GAME_META + GAME_ORDER.
- `i18n/index.ts` — ko·en (게임명·태그·룰·UI 문구).
- `games/registry.tsx` — GAME_SCREENS 등록.
- `app.css` — `.scr--rummikub` cyber 레이아웃 + keyframes.
- `design/terminal.css` — `[data-theme="cozy"] .scr--rummikub` 오버라이드.
- `public/themes/{cozy,cyber}/games/rummikub.png` — 썸네일.

---

## 9. 완료 기준 (ralph — 증거 기반)

- `corepack pnpm -r typecheck` 통과.
- `corepack pnpm --filter @oneshot/server test` — RummikubModule.test.ts 전 케이스 통과.
- `corepack pnpm --filter @oneshot/client build` 통과.
- 검증기 적대적 테스트(ultracode 워크플로우)로 커밋 검증 무결성 확인.
- 로컬 실플레이: cyber·cozy × ko·en 4조합 + `/_states` + 모바일 가로/세로 게이트.
- §5 완료 체크리스트 + §6 유저 여정 QA(진입 경로·URL·클립보드는 홈/로비 불변이므로 게임 진입/이탈·리커넥트 위주) 통과.
