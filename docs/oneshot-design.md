# OneShot (원샷) — 술/파티 게임 허브 제품·기술 설계서

---

## 0. 한 줄 정의

**OneShot(원샷)** 은 친구들이 한 **파티 방**에 모여 여러 술/파티 게임을 바꿔가며 즐기는 웹 우선 캐주얼 게임 허브다.

---

## 1. 문서 범위

이 문서는 OneShot의 제품 범위, 기술 스택, 앱 폴더 구조, 배포 단위, 도메인 스키마, 통신 계약, 게임 모듈 구조, QA 기준을 정의한다.

실제 제품 코드는 `apps/oneshot/` 안에 작성한다. 루트의 `Python/`, `dalmuti/`, `Android/` 등은 배포 대상 앱 소스에 포함하지 않는다.

---

## 2. 제품 정체성 & 목표

| 항목 | 결정 |
|---|---|
| 정체성 | 친구끼리 노는 캐주얼 술/파티 게임 도구 |
| 1순위 성공 기준 | 실제 모임에서 설치·가입·설명 없이 잘 굴러가는가 |
| 플레이 상황 | 원격/같은 공간 모두 지원. 설계 기준은 원격, 같은 공간은 QR/코드로 흡수 |
| 핵심 단위 | **지속되는 파티 방**. 방 안에서 게임을 갈아끼움 |
| 수익화 | MVP 비범위. 광고/IAP/코인/배팅 없음 |
| UI 기조 | 게임별 디자인을 새로 만들지 않고 공유 UI 키트로 조립 |

**공유 UI 키트 운영 방식:** 디자인 토큰과 공유 UI 컴포넌트를 허브 공통 레이어에 정의하고, 각 게임 화면은 해당 컴포넌트를 조립해서 만든다.

---

## 3. 저작권 주의사항

- 기존 게임의 상표명, 로고, 캐릭터명, 계급명, 카드 일러스트, 룰북 문장은 사용하지 않는다.
- 게임 규칙을 설명할 때 기존 룰북 문장을 복사하지 않고 자체 문장으로 작성한다.
- Upstage는 자체 게임명, 자체 카드 명칭, 자체 아트, 자체 룰 설명을 사용한다.
- OneShot 허브 안에서 외부 게임을 참조해야 할 때는 비교 설명용 일반 문장만 사용하고, 공식 명칭·아트·문장 표현을 제품 UI/콘텐츠 자산으로 사용하지 않는다.

---

## 4. 플랫폼 전략

**웹 우선 출시 → Capacitor 앱 래핑 → 앱 전용 기능 추가.**

| 영역 | 결정 |
|---|---|
| 프론트엔드 | React + Vite + TypeScript |
| 클라이언트 상태 | Zustand |
| 실시간 백엔드 | Colyseus + Node.js + TypeScript |
| 패키지 매니저 | pnpm |
| 앱화 | Capacitor로 같은 웹 코드를 iOS/Android 래핑 |
| 배포 | Oracle Cloud 무료 인스턴스 우선. 단일 Node 서버 + 정적 클라이언트 서빙 또는 Caddy/Nginx 프록시 |

플랫폼 운영 규칙:

- MVP는 웹 브라우저에서 방 생성·입장·게임 진행이 가능해야 한다.
- 앱 빌드는 웹 MVP 이후 Capacitor로 구성한다.
- 카드 배분, 턴 검증, 비밀 역할, 승패 판정은 Colyseus 서버에서 처리한다.
- 클라이언트는 React/Vite 앱 하나를 기준으로 웹과 앱 래핑에서 공유한다.

### 4.1 참여 방식

1. **링크 공유**: `https://oneshot.example/r/<roomCode>`
2. **방 코드 입력**: 4~6자리 대문자/숫자. 혼동 문자는 제외한다.
3. **QR 코드**: 방장 화면 QR을 카메라로 스캔하면 즉시 입장한다.

### 4.2 근접 자동감지

- iOS 근접 감지는 Multipeer Connectivity를 사용한다.
- Android 근접 감지는 Nearby Connections를 사용한다.
- iOS Multipeer Connectivity와 Android Nearby Connections는 서로 직접 호환되지 않는다.
- 근접 자동감지는 Capacitor 앱 빌드 이후 앱 전용 기능으로 분류한다.

---

## 5. 리포지토리·배포 구조

### 5.1 원칙

**실제 배포해야 하는 앱은 `apps/oneshot/` 하나로 격리한다.**  
루트의 문서, 과거 프로토타입, SDK, 실험 코드는 배포 아티팩트에 들어가면 안 된다.

```
oneshot/
  docs/
    oneshot-design.md
    games/
      upstage.md
      kinggame.md

  apps/
    oneshot/                 # 실제 제품 루트. 배포는 이 폴더만 대상으로 한다.
      package.json
      pnpm-workspace.yaml
      tsconfig.base.json
      .env.example
      .gitignore

      client/                # React + Vite
        src/
          app/
          config/
          transport/
          design/
          ui-kit/
          lobby/
          room/
          games/
            kinggame/
            upstage/
        public/
        index.html
        vite.config.ts

      server/                # Colyseus + Node
        src/
          config/
          rooms/
            PartyRoom.ts
          games/
            GameModule.ts
            registry.ts
            kinggame/
            upstage/
          core/
          transport/
          bots/
          index.ts
        tests/

      shared/                # client/server 공유 타입과 상수
        src/
          schema/
          protocol/
          games/
          index.ts

      e2e/                   # Playwright 다중 클라이언트 테스트
      ops/                   # Dockerfile, compose, deploy notes

  prototypes/
    python/                  # 기존 Python 프로토타입을 옮길 위치
    flutter-dalmuti/         # 기존 dalmuti Flutter 프로토타입을 옮길 위치
```

현재 리포지토리의 `Python/`, `dalmuti/`, `Android/`는 새 앱의 소스가 아니다. 정리 단계에서 `prototypes/` 또는 외부 보관소로 이동하고, `apps/oneshot` 코드가 이 폴더들을 import하지 않도록 한다.

### 5.2 배포 기준

- 배포 소스 루트: `apps/oneshot/`
- 서버 진입점: `apps/oneshot/server/src/index.ts`
- 클라이언트 빌드 결과: `apps/oneshot/client/dist`
- 공유 패키지: `apps/oneshot/shared`
- 운영 산출물: `apps/oneshot/ops`

배포 파이프라인은 다음 파일만 기준으로 판단한다.

```
apps/oneshot/package.json
apps/oneshot/pnpm-lock.yaml
apps/oneshot/client/
apps/oneshot/server/
apps/oneshot/shared/
apps/oneshot/ops/
```

루트의 `README.md`, `docs/`, `prototypes/`, `Android/` 등은 배포 입력이 아니다.

---

## 6. 개발 환경 세팅 기준

### 6.1 런타임·도구

| 도구 | 기준 |
|---|---|
| Node.js | LTS 버전 |
| pnpm | workspace 사용 |
| TypeScript | strict 모드 |
| 테스트 | Vitest + Playwright |
| 린트/포맷 | ESLint + Prettier |
| 서버 실행 | tsx/dev, 빌드는 tsup 또는 tsc |

### 6.2 필수 스크립트

`apps/oneshot/package.json`에는 최소한 다음 스크립트를 둔다.

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:client": "pnpm --filter @oneshot/client dev",
    "dev:server": "pnpm --filter @oneshot/server dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @oneshot/e2e test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  }
}
```

### 6.3 환경변수

모든 환경변수는 `config` 모듈만 읽는다. 코드에서 `process.env.X` 또는 `import.meta.env.X`를 직접 참조하지 않는다.

서버 `.env.example`:

```bash
NODE_ENV=development
SERVER_HOST=0.0.0.0
SERVER_PORT=2567
PUBLIC_ORIGIN=http://localhost:5173
ROOM_CODE_LENGTH=5
ROOM_CODE_ALPHABET=ABCDEFGHJKLMNPQRSTUVWXYZ23456789
SESSION_SECRET=dev-only-change-me
COLYSEUS_RECONNECT_WINDOW_SECONDS=86400
EMPTY_ROOM_TTL_SECONDS=3600
```

클라이언트 `.env.example`:

```bash
VITE_PUBLIC_ORIGIN=http://localhost:5173
VITE_WS_URL=ws://localhost:2567
VITE_API_URL=http://localhost:2567
```

시크릿 원칙:

- 레포에는 `.env.example`만 커밋한다.
- 실제 `.env`는 커밋 금지.
- 개인/배포 시크릿은 로컬 규칙에 따라 외부 시크릿 파일 또는 서버 환경변수로 주입한다.
- `config`는 zod 등으로 타입 검증하고, 누락 시 서버 부팅을 실패시킨다.

---

## 7. 아키텍처 원칙

1. **단일 책임 · 폴더 격리**  
   각 기능(로비, 조인, 방, 게임, transport, config, ui-kit)은 자기 폴더에 둔다.

2. **인터페이스로만 통신**  
   모듈 간 의존은 공개 계약을 통해서만 한다. 다른 모듈의 내부 파일을 직접 import하지 않는다.

3. **권위 서버**  
   카드 배분, 턴 검증, 비밀 역할, 정답, 승패는 서버만 결정한다. 클라이언트는 UI와 사용자 입력만 담당한다.

4. **비밀정보 최소 전송**  
   서버는 `getStateFor(playerId)` 결과만 클라이언트에 보낸다. 다른 플레이어의 패/역할/정답은 절대 내려보내지 않는다.

5. **교체 가능성**  
   Colyseus, QR 라이브러리, 디자인 테마, 저장소는 인터페이스 뒤에 둔다. 구현은 하나만 만든다.

6. **YAGNI**  
   미래 게임을 위해 경계는 잡되, 대체 구현과 복잡한 플러그인 시스템은 미리 만들지 않는다.

7. **재접속 우선**  
   모바일 웹에서는 백그라운드 전환만으로 소켓이 끊길 수 있다. 끊김은 나감이 아니다.

8. **사람이 게임을 해결한다**  
   시스템은 턴을 자동 스킵하거나 플레이어를 자동 추방하지 않는다. 방장만 수동으로 개입한다.

---

## 8. 핵심 도메인 모델

### 8.1 PartyRoom

PartyRoom은 게임 규칙을 모른다. PartyRoom은 사람, 방, 현재 게임, 호스트 권한, 재접속만 관리한다.

```ts
type RoomPhase = "lobby" | "game" | "results";

type PartyRoomState = {
  roomId: string;
  roomCode: string;
  phase: RoomPhase;
  hostPlayerId: string;
  temporaryHostPlayerId: string | null;
  players: Record<PlayerId, PublicPlayerState>;
  activeGame: ActiveGameState | null;
  catalog: GameCatalogItem[];
  createdAt: number;
  updatedAt: number;
};

type ActiveGameState = {
  gameId: GameId;
  startedAt: number;
  publicState: unknown;
  result: GameResult | null;
};
```

### 8.2 Player

```ts
type PlayerId = string;
type SessionId = string;

type ConnectionStatus = "online" | "reconnecting" | "offline";

type PublicPlayerState = {
  id: PlayerId;
  nickname: string;
  avatarKey: string;
  seatIndex: number;
  isHost: boolean;
  connectionStatus: ConnectionStatus;
  joinedAt: number;
  lastSeenAt: number;
};

type PrivatePlayerSession = {
  playerId: PlayerId;
  sessionId: SessionId;
  reconnectTokenHash: string;
  roomId: string;
  createdAt: number;
  lastSeenAt: number;
};
```

`PrivatePlayerSession`은 서버 내부 전용이다. 클라이언트에는 `reconnectToken` 원문만 localStorage/sessionStorage에 저장한다.

### 8.3 Game Catalog

```ts
type GameId = "kinggame" | "upstage" | "liar" | "fool-liar" | "arithmetic";

type GameCatalogItem = {
  id: GameId;
  title: string;
  minPlayers: number;
  maxPlayers: number;
  complexity: 1 | 2 | 3;
  supportsJoinInProgress: boolean;
  defaultOptions: Record<string, unknown>;
};
```

---

## 9. GameModule 계약

새 게임은 서버 `GameModule`과 클라이언트 화면을 각각 등록한다.

```ts
type GameAction = {
  type: string;
  payload?: unknown;
  clientActionId: string;
};

type GameResult = {
  ranking: Array<{
    playerId: PlayerId;
    rank: number;
    scoreDelta?: number;
  }>;
  winnerPlayerIds: PlayerId[];
  summary: string;
};

type ActionResult =
  | { ok: true; events?: GameEvent[] }
  | { ok: false; code: ErrorCode; message: string };

type GameEvent = {
  type: string;
  payload?: unknown;
};

interface GameModule<TOptions, TPublicState, TPrivateState> {
  readonly id: GameId;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  start(input: {
    players: PublicPlayerState[];
    options: TOptions;
    randomSeed: string;
  }): void;

  handleAction(input: {
    playerId: PlayerId;
    action: GameAction;
  }): ActionResult;

  getPublicState(): TPublicState;
  getStateFor(playerId: PlayerId): TPrivateState;
  onPlayerLeave(playerId: PlayerId): void;
  onPlayerReturn(playerId: PlayerId): void;
  isOver(): GameResult | null;
}
```

규칙:

- `GameModule`은 순수 게임 규칙에 집중한다.
- 네트워크, QR, React, DOM, localStorage를 알면 안 된다.
- 랜덤은 주입된 seed 기반 `Randomizer`만 사용한다.
- 서버 테스트에서 봇 플레이를 돌릴 수 있어야 한다.

---

## 10. Transport 계약

클라이언트는 Colyseus를 직접 import하지 않는다.

```ts
type ClientToServerMessage =
  | { type: "room:updateNickname"; nickname: string }
  | { type: "room:selectGame"; gameId: GameId; options?: Record<string, unknown> }
  | { type: "room:startGame" }
  | { type: "room:kickPlayer"; playerId: PlayerId }
  | { type: "game:action"; action: GameAction };

type ServerEvent =
  | { type: "room:state"; state: PartyRoomState }
  | { type: "game:privateState"; state: unknown }
  | { type: "error"; code: ErrorCode; message: string; retryable: boolean };

type JoinResult = {
  roomId: string;
  roomCode: string;
  playerId: PlayerId;
  reconnectToken: string;
};

interface RoomTransport {
  createRoom(input: { nickname: string }): Promise<JoinResult>;
  joinByCode(input: { roomCode: string; nickname: string }): Promise<JoinResult>;
  joinByLink(input: { roomCode: string; nickname?: string }): Promise<JoinResult>;
  reconnect(input: { reconnectToken: string }): Promise<JoinResult>;
  send(message: ClientToServerMessage): void;
  onEvent(handler: (event: ServerEvent) => void): () => void;
  leave(): Promise<void>;
}
```

`ColyseusRoomTransport` 하나만 구현한다. 교체 가능성은 인터페이스로 확보하고, 다른 transport는 미리 만들지 않는다.

---

## 11. 공통 서버 모듈

| 모듈 | 역할 | 쓰는 게임 |
|---|---|---|
| TurnManager | 턴 순서, 패스, 현재 턴 | Upstage, 사칙연산 |
| SecretDealer | 비밀 배정, 개인 상태 마스킹 | Upstage, 라이어, 바보라이어, 왕게임 |
| PhaseMachine | 페이즈 전환 | 라이어, 바보라이어, Upstage |
| Voting | 투표 집계 | 라이어, 바보라이어 |
| Randomizer | seed 기반 랜덤 | 전체 |
| ResultRanking | 결과/순위 표준화 | 전체 |
| ReconnectManager | 세션 토큰, 복귀 처리 | 전체 |
| RoomCodeGenerator | 짧은 코드 생성/충돌 방지 | 로비/방 |

---

## 12. 방 수명주기 정책

**대원칙: 시스템은 자동으로 스킵·추방하지 않는다. 사람만 개입한다.**

- 턴 타이머 없음. 그 사람 턴이면 무기한 대기한다.
- 알림바 내리기, 다른 앱 보기, 화면 잠깐 끔은 정상 상황이다.
- 실제 소켓이 끊겨도 "나감"으로 처리하지 않고 `reconnecting/offline` 상태만 표시한다.
- 재접속 토큰으로 돌아오면 같은 `playerId`, 같은 좌석, 같은 패/역할로 복원한다.
- 방장이 수동 추방하면 그때 게임 모듈의 `onPlayerLeave` 정책을 실행한다.
- 방장이 끊기면 가장 오래된 online 멤버가 임시 방장이 된다.
- 원 방장이 복귀하면 방장 권한은 원 방장에게 자동 반환된다.
- 빈 방은 모든 플레이어가 사라진 뒤 `EMPTY_ROOM_TTL_SECONDS`가 지나면 서버 메모리에서 정리한다.

MVP는 서버 재시작 후 방 복구를 보장하지 않는다. 서버 재시작 내구성이 필요해지는 시점에 `RoomStore` 인터페이스 뒤에 SQLite/Postgres를 붙인다.

---

## 13. 게임 카탈로그와 출시 순서

| 순서 | 게임 | 목적 | 구현 난이도 |
|---:|---|---|---:|
| 1 | 왕게임 | 방→게임→결과→방 복귀 전체 루프 검증 | 1 |
| 2 | Upstage | 패 숨김, 턴 검증, 재접속, 복잡 규칙 검증 | 3 |
| 3 | 라이어 | SecretDealer + Voting 검증 | 2 |
| 4 | 바보라이어 | 라이어 변형/config 공유 검증 | 1 |
| 5 | 사칙연산 | 빠른 턴제 액션 검증 | 2 |

### 13.1 왕게임 MVP

목표는 게임 재미보다 인프라 검증이다.

- 방장이 게임 선택
- 참가자에게 번호/역할 랜덤 배정
- 왕 공개
- 왕이 대상/미션 선택
- 결과 확인 후 방으로 복귀

### 13.2 Upstage 기준 규칙

- 카드 `1..N`, 숫자 K 카드는 K장 존재한다.
- 조커는 0~4장, 제출 시 특정 숫자로 선언되는 와일드다.
- 시작 플레이어가 같은 숫자 카드 세트를 낸다.
- 다음 플레이어는 **같은 수량**의 **더 낮은 숫자** 세트를 내거나 패스한다.
- 모두 패스하면 마지막 제출자가 새 트릭을 시작한다.
- 먼저 패를 다 비우면 라운드 순위가 확정된다.
- 모든 카드/조커 검증은 서버에서만 한다.

---

## 14. 클라이언트 화면 범위

MVP 필수 화면:

1. 홈/로비: 방 만들기, 코드 입력, 링크 입장 처리
2. 닉네임 입력: 첫 입장 또는 닉네임 없음
3. 방 화면: 멤버, 방 코드, QR, 게임 선택, 시작 버튼, 추방
4. 게임 화면: 현재 게임별 UI
5. 결과 화면: 순위/요약, 방으로 돌아가기
6. 오류 화면: 방 없음, 만료, 재접속 실패, 서버 연결 실패

공유 UI 키트:

- Button, IconButton, TextField, Dialog, Toast
- PlayerList, PlayerBadge, HostBadge, ConnectionBadge
- RoomCode, QRPanel, GameCard, GameCatalog
- ActionBar, PhaseBanner, ResultTable

디자인 원칙:

- 모바일 세로 화면을 1순위로 한다.
- 같은 공간에서 방장 폰 하나를 여러 명이 보는 상황도 고려해 QR/코드는 크게 보인다.
- UI는 카드 남발 없이 정보 밀도를 유지한다.
- 게임 화면의 주요 액션은 엄지 영역 하단에 둔다.
- 색/간격/타이포/라운드는 `design/tokens`에서만 가져온다.

---

## 15. 서버 API와 라우팅

HTTP는 방 생성/헬스체크/정적 파일에만 쓴다. 게임 진행은 WebSocket/Colyseus 메시지로 처리한다.

| Method | Path | 목적 |
|---|---|---|
| GET | `/healthz` | 서버 상태 확인 |
| GET | `/r/:roomCode` | 클라이언트 앱 서빙. 라우팅은 React가 처리 |
| POST | `/api/rooms` | 방 생성 후 roomCode 반환 |
| GET | `/api/rooms/:roomCode/summary` | 입장 전 방 존재/상태 확인 |

Colyseus room:

- room name: `party`
- join option: `{ roomCode, nickname, reconnectToken? }`
- messages: `ClientToServerMessage`

---

## 16. 오류 코드

```ts
type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_EXPIRED"
  | "INVALID_NICKNAME"
  | "HOST_ONLY"
  | "GAME_NOT_FOUND"
  | "GAME_ALREADY_RUNNING"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_ACTION"
  | "NOT_YOUR_TURN"
  | "RECONNECT_FAILED"
  | "SERVER_ERROR";
```

오류는 사용자 메시지와 개발자 로그를 분리한다. 클라이언트에는 짧고 복구 가능한 메시지를 보여준다.

---

## 17. QA 기준

### 17.1 단위 테스트

- `GameModule`별 규칙 테스트
- Upstage 카드 제출 유효성
- 패스/트릭 종료/라운드 종료
- 왕게임 랜덤 배정 중복 없음
- RoomCode 충돌 처리
- config 누락 시 부팅 실패

### 17.2 봇 테스트

- 2~10명 봇이 왕게임 100회 완료
- 2~10명 봇이 Upstage 라운드 100회 완료
- 무작위 접속 끊김/복귀에도 서버가 크래시하지 않음

### 17.3 E2E 테스트

- 방 생성 → QR/링크/코드 입장
- 방장만 게임 시작 가능
- 방장 끊김 → 임시 방장 승격 → 원 방장 복귀
- 게임 중 한 명 재접속 → 같은 자리/상태 복원
- 방장 추방 → 게임 상태가 깨지지 않음
- 결과 → 방 복귀 → 다른 게임 시작

### 17.4 수동 플레이테스트 체크리스트

- 모임 자리에서 설명 없이 1분 안에 전원 입장 가능한가
- iOS Safari, Android Chrome에서 QR/링크 진입이 자연스러운가
- 화면 꺼짐/앱 전환 후 같은 방·좌석·상태로 복귀되는가
- 술자리 소음/흔들림 상황에서도 버튼과 코드가 읽히는가
- 한 명이 장시간 반응하지 않을 때 방장이 해결할 수 있는가

---

## 18. MVP 범위

### 포함

- `apps/oneshot` 제품 루트 생성
- React/Vite/TS 클라이언트
- Colyseus/Node/TS 서버
- shared 타입 패키지
- 방 만들기/코드 입장/링크 입장/QR
- 닉네임 기반 익명 플레이
- 방장/임시 방장/수동 추방
- 재접속 토큰 기반 복귀
- 게임 레지스트리
- 왕게임
- 결과 후 방 복귀
- 기본 UI 키트와 디자인 토큰
- Vitest/Playwright 기본 테스트
- Oracle 단일 인스턴스 배포 문서

### 제외

- 계정/로그인
- 공개 방 목록
- 채팅
- 친구/초대장
- 광고/IAP/코인/배팅
- 앱스토어 출시
- iOS/Android 근접 자동감지
- DB 영속화
- 대규모 멀티 서버 스케일아웃
- 관리자 대시보드

---

## 19. 로드맵

### Phase 0 — 제품 루트와 걷는 해골

- `apps/oneshot` 모노레포 세팅
- client/server/shared 연결
- config/env 검증
- PartyRoom 생성/입장
- 기본 UI 키트
- 배포 단위 확인

### Phase 1 — 방 경험 완성

- 링크/코드/QR 입장
- 닉네임/좌석/멤버 목록
- 방장/임시 방장/추방
- 재접속
- 오류 처리

### Phase 2 — 왕게임

- GameModule 레지스트리
- 왕게임 서버 모듈
- 왕게임 클라이언트 화면
- 결과 후 방 복귀
- 봇/E2E 테스트

### Phase 3 — Upstage

- Upstage 룰 문서
- 카드/조커/턴/패스/트릭 서버 검증
- 개인 패 마스킹
- 라운드 결과/점수
- 재접속/추방 엣지 케이스

### Phase 4 — 라이어 계열과 사칙연산

- SecretDealer, Voting, PhaseMachine 재사용
- 라이어/바보라이어
- 사칙연산

### Phase 5 — 앱화와 운영 기능

- Capacitor 래핑
- 푸시/근접 감지 검토
- DB 영속화 여부 판단
- 공개 방/콘텐츠 팩/관리 기능 검토

---

## 20. 개발 원칙 체크리스트

새 기능을 추가할 때 다음 질문을 통과해야 한다.

- 이 코드는 `apps/oneshot` 안에 있는가?
- 배포에 필요 없는 루트/프로토타입 파일을 참조하지 않는가?
- config/env 접근은 `config` 모듈만 하는가?
- 게임 규칙은 서버 `GameModule`에서 검증하는가?
- 클라이언트가 비밀정보를 받을 가능성이 없는가?
- 모듈 내부 파일을 우회 import하지 않는가?
- 새 UI가 디자인 토큰과 ui-kit을 쓰는가?
- 모바일 세로 화면에서 버튼/텍스트가 겹치지 않는가?
- 재접속/방장 끊김/추방 상황을 고려했는가?
- 최소 단위 테스트 또는 E2E가 추가됐는가?

---

## 21. 구현 준비 완료 기준

이 문서 기준으로 구현을 시작하려면 다음이 먼저 끝나야 한다.

1. `apps/oneshot` 폴더 생성
2. pnpm workspace 구성
3. client/server/shared 기본 빌드 확인
4. `.env.example` 작성
5. `config` 모듈에서 env 검증
6. `PartyRoomState`, `GameModule`, `RoomTransport` 타입 생성
7. `pnpm lint`, `pnpm typecheck`, `pnpm test` 스크립트 동작

이 7개 항목을 구현 시작 전 준비 기준으로 사용한다.
