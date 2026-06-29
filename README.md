# OneShot (원샷)

친구들이 한 **파티 방**에 모여 여러 술·파티 게임을 갈아끼우며 즐기는 **웹 우선 실시간 게임 허브**.
방 코드(또는 QR/링크) 하나로 모여, 방장이 게임을 골라 시작하고, 끝나면 다시 방으로 돌아와 다음 게임을 고른다.

> 실제 제품 코드는 **`apps/oneshot/`** 안에만 있다. 루트의 `prototypes/` 등은 배포 대상이 아니다.
> 개발 규칙·게임 추가 가이드는 [`CLAUDE.md`](./CLAUDE.md)에 있다. **새 게임을 붙일 땐 CLAUDE.md를 먼저 읽는다.**

---

## 현재 상태

- ✅ **실시간 파티 방** — 방 생성 / 코드·링크·QR 입장 / 닉네임·좌석 / 방장·임시방장·추방 / 재접속 토큰 복원
- ✅ **왕게임(KingGame)** — 4개 모드(자유·순한맛·매운맛·커스텀), 바이링구얼 미션 48개, 서버 권위·비밀정보 격리. 정상 플레이 배포 가능 수준
- ✅ **게임 추가 파이프라인** — `GameModule` 계약 + 클라이언트 `GAME_SCREENS` 레지스트리 + 카탈로그 기반 노출. 새 게임은 정해진 자리만 채우면 붙는다 (→ CLAUDE.md §4)
- ✅ **2 테마(cyber·cozy) × 2 언어(ko·en)** 항상 동시 동작, `/_states`에서 모든 상태/에러 화면 미리보기
- ✅ **웹 기본기** — favicon/OG/메타, robots.txt, 보안 헤더(helmet)·gzip(compression)·rate-limit, 반응형
- ⏳ 로드맵(미구현, `coming_soon`): 업스테이지 · 라이어 · 바보 라이어 · 사칙연산

---

## 아키텍처

pnpm 모노레포. workspace 루트는 **`apps/oneshot/`** (리포 루트 아님).

| 패키지 | 스택 | 역할 |
|---|---|---|
| `client` | React 19 + Vite + TypeScript + Zustand | SPA. 화면·테마·다국어·UI 키트 |
| `server` | Colyseus + Express + Node + TypeScript | 권위 서버. 방 수명주기 + 게임 규칙. 빌드 결과로 `client/dist`도 정적 서빙 |
| `shared` | TypeScript | client/server 공유 타입·카탈로그·미션 팩 |
| `e2e` | Playwright | 다중 클라이언트 E2E |

**핵심 원칙**
- **권위 서버**: 카드 배분·턴 검증·비밀 역할·승패는 서버만 결정. 클라는 UI·입력만.
- **비밀정보 최소 전송**: 다른 플레이어의 패/역할은 `getStateFor(playerId)`로만. `getPublicState()`(전원 브로드캐스트)에 절대 넣지 않는다.
- **사람이 게임을 해결한다**: 자동 스킵/추방 없음. 턴 타이머 없음. 끊김은 나감이 아니다(재접속 복원). 방장만 수동 개입.
- **테마·다국어는 불변식**: 색·폰트·간격은 토큰만, 텍스트는 i18n(ko·en) 양쪽. 자세한 규칙은 CLAUDE.md §3.

---

## 빠른 시작

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
corepack pnpm --filter @oneshot/server test
corepack pnpm test:e2e          # Playwright (선택)
```

> ⚠️ pnpm 명령은 **`apps/oneshot/`** 안에서 실행한다. 리포 루트에서 돌리면 `vitest: command not found`로 실패한다.
> `corepack pnpm`을 쓴다(전역 pnpm 없을 수 있음). `.env`는 git-ignored, `setup.sh`가 `*/.env.example`에서 생성한다.

---

## 환경변수

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
| `VITE_PUBLIC_ORIGIN` | http://localhost:5173 | https://jsyoo.dev |
| `VITE_WS_URL` | ws://localhost:2567 | wss://jsyoo.dev |
| `VITE_API_URL` | http://localhost:2567 | https://jsyoo.dev |

> 미설정 시 클라이언트는 브라우저 위치에서 자동 추론(https → wss)한다. 동작하지만 프로덕션은 명시 권장.

---

## 배포

배포 단위는 **컴포넌트 1개**다: Node 서버 1개가 게임(WebSocket) + 정적 클라(`client/dist`)를 함께 서빙한다.
**"DNS만 세팅"으론 부족** — 리버스 프록시(WebSocket 업그레이드)·TLS·프로세스 데몬화가 필요하다.

권장: **Oracle Cloud VM + Docker + Caddy + Cloudflare**.

1. **env 준비** — Docker는 `apps/oneshot/.env` 하나를 읽는다(`ops/docker-compose.yml`의 `env_file: ../.env`). server/client 변수를 합쳐 작성:
   ```bash
   # apps/oneshot/.env
   NODE_ENV=production
   PUBLIC_ORIGIN=https://jsyoo.dev
   SESSION_SECRET=<강한 시크릿 32자+>
   VITE_PUBLIC_ORIGIN=https://jsyoo.dev
   VITE_WS_URL=wss://jsyoo.dev
   VITE_API_URL=https://jsyoo.dev
   ```
2. **빌드 & 실행** (Docker)
   ```bash
   cd apps/oneshot
   docker compose -f ops/docker-compose.yml up -d --build   # :2567, restart=unless-stopped
   ```
   (Docker 없이: `corepack pnpm install --frozen-lockfile && corepack pnpm build && node server/dist/index.js`)
3. **Caddy 리버스 프록시** — WebSocket 업그레이드를 자동 처리하고 TLS도 잡아준다.
   ```
   jsyoo.dev {
     reverse_proxy localhost:2567
   }
   ```
4. **Oracle 보안그룹**에서 80/443 개방.
5. **Cloudflare**: A 레코드 → Oracle 공인 IP, SSL/TLS 모드 **Full**.
6. 확인: `curl https://jsyoo.dev/healthz` → `{"ok":true,...}`

배포 전 점검:
- [ ] `SESSION_SECRET` 교체 / `NODE_ENV=production`
- [ ] `VITE_*`를 실제 도메인으로 두고 **빌드**했는가 (빌드타임 고정)
- [ ] `index.html`의 `og:url`/`og:image` 도메인을 실제 도메인으로 교체했는가
- [ ] `/colyseus` 모니터는 프로덕션에서 자동 비활성(필요하면 인증 뒤에 둔 뒤 재활성)

---

## 폴더 지도 (요약)

```
apps/oneshot/
  client/   React+Vite SPA  (design/ ui/ games/ lobby/ room/ app/ i18n/ theme/ config/)
            public/themes/<theme>/{avatars,games}/   # 테마별 자산
  server/   Colyseus 서버    (rooms/ games/<id>/ games/registry.ts config/ index.ts) + tests/
  shared/   공유 타입         (schema/domain.ts, games/catalog.ts, games/<id>.ts, index.ts)
  e2e/      Playwright
  ops/      Dockerfile, docker-compose.yml
```

자세한 영역별 위치·테마/다국어 규칙·**새 게임 추가 레시피**는 [`CLAUDE.md`](./CLAUDE.md)에 있다.

---

## 저작권 주의

- 기존 게임의 상표명·로고·캐릭터명·계급명·카드 일러스트·룰북 문장을 사용하지 않는다.
- 규칙 설명은 룰북 문장을 복사하지 않고 자체 문장으로 작성한다.
- 외부 게임을 참조할 땐 일반 비교 설명만 쓰고, 공식 명칭·아트·표현을 제품 UI/콘텐츠 자산으로 쓰지 않는다.
