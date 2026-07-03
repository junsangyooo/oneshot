# OneShot (원샷)

> **친구들이 한 파티 방에 모여, 여러 술·파티 게임을 갈아끼우며 노는 웹 우선 실시간 게임 허브.**
> 방 코드(또는 링크/QR) 하나로 모이고, 방장이 게임을 골라 시작하고, 끝나면 다시 방으로 돌아와 다음 게임을 고른다.

🎮 **Live**: [oneshot.jsyoo.dev](https://oneshot.jsyoo.dev)

| | |
|---|---|
| ⚡ 실시간 멀티플레이 | Colyseus WebSocket 룸 · 재접속 토큰 복원 · 방장/임시방장/추방 |
| 🎨 2 테마 × 2 언어 | **cyber**(네온 터미널 HUD) · **cozy**(스토리북) × 한국어 · English — 항상 동시 동작 |
| 🔐 권위 서버 | 카드 배분·턴 검증·비밀 역할·승패는 서버만 결정. 클라는 UI·입력만 |
| 🧩 확장형 게임 허브 | `GameModule` 플러그인 구조 — 정해진 자리만 채우면 새 게임이 붙는다 |

> 실제 제품 코드는 **`apps/oneshot/`** 안에만 있다.
> 개발 규칙·**새 게임 추가 레시피**는 [`CLAUDE.md`](./CLAUDE.md)에 있다. 새 게임을 붙일 땐 CLAUDE.md를 먼저 읽는다.

---

## 🎲 게임 라이브러리

현재 **6종 플레이 가능**, 카탈로그(`shared/src/games/catalog.ts`) 기반으로 계속 늘어난다.

| | 게임 | 인원 | 난이도 | 한 줄 규칙 |
|---|---|---|---|---|
| ♔ | **왕게임** | 2+ | ★ | 왕이 번호를 지목해 미션을 시킨다. 4개 모드(자유·순한맛·매운맛·커스텀) + 바이링구얼 미션 팩 — 같은 방의 한국어/영어 유저가 각자 자기 언어로 미션을 읽는다 |
| ⛁ | **업스테이지** | 3+ | ★★★ | **낮은 숫자가 강한** 셰딩 게임. 같은 숫자 묶음을 더 낮게 내며 손패를 먼저 비운다. ★ 와일드 2장, 페널티 모드(세금 교환 + 역전 선언), 여러 핸드 등수 합산 |
| ◆ | **올아웃** | 2~16 | ★★★ | 색·숫자 매칭 셰딩 게임. +2/+4/+7 누적 공격, Shield/Reflect 방어, Exchange·Reverse·색변환. 파산 옵션, 9인 이상 더블 덱, 여러 라운드 등수 합산 |
| ⚄ | **주사위** | **1+** | ★ | 순수 운빨. 매 라운드 주사위 2개 합으로 순위 경쟁, 총 눈 합(pip) 타이브레이커. 혼자 운 시험하는 솔로 플레이도 가능 |
| ◎ | **라이어** | 3+ | ★★ | 모두 같은 제시어를 받고 라이어 1명만 모른다. 말로 토론해 라이어를 지목한다(앱은 단어만 비밀 유지) |
| ✕ | **바보 라이어** | 3+ | ★ | 라이어가 **자기가 라이어인 줄도 모르는** 변형. 라이어는 같은 카테고리의 다른 단어를 받는다 |
| ⌗ | 사칙연산 | 2+ | ★★ | 로드맵 (`coming_soon` — 카탈로그에 등록돼 있고 출시 시 status만 바꾼다) |

**모든 게임이 공유하는 시스템** (한 번 만든 패턴을 다음 게임이 물려받는다):

- **인게임 셋업 phase** — 게임 옵션(라운드 수·모드·페널티 등)은 로비가 아니라 게임 시작 직후 `setup` phase에서 방장이 고른다.
- **등수 합산 스코어링** — 멀티 라운드 게임(업스테이지·올아웃·주사위)은 라운드별 등수의 합이 낮을수록 우승하는 공통 규칙.
- **조기종료 투표** — 누구나 게임 조기 종료를 제안하고 **접속 인원 기준** 투표로 결정(부결 시 쿨다운). 라운드 진행도 방장 전유물이 아니다.
- **끊김 ≠ 나감** — 새로고침·순단은 재접속 토큰으로 자리 복원. 자동 스킵/자동 추방/턴 타이머 없음, 방장만 수동 개입.
- **인게임 `?` 도움말** — 게임마다 룰을 ko·en으로 안내하는 `RulesModal`. 처음 보는 사람의 온보딩도 "완료"의 일부다.

> 게임별 상세 규칙은 코드(`server/src/games/<id>/`)와 i18n 도움말이 단일 출처다.

---

## 🧩 게임은 계속 추가된다 — 플러그인 파이프라인

이 프로젝트의 핵심 설계는 **"게임 허브는 그대로 두고 게임만 갈아끼운다"**다. 새 게임 하나를 붙이는 데 필요한 접점이 전부 레지스트리로 고정돼 있다:

```
shared/  ─ GameId 유니온 + gameCatalog 항목        (타입·노출·인원·옵션)
server/  ─ games/<id>/FooModule.ts                 (규칙·검증·비밀정보·승패 — 전부 여기)
          └ games/registry.ts 에 한 줄 등록
client/  ─ games/foo/FooGameScreen.tsx             (UI — 토큰·i18n만 사용)
          └ games/registry.tsx 의 GAME_SCREENS 에 한 줄 등록
```

서버 쪽 계약은 `GameModule` 인터페이스 하나다:

```ts
interface GameModule<TOptions, TPublicState, TPrivateState> {
  readonly id: GameId;
  readonly minPlayers: number;
  start(input: { players; options; randomSeed }): void;
  handleAction(input: { playerId; action; isHost }): ActionResult;
  getPublicState(): TPublicState;               // 전원 브로드캐스트 — 비밀 절대 금지
  getStateFor(playerId: string): TPrivateState; // 그 플레이어에게만 (손패·역할·정답)
  onPlayerLeave / onPlayerReturn / onPlayerRemoved;  // 끊김·복귀·추방 생명주기
  isOver(): GameResult | null;
}
```

- 라우팅·로비·좌석·재접속·테마·i18n은 **허브가 이미 다 제공**한다. 게임은 규칙(서버)과 화면(클라)만 만든다.
- 카탈로그의 `status: "coming_soon" | "available"` 하나로 노출을 제어한다 — 개발 중 게임을 카탈로그에 미리 등록해두고 출시 때 값만 바꾼다.
- 추방/끊김 견고성(액션 대기 phase에서 주체가 추방돼도 게임이 멈추지 않기), 정족수의 접속 인원 기준 계산 같은 함정까지 [`CLAUDE.md`](./CLAUDE.md) §4에 **완전 레시피 + 체크리스트**로 문서화돼 있다. 봇 테스트(2~10인 완주 + 추방/재접속 엣지)까지가 게임 1종의 완성 정의다.

---

## 🎨 테마 시스템 — 게임은 한 번만 만든다

테마는 최상위 개념이다. `<html data-theme="...">` 한 줄로 앱 전체가 바뀐다:

| | **cyber** (기본) | **cozy** |
|---|---|---|
| 무드 | 다크 네온 터미널 HUD | 크림빛 스토리북 |
| 디테일 | 코너 브래킷·스캔라인·텔레메트리·각진 테두리 | 둥근 모서리·소프트 3D 그림자·손글씨 제목·원형 아바타 |

- 모든 색·폰트·간격·라운드는 **디자인 토큰**(`client/src/design/terminal.css`)으로만 정의된다. `:root` = cyber, `[data-theme="cozy"]` 블록 = cozy 오버라이드.
- 그래서 **게임을 테마별로 두 번 만들지 않는다** — 토큰만 쓰면 두 테마가 자동으로 따라온다.
- 플레이어 아바타도 테마별 에셋(`public/themes/<theme>/avatars/`)이고, **각자 자기 테마로 렌더**된다(내 화면의 cozy 유저는 cozy 아바타로 보인다).
- 다국어(ko·en)도 같은 불변식이다: 유저 노출 텍스트는 전부 `i18n` dict 양쪽에 존재해야 한다.
- 모든 상태/에러 페이지는 `/_states` 라우트에서 두 테마로 한눈에 미리볼 수 있다.

---

## 🏗️ 아키텍처

pnpm 모노레포. workspace 루트는 **`apps/oneshot/`** (리포 루트 아님).

| 패키지 | 스택 | 역할 |
|---|---|---|
| `client` | React 19 + Vite + TypeScript + Zustand | SPA. 화면·테마·다국어·UI 키트 |
| `server` | Colyseus + Express + Node + TypeScript | 권위 서버. 방 수명주기 + 게임 규칙. 빌드 결과로 `client/dist`도 정적 서빙 |
| `shared` | TypeScript | client/server 공유 타입·게임 카탈로그·미션 팩 |
| `e2e` | Playwright | 다중 클라이언트 유저 여정 E2E |

**핵심 원칙**

- **권위 서버**: 규칙·검증·랜덤(seed 주입 `Randomizer`)·승패는 서버 모듈에만. 클라이언트가 보낸 payload는 전부 서버에서 parse + 검증한다.
- **비밀정보 최소 전송**: 남의 손패/역할/정답은 애초에 클라이언트로 안 간다 — `getStateFor(playerId)`로 본인 몫만. `getPublicState()`엔 `handCount` 같은 공개 정보만.
- **사람이 게임을 해결한다**: 자동 스킵/추방 없음, 턴 타이머 없음. 파티 게임의 템포는 앱이 아니라 사람이 정한다.
- **웹 기본기**: 보안 헤더(helmet)·gzip(compression)·rate-limit·CORS 화이트리스트, favicon/OG/robots.txt, 반응형(모바일 완료 기준 포함).

---

## 🚀 빠른 시작

```bash
# 새 머신: 의존성 설치 + .env 생성 (한 번)
bash apps/oneshot/setup.sh

# 개발 서버 (각각 별 터미널) — 명령은 apps/oneshot 안에서
cd apps/oneshot
corepack pnpm --filter @oneshot/server dev   # http://localhost:2567
corepack pnpm --filter @oneshot/client dev   # http://localhost:5173 (점유 시 5174)
```

검증:

```bash
cd apps/oneshot
corepack pnpm -r typecheck
corepack pnpm --filter @oneshot/server test   # 게임별 봇 테스트 (완주 + 추방/재접속 엣지)
corepack pnpm test:e2e                        # Playwright 유저 여정 (선택)
```

> ⚠️ pnpm 명령은 **`apps/oneshot/`** 안에서 실행한다. 리포 루트에서 돌리면 `vitest: command not found`로 실패한다.
> `corepack pnpm`을 쓴다(전역 pnpm 없을 수 있음). `.env`는 git-ignored, `setup.sh`가 `*/.env.example`에서 생성한다.

---

## ✅ QA 철학 — 화면 검사 + 유저 여정

완료 기준은 두 겹이다 (자세한 체크리스트: CLAUDE.md §5·§6):

1. **화면 단위** — **2 테마 × 2 언어 = 4조합**이 전부 동작 + `/_states` 상태 페이지 + 모바일 폭(상단바 접힘·터치 타깃 44px·가로 넘침 없음).
2. **유저 여정** — 화면 사이에 숨는 버그를 잡는다: 진입 경로별 첫 화면(직접 URL / 초대 링크 `/r/CODE` / QR / 잘못된 코드), Enter가 **의도한** 버튼을 누르는가, 주소창 == 실제 앉아 있는 방, 복사 버튼이 라벨 그대로를 복사하는가, 새로고침/뒤로가기/추방 후 합리적인 화면에 떨어지는가.

여정 버그를 고치면 그 여정을 e2e로 박제한다 — `e2e/tests/home-enter.spec.ts`(Enter 의도), `lobby-copy.spec.ts`(클립보드), `dice.spec.ts`·`allout-auto.spec.ts`(게임 완주) 등이 선례다.

---

## ⚙️ 환경변수

`config` 모듈만 env를 읽는다(코드에서 `process.env`/`import.meta.env` 직접 참조 금지). zod로 검증하며 누락/약한 값이면 부팅 실패한다.

**server** (`server/.env`)

| 변수 | 기본(dev) | 비고 |
|---|---|---|
| `NODE_ENV` | development | 프로덕션은 `production` |
| `SERVER_HOST` | 0.0.0.0 | |
| `SERVER_PORT` | 2567 | |
| `PUBLIC_ORIGIN` | http://localhost:5173 | 프로덕션은 실제 도메인. CORS 화이트리스트 |
| `SESSION_SECRET` | dev-only-change-me | **프로덕션에선 반드시 교체**(dev값이면 부팅 거부) |
| `ROOM_CODE_LENGTH` / `ROOM_CODE_ALPHABET` | 5 / 혼동문자 제외 | |
| `COLYSEUS_RECONNECT_WINDOW_SECONDS` | 86400 | 재접속 허용 창 |
| `EMPTY_ROOM_TTL_SECONDS` | 3600 | 빈 방 정리 |

**client** (`client/.env`) — ⚠️ `VITE_*`는 **빌드타임에 고정**된다. 도메인을 정하고 빌드해야 한다.

| 변수 | 기본(dev) | 프로덕션 예 |
|---|---|---|
| `VITE_PUBLIC_ORIGIN` | http://localhost:5173 | https://oneshot.jsyoo.dev |
| `VITE_WS_URL` | ws://localhost:2567 | wss://oneshot.jsyoo.dev |
| `VITE_API_URL` | http://localhost:2567 | https://oneshot.jsyoo.dev |

> 미설정 시 클라이언트는 브라우저 위치에서 자동 추론(https → wss)한다. 동작하지만 프로덕션은 명시 권장.

---

## 📦 배포

배포 단위는 **컴포넌트 1개**다: Node 서버 1개가 게임(WebSocket) + 정적 클라(`client/dist`)를 함께 서빙한다.
**"DNS만 세팅"으론 부족** — 리버스 프록시(WebSocket 업그레이드)·TLS·프로세스 데몬화가 필요하다.

현재 프로덕션: **Oracle Cloud VM + Docker + Caddy + Cloudflare** → [oneshot.jsyoo.dev](https://oneshot.jsyoo.dev)

1. **env 준비** — Docker는 `apps/oneshot/.env` 하나를 읽는다(`ops/docker-compose.yml`의 `env_file: ../.env`). server/client 변수를 합쳐 작성:
   ```bash
   # apps/oneshot/.env
   NODE_ENV=production
   PUBLIC_ORIGIN=https://oneshot.jsyoo.dev
   SESSION_SECRET=<강한 시크릿 32자+>
   VITE_PUBLIC_ORIGIN=https://oneshot.jsyoo.dev
   VITE_WS_URL=wss://oneshot.jsyoo.dev
   VITE_API_URL=https://oneshot.jsyoo.dev
   ```
2. **빌드 & 실행** (Docker)
   ```bash
   cd apps/oneshot
   docker compose -f ops/docker-compose.yml up -d --build   # :2567, restart=unless-stopped
   ```
   (Docker 없이: `corepack pnpm install --frozen-lockfile && corepack pnpm build && node server/dist/index.js`)
3. **Caddy 리버스 프록시** — WebSocket 업그레이드를 자동 처리하고 TLS도 잡아준다.
   ```
   oneshot.jsyoo.dev {
     reverse_proxy localhost:2567
   }
   ```
4. **Oracle 보안그룹**에서 80/443 개방.
5. **Cloudflare**: A 레코드 → Oracle 공인 IP, SSL/TLS 모드 **Full**.
6. 확인: `curl https://oneshot.jsyoo.dev/healthz` → `{"ok":true,...}`

배포 전 점검:
- [ ] `SESSION_SECRET` 교체 / `NODE_ENV=production`
- [ ] `VITE_*`를 실제 도메인으로 두고 **빌드**했는가 (빌드타임 고정)
- [ ] `index.html`의 `og:url`/`og:image` 도메인을 실제 도메인으로 교체했는가
- [ ] `/colyseus` 모니터는 프로덕션에서 자동 비활성(필요하면 인증 뒤에 둔 뒤 재활성)

업데이트 배포: 서버에서 `git pull` 후 `docker compose -f ops/docker-compose.yml up -d --build` 재실행.

---

## 🗂️ 폴더 지도 (요약)

```
apps/oneshot/
  client/   React+Vite SPA  (design/ ui/ games/ lobby/ room/ app/ i18n/ theme/ config/)
            public/themes/<theme>/{avatars,games}/   # 테마별 자산
  server/   Colyseus 서버    (rooms/ games/<id>/ games/registry.ts config/ index.ts) + tests/
  shared/   공유 타입         (schema/domain.ts, games/catalog.ts, games/<id>.ts, index.ts)
  e2e/      Playwright 유저 여정 테스트
  ops/      Dockerfile, docker-compose.yml
```

자세한 영역별 위치·테마/다국어 규칙·**새 게임 추가 레시피**는 [`CLAUDE.md`](./CLAUDE.md)에 있다.

---

## 🔒 의존성 보안

`corepack pnpm audit` 기준. **런타임 배포물(서버)에 영향 주는 취약점은 없다** — 보고되는 항목은 전부 dev/test 도구의 트랜지티브 의존성이다.

- 패치된 버전을 강제하기 위해 루트 `package.json`의 `pnpm.overrides`로 `vite`/`esbuild`를 핀했고, `vitest`는 메이저 업그레이드했다. (vite·esbuild 관련 critical·high 포함 5건 해소)
- **남은 2건은 의도적으로 수용**한다(수정 시 상위 패키지가 깨지고, 우리 사용 경로에선 비악용):
  - `nanoid@2` (moderate) — `@colyseus/core`가 내부적으로 v2를 고정. 방 코드 생성은 정수 길이만 쓰므로 예측가능성 이슈 비해당. colyseus 업그레이드 전까지 유지.
  - `esbuild` (low) — `tsup` 빌드 도구의 트랜지티브, **Windows·dev 서버 전용** 경로. 배포(Linux) 무관.
- 의존성 추가/업그레이드 후에는 `corepack pnpm audit`을 재확인한다.

---

## ⚖️ 저작권 주의

- 기존 게임의 상표명·로고·캐릭터명·계급명·카드 일러스트·룰북 문장을 사용하지 않는다.
- 규칙 설명은 룰북 문장을 복사하지 않고 자체 문장으로 작성한다.
- 외부 게임을 참조할 땐 일반 비교 설명만 쓰고, 공식 명칭·아트·표현을 제품 UI/콘텐츠 자산으로 쓰지 않는다.
