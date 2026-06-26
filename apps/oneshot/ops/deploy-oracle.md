# Oracle 단일 인스턴스 배포

배포 입력은 `apps/oneshot` 폴더만 사용한다.

1. 서버에 Node.js LTS와 Corepack을 설치한다.
2. `apps/oneshot/.env.example`을 기준으로 `.env`를 만들고 `SESSION_SECRET`, `PUBLIC_ORIGIN`, `VITE_*` 값을 배포 도메인에 맞춘다.
3. `corepack enable` 후 `pnpm install --frozen-lockfile`을 실행한다.
4. `pnpm build`로 `client/dist`와 `server/dist`를 만든다.
5. `node server/dist/index.js`를 systemd 또는 Docker Compose로 실행한다.
6. 방화벽에서 80/443과 서버 프록시 대상 포트를 열고 Caddy 또는 Nginx에서 WebSocket 업그레이드를 허용한다.

운영 상태 확인은 `GET /healthz`로 한다.
