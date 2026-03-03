# Figma MCP 서버 세팅 가이드

## 개요
달무티 카드 게임 앱의 디자인을 AI로 생성/수정하기 위해 **figma-console-mcp**를 사용한다.
자연어로 디자인을 요청하면 Figma에 직접 생성되고, 대화하며 수정할 수 있다.

## 사용하는 도구
- **figma-console-mcp** (MIT 라이선스, 무료)
  - GitHub: https://github.com/southleft/figma-console-mcp
  - 56개 이상의 도구 (디자인 생성, 수정, 읽기, 변수 관리, 스크린샷 등)
  - `figma_execute`로 모든 Figma Plugin API 코드 실행 가능

## 구조
```
Claude Code ←(MCP)→ figma-console-mcp (NPX) ←WebSocket (port 9223~9232)→ Figma Desktop Bridge Plugin
                                                                              ↓
                                                                         Figma Plugin API
                                                                         (디자인 생성/수정/읽기)
```

## 세팅 완료 항목

### 1. Claude Code MCP 서버 등록 (완료)
```bash
claude mcp add figma-console -s user \
  -e FIGMA_ACCESS_TOKEN=<your-token> \
  -e ENABLE_MCP_APPS=true \
  -- npx -y figma-console-mcp@latest
```
- 위치: `~/.claude.json` (user scope)
- Claude Code 재시작 시 자동으로 MCP 서버 실행

### 2. Figma Desktop Bridge 플러그인 소스 (완료)
- 위치: `/Users/junsangyoo/GitHub/figma-console-mcp-source/figma-desktop-bridge/`
- 파일: `manifest.json`, `code.js`, `ui.html`

## 사용자가 해야 할 세팅

### 3. Figma Desktop 앱에서 플러그인 설치 (수동)
1. **Figma Desktop** 앱 열기 (브라우저 버전은 안 됨)
2. 메뉴: **Plugins → Development → Import plugin from manifest...**
3. 이 파일 선택: `/Users/junsangyoo/GitHub/figma-console-mcp-source/figma-desktop-bridge/manifest.json`
4. "Figma Desktop Bridge"가 Development plugins에 추가됨

### 4. Claude Code 재시작
- 현재 세션을 종료하고 다시 시작해야 MCP 서버가 활성화됨

## 사용 방법

### 매번 사용 시 순서
1. **Figma Desktop**에서 작업할 파일 열기
2. **플러그인 실행**: 우클릭 → Plugins → Development → Figma Desktop Bridge
3. "Desktop Bridge active" 확인
4. **Claude Code** 실행
5. 자연어로 디자인 요청! 예:
   - "로그인 화면 만들어줘"
   - "카드 크기를 더 크게 해줘"
   - "배경색을 파란색으로 바꿔줘"

### 주요 MCP 도구
| 도구 | 설명 |
|------|------|
| `figma_execute` | Figma Plugin API 코드 직접 실행 (핵심) |
| `figma_get_status` | 연결 상태 확인 |
| `figma_navigate` | 페이지/노드로 이동 |
| `figma_screenshot` | 현재 화면 캡처 |
| `figma_get_variables` | 디자인 변수 조회 |
| `figma_arrange_component_set` | 컴포넌트 변형 정리 |

## 보안 참고
- Figma Personal Access Token은 환경변수로만 저장 (코드에 하드코딩 금지)
- 토큰이 노출되었다면 Figma Settings에서 즉시 재발급
- Desktop Bridge 플러그인은 localhost에서만 통신 (외부 노출 없음)

## 트러블슈팅

### MCP 도구가 안 보일 때
- Claude Code 재시작
- `claude mcp list`로 figma-console 등록 확인

### Figma에 변화가 안 생길 때
- Figma Desktop Bridge 플러그인이 실행 중인지 확인
- "Desktop Bridge active" 메시지가 보이는지 확인
- Figma Desktop 앱을 사용해야 함 (브라우저 X)

### WebSocket 연결 안 될 때
- 포트 9223~9232 범위에서 자동 연결됨
- 플러그인을 닫았다 다시 열기
- manifest.json 다시 import

---

## 작업 기록

### 2026-02-28: 초기 세팅
- figma-console-mcp를 Claude Code MCP 서버로 등록
- Figma Desktop Bridge 플러그인 소스 다운로드 (`/Users/junsangyoo/GitHub/figma-console-mcp-source/`)
- 선택 이유: 56개+ 도구 제공, `figma_execute`로 모든 Plugin API 실행 가능, 무료, MIT 라이선스
- claude-talk-to-figma-mcp 대비 장점: 스크린샷 캡처, 변수 관리, 디자인 시스템 추출 기능 포함
