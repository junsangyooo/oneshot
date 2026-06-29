# 왕게임 (King Game) — 설계·구현 스펙

OneShot 파티 허브의 첫 정식 게임. 친구들이 한 방에 모여 매 턴 각자 폰에 **왕 1명 + 숫자(1..N−1)** 카드를 비밀로 받고, 왕이 숫자를 호명해 명령을 내리는 술/파티 게임.

> 핵심 불변식(프로젝트 CLAUDE.md §3)을 그대로 따른다: **2 테마(cyber·cozy) × 2 언어(ko·en)** 가 항상 함께 동작한다.
> 이 문서는 구현 기준 commit `ff00636`(게임 추가 정규화 + 버그 수정) 위에서 작성됐다.

---

## 1. 모드 (셋업에서 방장이 선택)

| 모드 | 동작 |
|---|---|
| **자유 (free)** | 매 턴 카드만 배정. 왕이 "다음 턴"을 누르면 재배정. 미션/공개 없음 |
| **랜덤·순한맛 (mild)** | 매 턴 순한맛 프리셋 풀에서 랜덤 미션. 성적/스킨십 0, 유쾌·민망 위주 |
| **랜덤·매운맛 (spicy)** | 동일하되 매운맛 풀. 성인 전제 최대 수위(안전선 내) |
| **랜덤·커스텀 (custom)** | 방장이 프리셋 칩 + 직접 입력으로 풀을 구성. 이후 로직은 mild/spicy와 동일 |

미션은 **1인 대상**과 **2인 대상** 두 종류가 있다. 매 턴 가능한 미션 중 랜덤으로 뽑힌다.

---

## 2. 게임 흐름 (모듈 내부 phase)

```
start()  → phase "setup"
  └ 방장이 모드 선택(+커스텀이면 풀 구성) → kinggame:configure
phase "command"   ← 카드 배정(왕 1 + 숫자 1..N−1, 겹치지 않게)
  · free            : 왕에게 "다음 턴" 버튼
  · mild/spicy/custom: 왕만 미션을 봄 → 번호 카드를 빈칸에 드래그/탭 → kinggame:reveal
phase "revealed"  (랜덤 모드 전용)
  · 대상자 폰: revealAt 기준 3초 "당신의 번호를 밝히세요!" → 미션 전문 공개
  · 그 외: 대기 → 미션 전문 공개
  · 왕: "다음 턴"
turn loop : kinggame:nextTurn → 재배정(새 왕·새 숫자) → "command"
종료      : kinggame:endGame(방장) → 중립 결과 → 방이 results 로 전환
```

- **턴 진행**(`nextTurn`)은 왕 또는 방장(이탈 복구용)이 가능.
- **셋업/종료**(`configure`/`endGame`)는 방장 전용.

---

## 3. 비밀정보·다국어 핵심 규칙

- **카드(왕/숫자)** 는 `getStateFor(playerId)` 로만 내려간다. `getPublicState()`(전원 브로드캐스트)에는 절대 넣지 않는다.
- **"미션은 왕만 본다"**: 랜덤 모드의 진행 중 미션(`pendingMission`)은 **왕의 `getStateFor` 에만, command phase 에만** 포함된다. `reveal` 후에야 public 의 `command` 로 공개된다.
- **언어**: 서버는 미션을 **문자열로 해석하지 않고** `missionId`(프리셋) 또는 `missionRaw`(커스텀 직접입력)만 보낸다. 각 클라이언트가 **자기 언어**로 `KING_MISSIONS` 팩에서 렌더한다. → 같은 방에서 ko 뷰어와 en 뷰어가 각자 언어로 본다.
- **3초 연출**: 서버는 `command.revealAt`(epoch ms)만 보낸다. 클라가 **자기 시계 기준으로 로컬 3초 카운트**(`KING_REVEAL_DELAY_MS`)를 돌려 시계 오차에 안전하다.
- **테마**: 화면 레이아웃은 `.scr--king` 으로 스코프. cyber 기본은 `app/app.css`, cozy 오버라이드는 `design/terminal.css` 의 `[data-theme="cozy"] .scr--king`. 색·폰트·간격은 토큰만 사용. 플레이어 아이콘은 `<AvatarImg themeId>` (각자 자기 테마로 렌더).

---

## 4. 데이터 모델 (shared)

```ts
type KingGameMode = "free" | "mild" | "spicy" | "custom";

type KingGameCommand = {
  missionId?: string;   // 프리셋 → KING_MISSIONS 에서 언어별 렌더
  missionRaw?: string;  // 커스텀 직접입력 → 그대로 표시
  slots: number;        // 1 또는 2 (대상 인원)
  targets: { number: number; playerId: string }[];
  revealAt: number;     // 클라가 3초 연출을 로컬로 계산
};

type KingGamePublicState = {
  mode: KingGameMode | null; phase: "setup" | "command" | "revealed";
  round: number; kingPlayerId: string | null;
  availableNumbers: number[]; command: KingGameCommand | null;
  customMissionCount: number;
};

type KingGamePrivateState = {
  role: "king" | "subject"; number: number | null;
  pendingMission: { missionId?: string; missionRaw?: string; slots: number } | null; // 왕 전용
};

// 액션: kinggame:configure {mode, customMissions?} · kinggame:reveal {targetNumbers}
//       kinggame:nextTurn · kinggame:endGame
type KingCustomEntry = { kind: "preset"; missionId: string } | { kind: "custom"; text: string; slots: 1 | 2 };
```

미션 팩: `KingMission = { id, slots: 1|2, spice: "mild"|"spicy", ko, en }`, 토큰 `{A}`(첫 대상)/`{B}`(둘째 대상). 순한 22 + 매운 26 = **48개**, 각 ko·en. `renderMission()`/`parseMissionTemplate()` 헬퍼로 렌더·파싱.

---

## 5. 작은 인터페이스 변경

- `GameModule.handleAction` 컨텍스트에 `isHost: boolean` 추가. `PartyRoomCore.handleGameAction` 이 `playerId === effectiveHostPlayerId()` 로 계산해 전달. (임시 방장도 반영됨)
- 카탈로그 `kinggame.defaultOptions = {}` (모드는 인게임 configure). `maxPlayers`는 정규화에 따라 **무제한(null)** — 카드 1..N−1 이 큰 N 에도 스케일.

---

## 6. 변경 파일

- **shared**: `games/kinggame.ts`(재작성), `games/kingMissions.ts`(신규 팩+헬퍼), `index.ts`(배럴 export)
- **server**: `games/GameModule.ts`(isHost), `rooms/PartyRoomCore.ts`(isHost 전달), `games/kinggame/KingGameModule.ts`(재작성), `tests/KingGameModule.test.ts`(재작성)
- **client**: `app/App.tsx`(currentPlayerId 전달), `games/kinggame/KingGameScreen.tsx`(재작성), `app/app.css`(`.scr--king` cyber), `design/terminal.css`(cozy 오버라이드), `i18n/index.ts`(`king.*` ko·en)

---

## 7. 엣지 케이스

- **2인(숫자 1개)**: 2인 대상 미션 자동 제외(`slots ≤ availableNumbers.length`). 커스텀 풀은 1인 미션을 최소 1개 포함하도록 configure 단계에서 검증.
- **왕/플레이어 이탈**: 자동 스킵하지 않음(배정은 서버 메모리 유지, 재접속 시 복원). 막히면 **방장이 nextTurn** 으로 복구.
- **재접속**: `revealAt` 타임스탬프 기반이라 reveal 중 재접속해도 안전.

---

## 8. 검증

- `corepack pnpm -r typecheck` / `-r lint` 통과.
- `corepack pnpm --filter @oneshot/server test` — 왕게임 16개 포함 28개 통과(딜 불변식·셋업/호스트 게이팅·자유/랜덤/커스텀 흐름·비밀성·2인 엣지·endGame·봇 멀티턴).
- **완료 기준**: 실제 한 판 × **cyber·cozy × ko·en 4조합** + `/_states`.

## 9. 알려진 한계

- 시스템 에러 메시지·결과 summary 는 한국어 유지(전역 `ERROR_MESSAGES` 패턴과 동일). 바이링구얼은 **미션 텍스트에 한정**.
- 매운맛 콘텐츠는 성인 술게임 전제. 안전선(미성년자·강요·실제 위해·노골적 성행위 묘사 제외) 내에서 최대 수위.
