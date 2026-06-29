# Upstage(업스테이지) — 게임 설계 스펙

> 작성일: 2026-06-29 · 대상: `apps/oneshot` 새 게임 `upstage`
> 한 줄 요약: 손패를 가장 먼저 비우면 이기는 **순수 숫자 카드 셰딩(shedding) 게임**.
> 공식 *The Great Dalmuti* 규칙을 골격으로 차용하되, **중세 계급/신분 테마를 전부 제거**하고
> 숫자 카드 + ★(스타) 와일드만 남긴 단순 카드게임으로 재포장한다.
> "달무티를 참조했다"는 분위기가 드러나면 안 된다.

---

## 1. 핵심 컨셉

- 각자 카드를 나눠 갖고, 자기 차례에 **같은 숫자 묶음**을 내며 손패를 비운다.
- **먼저 비운 순서 = 그 판의 순위.**
- 여러 판을 진행하고, **판별 순위를 모두 합산**해 **합이 가장 낮은 사람이 최종 우승**.
- 옵션으로 **페널티(순위 기반 카드 교환)** 를 켜면 전략 깊이가 생긴다.

---

## 2. 카드 구성

### 2.1 덱 (인원에 따라 최고 숫자 가변)

- 숫자 카드: 숫자값 = 그 숫자의 장수 (1이 1장, 2가 2장, … N이 N장).
- ★(스타) 카드: 항상 **2장** (와일드).
- **낮은 숫자가 강하다.** `1`이 최강.

| 인원 | 최고 숫자 N | 숫자 카드 합 | ★ | 총 장수 |
|---|---|---|---|---|
| **3~8명** | 12 | 78 | 2 | **80** |
| **9명 이상** | 13 | 91 | 2 | **93** |

- 근거: 9명에 80장이면 1인당 8.9장으로 손패가 얇아져 셰딩 재미가 줄어든다. 1~13(93장)이면 ~10.3장으로 회복된다.

### 2.2 ★(스타) 와일드 규칙

- **다른 카드와 함께** 내면 그 카드들의 숫자를 따르는 와일드. 예: `5 5 ★` = 5 트리플.
- **혼자** 내면 값 = **(최고 숫자 N + 1)**. 즉 12덱이면 ★혼자 = 13, 13덱이면 ★혼자 = 14. → 항상 최약체이고, 실제 13 카드와 충돌하지 않는다.
- "가장 좋은 카드"(페널티에서 자동 선택)를 따질 때 ★는 최약체로 취급.

### 2.3 분배

- **인원수 무관, 매 판 덱 전체를 한 장씩 다 돌린다.** 나누어떨어지지 않으면 일부 플레이어가 한 장 더 받는다(의도된 불공평, 공식 룰 차용). 별도 잉여 처리 없음.
- 카드가 남으면 **앞 순서(상위 순위)부터** 한 장 더 받는다.

---

## 3. 판 진행 흐름 (phase)

서버 권위. phase는 `draw → tax → play → handEnd` 순환.

### 3.1 `draw` (첫 판만)

- 전원에게 카드 1장을 랜덤 배정해 **공개**한다.
- **낮은 숫자 = 높은 순위(1등).** 동점이면 동점자끼리 **재추첨**.
- 이 결과로 **첫 판 서열**을 확정하고 `tax`(페널티 ON) 또는 `play`로 전이.

### 3.2 `tax` (페널티 옵션 ON일 때만)

- 직전 판 순위(첫 판은 draw 결과) 기준으로 카드 교환을 수행한다. (상세: §4)
- 페널티 OFF면 이 phase를 건너뛴다.

### 3.3 `play` (셰딩)

- **리드 플레이어**가 같은 숫자 묶음(싱글/페어/트리플/…)을 낸다. 첫 트릭의 리드는 **1등**.
- 다음 사람부터 시계방향으로 각자 자기 차례에:
  - **같은 장수**의 묶음을 **더 낮은 숫자**로 내거나,
  - **패스**.
- **패스해도 탈락이 아니다.** 다음 차례가 돌아오면 다시 낼 수 있다.
- **전원이 연속으로 패스**하면 그 트릭 종료. 나온 카드는 버려지고, **마지막으로 낸 사람이 새 리드**.
- 손패를 **먼저 비운 순서대로 순위** 확정. 마지막까지 남은 사람이 꼴찌.

### 3.4 `handEnd`

- 이번 판 순위·누적 점수를 표시.
- 남은 판이 있으면 → 다음 판(서열 재배치 후 `tax`/`play`).
- 정한 판 수를 다 채웠거나 조기종료 투표가 성사되면 → **최종 결과(results)**.

---

## 4. 페널티 (옵션) — 순위 기반 카드 교환

매 판 시작 전(`tax` phase), 직전 판 순위(첫 판은 draw) 기준. **첫 판부터 적용한다.**

### 4.1 교환 쌍 (인원에 따라)

| 인원 | 교환 |
|---|---|
| **3~5명** | 꼴찌 → 1등에게 **best 2장**, 1등은 **임의 2장** 되돌려줌 (1쌍) |
| **6명 이상** | 위 + 뒤에서 2등 → 2등에게 **best 1장**, 2등은 **임의 1장** 되돌려줌 (2쌍) |

- **주는 쪽(하위)은 무조건 best 카드 자동 선택**, **받는 쪽(상위)은 자유 선택**으로 같은 장수만큼 되돌려준다 → 손패 장수 균형 유지.
- 모든 교환은 동시에 일어난다.

### 4.2 인터랙션

- 하위(주는 쪽): best 카드는 서버가 자동 산정 → **별도 입력 없음**.
- 상위(받는 쪽): **되돌려줄 카드 N장을 직접 선택**해야 `play`로 진행. (양쪽 상위가 다 고를 때까지 대기)

---

## 5. ★ 특수효과 — "역전 선언" (페널티 옵션 ON일 때만)

공식 Revolution/Greater Revolution 규칙을 그대로 차용(테마만 제거).

`tax` 직전, **★ 2장을 한 사람이 모두** 보유하고 있으면:

- **일반 플레이어**가 둘 다 보유 → **"역전" 선언 시 이번 판 페널티 전면 취소**(교환 없음).
- **꼴찌**(가장 큰 페널티를 낼 사람)가 둘 다 보유 → **"대역전" 선언 시**: 페널티 취소 + **서열 완전 역전** (기존 1등↔꼴찌, 2등↔뒤2등 … 통째로 뒤집힘). 역전된 서열이 이번 판 리드/순위 기준이 된다.
- ★ 2장이 **서로 다른 두 사람에게 흩어져 있으면 효과 없음** (한 손에 둘 다 있어야 함 — 공식 룰).
- **선언은 선택**. 보유자가 원치 않으면 일반 페널티 진행.

---

## 6. 옵션 (게임 시작 시 호스트 설정)

로비 단계에서 `room:selectGame`의 `options`로 전달 → 서버 `start()`에서 수신. (kinggame식 in-game configure 미사용)

```ts
type UpstageOptions = {
  penalty: boolean;   // 기본 false — "계급 없는 기본 룰"
  totalHands: number; // 1~10, 기본 5
};
```

- `penalty`: ON이면 §4·§5 활성화.
- `totalHands`: 진행할 판 수.

---

## 7. 중도 종료 (조기 종료 투표)

- 정한 판 수를 다 채우기 전, **호스트가 "게임 종료" 투표를 발의**할 수 있다.
- 발의 시 **접속 중인 전원에게 찬/반 투표**. **과반 찬성**(접속 인원의 50% 초과)이면 성사.
- 성사 시 **현재 진행 중인 판은 즉시 무효**(점수 미반영). **직전까지 완료된 판들의 순위 합산**으로 최종 결과.
- 부결 시 게임 속행. (재발의는 다음 판에서 가능 — 한 판 1회 제한)

---

## 8. 최종 우승

- 완료된 모든 판의 **순위를 합산**. **합이 가장 낮은 사람이 우승.**
- 동점 시 공동 우승.
- `GameResult.ranking`은 누적 점수(=순위합) 오름차순, `scoreDelta`에 이번 게임 총합 기록.

---

## 9. 기술 설계

### 9.1 서버 (`server/src/games/upstage/`)

- `UpstageModule.ts` — `GameModule<UpstageOptions, UpstagePublicState, UpstagePrivateState>` 구현. 얇은 어댑터.
- `upstageCore.ts` — 실제 규칙 엔진(테스트 대상). 덱 생성·셔플·딜·합법수 검증·순위·★효과·페널티·점수.
- **권위·비밀 분리**:
  - 랜덤은 주입된 seed 기반 `Randomizer`만 사용(테스트 재현성).
  - **각자 손패는 `getStateFor(playerId)`로만** 전달. `getPublicState()`에는 **각 플레이어의 손패 장수만**(카드 내용 금지), 현재 phase/리드/턴/순위/점수/마지막 플레이 묶음.
  - ★ 보유 여부도 본인에게만(`getStateFor`), 공개 상태에 노출 금지.
- **검증**: 모든 액션 payload 서버 parse + 검증(카드 소유권, 같은 숫자 묶음인지, 장수·숫자 규칙, 턴/리드 권한). 클라가 보낸 값 불신.
- **권한 게이팅**: 턴 전용은 `playerId === 현재 턴`, 종료 투표 발의는 `isHost`.
- `onPlayerRemoved`: 추방된 플레이어의 손패·순위·턴 흔적을 public state에서 깔끔히 제거(유령 금지). 진행 중 판은 남은 인원으로 계속.
- `supportsJoinInProgress: false` (catalog) — 판 도중 합류 없음.

### 9.2 액션 (game:action)

```
upstage:play       { cards: CardId[] }      // 묶음 내기 (턴)
upstage:pass       {}                        // 패스 (턴)
upstage:taxReturn  { cards: CardId[] }       // 상위가 되돌려줄 카드 선택 (tax)
upstage:declare    { kind: "revolt" | "none" } // ★ 보유자 역전/대역전 선언 (tax 직전)
upstage:nextHand   {}                        // handEnd → 다음 판 (host)
upstage:proposeEnd {}                        // 조기종료 투표 발의 (host)
upstage:voteEnd    { agree: boolean }        // 투표 (전원)
```

액션 문자열 상수는 `shared/src/games/upstage.ts`의 `UPSTAGE_ACTIONS`로 export.

### 9.3 공유 타입 (`shared/src/games/upstage.ts`)

- `UpstageOptions`, `defaultUpstageOptions`
- `UpstageCard = { id: string; value: number | "star" }`
- `UpstagePhase = "draw" | "tax" | "play" | "handEnd" | "ended"`
- `UpstagePublicState`, `UpstagePrivateState`
- 액션 payload 타입 + `UPSTAGE_ACTIONS` 상수
- 바운드 상수: `UPSTAGE_HANDS_MIN=1`, `UPSTAGE_HANDS_MAX=10`, `UPSTAGE_HANDS_DEFAULT=5`
- `shared/src/index.ts`에 `export * from "./games/upstage";` 추가.

### 9.4 클라이언트

- `client/src/games/upstage/UpstageGameScreen.tsx` — `GameScreenProps` 사용.
  - 텍스트 전부 i18n(`useT`), 색/폰트/간격 토큰만, 플레이어 아이콘 `AvatarImg`.
  - 손패: 가로 부채꼴, 숫자 오름차순 정렬, 묶음 선택(멀티 셀렉트) → play/pass. 최대 ~27장(3인 80장) 대응.
  - phase별 UI: draw(공개 애니메이션), tax(되돌릴 카드 선택/★선언 모달), play(보드+손패+턴 표시), handEnd(순위·누적표), 종료투표(찬/반 모달).
- `client/src/design/games.ts` — `GAME_META.upstage = { glyph: "♠", accent: "gold", min: 3, max: 99 }` + `GAME_ORDER`에 추가.
- `client/src/i18n/index.ts` — ko·en에 `game.upstage`, `gametag.upstage`, 그리고 화면 내 모든 텍스트 키.
- `client/src/games/registry.tsx` — `GAME_SCREENS`에 `upstage: UpstageGameScreen` 한 줄.
- CSS: `client/src/app/app.css`에 `.scr--upstage` cyber 레이아웃, `client/src/design/terminal.css`의 cozy 블록에 `[data-theme="cozy"] .scr--upstage ...` 오버라이드.
- 상태/에러는 `states.tsx` 재사용(새 kind 필요 시 추가).

### 9.5 카탈로그/도메인

- `shared/src/schema/domain.ts` — `GameId`에 이미 `"upstage"` 존재.
- `shared/src/games/catalog.ts` — 기존 upstage 항목을 `status: "available"`로 바꾸고 `defaultOptions: defaultUpstageOptions`, `minPlayers: 3`, `supportsJoinInProgress: false`, `complexity: 3` 유지.
- `server/src/games/registry.ts` — `["upstage", () => new UpstageModule()]` 등록 + import.

### 9.6 표시 메타 제안

- 이름: ko "업스테이지" / en "Upstage"
- 태그라인: ko "먼저 털어내고 위로 올라서라" / en "Shed first, rise to the top" (구현 시 다듬기)
- glyph `♠`, accent `gold`, min 3, 권장 4~8명, max 무제한.

---

## 10. 테스트 (`server/tests/`)

- 봇 테스트: 3·6·9명이 한 판~여러 판을 끝까지 도는지(페널티 ON/OFF 각각).
- 합법수 검증: 같은 숫자 묶음/장수/낮은 숫자 규칙, 잘못된 play 거부.
- ★ 와일드: `5 5 ★`가 5 트리플로 인정, ★단독 = N+1 최약체.
- 페널티: 3~5명 1쌍 / 6명+ 2쌍, best 자동 선택 + 임의 되돌림으로 손패 장수 보존.
- 역전/대역전: 한 손 ★2장 선언 시 페널티 취소(+꼴찌면 서열 역전), 흩어지면 무효.
- 덱 스케일: 8명=12덱(80장), 9명=13덱(93장).
- 점수: 판별 순위 합산, 최저합 우승.
- 조기종료 투표: 과반 성사 시 현재 판 무효 + 직전까지 합산.
- 추방(`onPlayerRemoved`): 유령 흔적 없음.

---

## 11. 완료 기준 (§ 프로젝트 CLAUDE.md)

- 색/폰트/간격 토큰만, `.scr--upstage` 스코프, **cozy 오버라이드 직접 확인**.
- 텍스트 i18n(ko·en) 양쪽, `AvatarImg(themeId)`.
- 규칙/검증/비밀/랜덤 **서버에만**.
- `GAME_SCREENS` 등록(App.tsx 직접 분기 X).
- `corepack pnpm -r typecheck` + 서버 테스트 통과.
- **2 테마 × 2 언어 + `/_states`** 확인.
