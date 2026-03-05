# Upstage - 전체 기획서

---

## 1. 게임 개요

| 항목 | 내용 |
|------|------|
| 게임명 | **Upstage** |
| 장르 | 턴제 카드 게임 (온라인 멀티플레이어) |
| 컨셉 | "적을수록 강하다" - 희소성 기반 숫자 카드 대결 |
| 인원 | 2~10명 |
| 플랫폼 | iOS + Android + ONE Store (Flutter) |
| 수익 모델 | 광고 (배너 + 전면 + 보상형) + IAP (코인 구매) |

---

## 2. 확정된 게임 룰

### 기본 룰
- 카드 1~N (N은 8~15 중 선택), 숫자 K의 카드는 K장 존재
- 조커 0~4장 (와일드: 아무 숫자로 사용)
- 모든 카드를 균등 배분
- 시작 플레이어가 같은 숫자 카드 세트를 냄
- 다음 플레이어는 **같은 수량**의 **더 낮은 숫자**를 내거나 패스
- 모두 패스하면 마지막에 낸 플레이어가 새로 시작
- 먼저 패를 다 비우면 라운드 승리

### 설정 옵션 (방장이 설정)
| 설정 | 범위 | 기본값 |
|------|------|--------|
| 공개/비공개 | Public / Private | Private |
| 최대 인원 | 2~10명 | 4명 |
| 카드 범위 | 8~15 | 인원별 추천값 |
| 조커 수 | 0~4장 | 2장 |
| 라운드 수 | 1~무제한 | 3 |
| 승리 조건 | 승수제 / 점수제 | 점수제 |
| 참가비 | 100 + 100α (α = 0~9) | 100코인 (α=0) |

### 참가비 (100 + 100α)
| 배율 (α) | 참가비 | 네이밍 (placeholder) |
|----------|--------|---------------------|
| 0 | 100 | TBD |
| 1 | 200 | TBD |
| 2 | 300 | TBD |
| 4 | 500 | TBD |
| 9 | 1,000 | TBD |

### 승리 판정 & 보상
- **승수제**: 먼저 N라운드 이기면 최종 승리
- **점수제**: 순위별 점수 부여 (1등=0점, 2등=1점...), 정해진 라운드 후 최저 점수 승리
- **코인 보상**: 모든 라운드 종료 후, 최종 1등이 전체 참가비 총액 획득
  - 예: 6명 x 500코인 = 1등이 3,000코인 획득

---

## 3. 코인 경제 시스템

### 코인 획득

| 방법 | 수량 | 제한 |
|------|------|------|
| 신규 가입 | 1,000코인 | 1회 |
| 보상형 광고 | 100코인/회 | 하루 5회 (= 500코인/일) |
| IAP 구매 | 패키지별 | 무제한 |
| 게임 승리 | 참가비 총액 | - |

### 코인 소비

| 항목 | 수량 |
|------|------|
| 게임 참가비 | 100~1,000 (방장 설정) |
| 카드 스킨 | TBD (추후 결정) |

### 코인 상점 (IAP)

| 패키지 | 코인 | Apple (USD) | Apple (KRW) | Google (KRW) | 네이밍 (placeholder) |
|--------|------|------------|------------|-------------|---------------------|
| 소 | 500 | $0.99 | ₩1,500 | ₩1,000 | TBD |
| 중 | 1,200 | $1.99 | ₩3,000 | ₩2,500 | TBD |
| 대 | 3,000 | $4.99 | ₩6,500 | ₩6,000 | TBD |
| 특대 | 7,000 | $9.99 | ₩14,000 | ₩12,000 | TBD |
| 특특대 | 30,000 | $39.99 | ₩55,000 | ₩48,000 | TBD ("대부" 컨셉) |

특특대 특전:
- 구매 시 특별 연출 (금색 이펙트)
- 프로필에 특별 칭호/뱃지 표시

### 코인 밸런스 체크

| 상황 | 계산 |
|------|------|
| 신규 유저 (무과금) | 1,000코인 → 참가비 100 기준 10판 |
| 광고 시청 (하루 5회) | +500코인 = 5판 추가 |
| 승리 시 (6인, 100배팅) | +500코인 순이익 |
| 패배 시 | -100코인 |
| 하루 총 (무과금, 50% 승률) | 약 10~15판 가능 |

### 코인 규제 주의사항
- 코인 → 현금 전환 **절대 불가** (도박법 위반)
- 코인은 앱 내에서만 획득/소비
- 배팅 상한선: 1회 1,000코인
- 사행성 요소로 인해 **15+ 또는 19+ 등급** 예상 (GRAC 심사)
- 확률형 아이템 없음 (스킨은 직접 구매) → 확률 공개 의무 해당 없음

---

## 4. 앱 구조 결정

### 단일 게임으로 시작, 허브 확장 가능 구조

이유:
- 허브는 게임 3개 이상 있어야 의미 있음
- 지금은 Upstage 하나에 집중
- 앱 아키텍처만 모듈화하여 나중에 게임 추가 가능하게 설계

---

## 5. 앱 플로우 (상세)

```
[앱 실행]
  ↓
[스플래시 화면] (1~2초, 로고 + 앱 이름)
  ↓
[메인 화면] ──────────────────────── 배너 광고 (하단 고정)
  ├── [🎮 방 만들기] → 게임 설정 → 대기실
  ├── [🌐 공개 방 목록] → 방 리스트 → 대기실
  ├── [🔑 코드로 입장] → 코드 입력 → 대기실
  ├── [🪙 코인: XXX] [+ 광고로 충전] ← 보상형 광고 (하루 5회)
  ├── [👤 프로필] → 닉네임 / 로그인 / 전적
  └── [⚙️ 설정] → 사운드, 진동, 언어
```

### 5-1. 메인 화면
- 중앙에 게임 로고
- 큰 버튼 3개: "방 만들기" / "공개 방 목록" / "코드로 입장"
- 코인 잔액 표시 + 광고 충전 버튼
- 하단: 프로필 아이콘, 설정 아이콘
- **배너 광고**: 화면 최하단 고정

### 5-2. 방 만들기 → 게임 설정
```
[게임 설정 화면]
  - Public / Private 토글
  - 최대 인원: 2~10명 (Public은 필수)
  - 카드 범위: 슬라이더 (8~15) + 추천값 배지
  - 조커 수: 0 1 2 3 4 선택 버튼
  - 라운드: 슬라이더 (1~10) + 무제한 토글
  - 승리 조건: 승수제 / 점수제 탭
  - 참가비: 100 + 100α (α 슬라이더)
  - [방 만들기] 버튼
```

### 5-3. 공개 방 목록
```
[공개 방 목록]
  - 방 리스트 (실시간 업데이트)
    ┌──────────────────────────────────┐
    │  🃏 카드 10  👤 4/6  🪙 500      │
    │  라운드 3 · 점수제                 │
    │                        [참가] 버튼 │
    ├──────────────────────────────────┤
    │  🃏 카드 12  👤 2/4  🪙 100      │
    │  라운드 5 · 승수제                 │
    │                        [참가] 버튼 │
    └──────────────────────────────────┘
  - 새로고침 버튼
  - 코인 부족 시 참가 불가 + "코인 충전" 유도
```

### 5-4. 대기실
```
[대기실]
  - 상단: 방 정보 (설정 요약, 참가비)
  - Private: 방 코드 (큰 글씨) + 복사 버튼 + 공유 버튼
  - 중앙: 참가자 리스트 (닉네임 + 아바타)
          - 호스트 표시 (왕관 아이콘)
          - 입장 시 애니메이션
  - 하단: [게임 시작] 버튼 (호스트만, 2명 이상일 때 활성)
  - 참가자: [나가기] 버튼
```

### 5-5. 게임 화면
```
[게임 화면]
  ┌─────────────────────────────┐
  │  상대방들 (원형 배치)          │
  │  - 닉네임 + 남은 카드 수       │
  │  - 현재 턴 하이라이트          │
  ├─────────────────────────────┤
  │  중앙: 플레이 영역             │
  │  - 마지막에 낸 카드 세트        │
  │  - "3장의 5" 같은 텍스트       │
  │  - 총 상금 표시 (🪙 3,000)    │
  ├─────────────────────────────┤
  │  내 패 (하단, 부채꼴/가로 스크롤) │
  │  - 카드 선택 → 위로 올라옴     │
  │  - [내기] [패스] 버튼          │
  └─────────────────────────────┘
```

**게임 중 인터랙션:**
1. 내 턴이 오면 카드 선택 가능 (같은 숫자만 복수 선택)
2. 선택 후 [내기] 누르면 유효성 검증 → 카드 제출
3. 유효하지 않으면 진동 + 안내 메시지
4. [패스] 누르면 패스
5. 누군가 패를 다 비우면 라운드 종료 애니메이션

### 5-6. 라운드 결과
```
[라운드 결과 화면]
  - 순위표 (1등~꼴등, 애니메이션)
  - 점수 변동 표시 (점수제일 경우)
  - [다음 라운드] 버튼 → 전면 광고 → 게임 화면
  - [홈으로] 버튼 → 전면 광고 → 메인 화면
  (마지막 라운드면 → 최종 결과로)
```

### 5-7. 최종 결과
```
[최종 결과 화면] ──────────────── 배너 광고 (하단 고정)
  - 최종 순위 (큰 트로피 애니메이션)
  - 점수 / 승수 요약
  - 코인 획득 표시 (1등: +3,000 🪙 애니메이션)
  - [다시하기] 버튼 → 전면 광고 → 대기실
  - [홈으로] 버튼 → 전면 광고 → 메인 화면
```

---

## 6. 로그인/계정 시스템

### 전략: 게스트 우선, 선택적 로그인

| 상태 | 가능한 기능 |
|------|-----------|
| **게스트** (기본) | 닉네임 설정, 게임 플레이, 방 만들기/입장, 코인 사용 |
| **로그인** (선택) | 전적 저장, 전적 조회, 닉네임 영구 저장, 코인 영구 저장 |

### 로그인 방식
- Google Sign-In
- Apple Sign-In (iOS 필수)
- 게스트 → 로그인 전환 시 데이터 마이그레이션

### 프로필 화면
```
[프로필]
  - 닉네임 (게스트: 랜덤 생성 + 수정 가능)
  - 코인 잔액
  - 로그인 버튼 (게스트일 때)
  - 전적 (로그인 시): 총 게임 수, 승률, 최고 연승
  - 보유 스킨 목록
```

---

## 7. 멀티플레이어 시스템

### Public Room (공개 방)
- 방장이 Public으로 설정 → 공개 방 목록에 노출
- 누구나 목록에서 바로 참가 가능
- 인원 가득 차면 목록에서 자동 제거
- 표시 정보: 카드 범위, 인원(현재/최대), 참가비, 라운드, 승리조건

### Private Room (비공개 방)
- 방장이 Private으로 설정 → 코드/링크로만 입장
- 4자리 영문+숫자 코드 발급
- 공유: 코드 복사, 시스템 공유 시트
- (후순위) 딥링크: upstage://join?code=XXXX

### 방 관리
- 방 유효시간: 30분 (게임 시작 전까지)
- 게임 중 나가기: 해당 플레이어 카드 제거, 게임 계속, 참가비 몰수
- 호스트 나가기: 다음 사람에게 호스트 이관
- 모두 나가면 방 삭제

---

## 8. 광고 전략

### 배치 정리

| 위치 | 광고 타입 | 시점 |
|------|----------|------|
| 메인 화면 | 배너 (하단 고정) | 항상 |
| 최종 결과 화면 | 배너 (하단 고정) | 항상 |
| 라운드 결과 → 다음 라운드/홈 전환 | 전면 광고 | 버튼 누른 후, 전환 전 |
| 최종 결과 → 다시하기/홈 전환 | 전면 광고 | 버튼 누른 후, 전환 전 |
| 메인 화면 코인 충전 | 보상형 광고 | 유저가 선택 (하루 5회) |

### 원칙
- 게임 플레이 중 광고 절대 없음
- 앱 첫 진입 시 광고 없음
- 전면 광고는 화면 전환 사이에만 (자연스러운 타이밍)
- 광고 후 바로 목적지 화면 표시 (로딩감 최소화)

### 예상 사용자당 광고 노출

한 세션(3라운드 게임) 기준:
- 배너: 메인 1회 + 최종결과 1회 = ~2회 (60~120초 노출)
- 전면: 라운드 결과 2회 + 최종 결과 1회 = ~3회
- 보상형: 0~5회 (유저 선택)

---

## 9. 수익 모델 종합

### 수익원 3가지

| 수익원 | 방식 | 예상 비중 |
|--------|------|----------|
| 광고 (배너/전면) | 메인화면, 화면 전환 시 | 30~40% |
| 보상형 광고 | 코인 충전용 (100코인/회, 하루 5회) | 30~40% |
| IAP (인앱결제) | 코인 직접 구매 | 20~30% |

### 스토어 수수료

| 스토어 | 일반 | 소규모 (연 $1M 이하) | 비고 |
|--------|------|---------------------|------|
| Apple App Store | 30% | **15%** | $99/년 |
| Google Play | 30% | **15%** | $25 1회 |
| Google Play (한국 대체결제) | 26% | **11%** | 한국만 |
| ONE Store | 20% | **10%** | 무료 등록 |

### 스토어별 가격 규정

| | Apple | Google Play | ONE Store |
|--|-------|-------------|-----------|
| 가격 설정 | 고정 포인트 (900개 중 선택) | 자유 설정 | 자유 설정 |
| 최소 가격 | $0.29 / ₩400 | $0.99 / ₩1,000 | 자유 |
| 최대 가격 | $10,000 | ₩550,000 (한국) | 자유 |

### 수익 시뮬레이션 (광고 + IAP)

ARPDAU: 광고 $0.05~0.12 + IAP 전환율 2~5%

| DAU | 광고 월수익 | IAP 월수익 | **합계** | 서버비 | **순이익** |
|-----|-----------|-----------|---------|--------|----------|
| 100 | $150~360 | $30~100 | $180~460 | $0 | **$180~460** |
| 1,000 | $1,500~3,600 | $300~1,000 | $1,800~4,600 | $0 | **$1,800~4,600** |
| 10,000 | $15,000~36,000 | $3,000~10,000 | $18,000~46,000 | $20 | **~$18K~46K** |
| 50,000 | $75,000~180,000 | $15,000~50,000 | $90,000~230,000 | $100 | **~$90K~230K** |

---

## 10. 기술 스택 결정

### 추천 구성

| 영역 | 선택 | 이유 |
|------|------|------|
| **프론트엔드** | Flutter | iOS+Android+ONE Store 동시 |
| **백엔드 (실시간)** | Firebase Firestore | 턴제 게임에 충분, 무료 티어 넉넉, Flutter SDK 최고 |
| **서버 로직** | Firebase Cloud Functions | 카드 배분, 치팅 방지, 영수증 검증 |
| **인증** | Firebase Auth | 무료 50K MAU, Google/Apple 로그인, 게스트 지원 |
| **광고** | Google AdMob | 무료, 최고 fill rate, Flutter 공식 패키지 |
| **광고 미디에이션** | AdMob Mediation + Unity Ads | 수익 극대화 |
| **인앱결제** | in_app_purchase (Flutter 공식) | iOS StoreKit + Google Play Billing 통합 |
| **분석** | Firebase Analytics | 무료, Firebase 통합 |
| **크래시 리포트** | Firebase Crashlytics | 무료 |
| **딥링크** | Firebase Dynamic Links | 방 초대 링크용 |
| **푸시 알림** | Firebase Cloud Messaging | 무료 |

---

## 11. 구현 순서 (세부 스텝)

### Phase 1: 프로젝트 세팅 (1~2일)

```
Step 1.1: Flutter 프로젝트 생성
  - flutter create upstage
  - 패키지명 결정 (com.yourname.upstage)
  - 최소 SDK 버전 설정 (iOS 14+, Android API 24+)

Step 1.2: Firebase 프로젝트 생성
  - Firebase Console에서 프로젝트 생성
  - iOS 앱 등록 + GoogleService-Info.plist
  - Android 앱 등록 + google-services.json
  - flutterfire configure 실행

Step 1.3: 기본 패키지 설치
  - firebase_core
  - firebase_auth
  - cloud_firestore
  - firebase_functions (Cloud Functions 호출용)
  - google_mobile_ads
  - in_app_purchase
  - firebase_analytics
  - firebase_crashlytics
  - go_router (네비게이션)
  - riverpod (상태관리)
  - google_sign_in
  - sign_in_with_apple

Step 1.4: 프로젝트 구조 세팅
  lib/
  ├── main.dart
  ├── app/
  │   ├── router.dart
  │   └── theme.dart
  ├── features/
  │   ├── auth/
  │   ├── home/
  │   ├── lobby/
  │   ├── game/
  │   ├── result/
  │   ├── shop/
  │   └── skin/
  ├── models/
  │   ├── player.dart
  │   ├── card.dart
  │   ├── game_room.dart
  │   ├── game_state.dart
  │   └── coin_package.dart
  ├── services/
  │   ├── auth_service.dart
  │   ├── room_service.dart
  │   ├── game_service.dart
  │   ├── coin_service.dart
  │   ├── ad_service.dart
  │   └── purchase_service.dart
  └── shared/
      ├── widgets/
      └── constants/
```

### Phase 2: 인증 시스템 (1~2일)

```
Step 2.1: 게스트 로그인 구현
  - Firebase Anonymous Auth 연동
  - 랜덤 닉네임 생성 로직 (형용사 + 동물)
  - 닉네임 + 초기 코인(1,000) Firestore에 저장

Step 2.2: 소셜 로그인 구현
  - Google Sign-In 연동 (iOS + Android)
  - Apple Sign-In 연동 (iOS)
  - 게스트 → 소셜 계정 연결 (linkWithCredential)

Step 2.3: 프로필 화면
  - 닉네임 표시/수정
  - 코인 잔액 표시
  - 로그인 상태 표시
  - 로그인/로그아웃 버튼
```

### Phase 3: 코인 시스템 (2~3일)

```
Step 3.1: Firestore 유저 데이터 구조
  - users/{uid}
    - nickname: string
    - coins: int (초기값 1,000)
    - stats: { totalGames, wins, winRate, maxStreak }
    - lastAdWatch: timestamp
    - dailyAdCount: int
    - purchaseHistory: [...]
    - ownedSkins: [...]
    - createdAt: timestamp

Step 3.2: 코인 증감 로직 (Cloud Functions)
  - 코인 증가: 광고 시청, IAP 구매, 게임 승리
  - 코인 감소: 게임 참가비
  - 모든 코인 변동은 서버에서 처리 (치팅 방지)
  - 트랜잭션으로 원자성 보장

Step 3.3: 보상형 광고 연동
  - 메인 화면에 "광고 보고 100코인 받기" 버튼
  - 하루 5회 제한 체크 (서버 타임스탬프 기준)
  - 광고 완료 콜백 → Cloud Function 호출 → 코인 지급

Step 3.4: IAP (인앱결제) 구현
  - in_app_purchase 패키지 설정
  - 5개 상품 등록 (소/중/대/특대/특특대)
  - 구매 플로우: 상품 선택 → 스토어 결제 → 영수증 검증 (Cloud Functions) → 코인 지급
  - 영수증 검증: Apple/Google 서버에 검증 요청
  - 특특대 구매 시 특별 연출 + 칭호 부여

Step 3.5: 코인 상점 UI
  - 패키지 리스트 (가격, 코인 수, 보너스 표시)
  - 특특대 패키지 강조 디자인
  - 구매 완료 애니메이션
```

### Phase 4: 방 시스템 (2~3일)

```
Step 4.1: Firestore 방 데이터 구조
  - rooms/{roomCode}
    - hostId: string
    - isPublic: bool
    - maxPlayers: int
    - betAmount: int
    - settings: { cardRange, jokerCount, rounds, winCondition }
    - players: [{ uid, nickname, isHost }]
    - status: "waiting" | "playing" | "finished"
    - createdAt: timestamp

Step 4.2: 방 만들기 기능
  - 게임 설정 화면 (Public/Private, 인원, 카드, 조커, 라운드, 참가비)
  - 4자리 코드 생성 (영문+숫자, 중복 체크)
  - 코인 잔액 체크 (참가비 이상인지)
  - Firestore에 방 문서 생성
  - 호스트 코인 차감 (Cloud Function)

Step 4.3: 공개 방 목록
  - Firestore 쿼리: isPublic == true, status == "waiting"
  - 실시간 리스너로 자동 업데이트
  - 방 정보 표시: 카드범위, 인원, 참가비, 라운드, 승리조건
  - 참가 버튼 → 코인 체크 → 입장

Step 4.4: 코드로 입장 (Private)
  - 코드 입력 UI
  - 방 존재 여부 확인
  - 인원 초과 체크
  - 코인 잔액 체크
  - 참가비 차감 → players 배열에 추가

Step 4.5: 대기실 화면
  - 방 정보 요약 (설정, 참가비, 총 상금)
  - 참가자 리스트 (실시간 업데이트)
  - Private: 방 코드 + 복사 + 공유 버튼
  - 호스트: 게임 시작 버튼 (2명 이상)
  - 참가자: 나가기 버튼 (참가비 환불)

Step 4.6: 방 정리
  - 30분 타임아웃 (Cloud Functions 스케줄러)
  - 타임아웃 시 참가비 환불
  - 모두 나가면 방 삭제 + 참가비 환불
  - 게임 중 나가기: 참가비 몰수, 카드 제거, 게임 계속
  - 호스트 나가기: 다음 사람에게 이관
```

### Phase 5: 게임 로직 (3~5일)

```
Step 5.1: 카드 모델 설계
  - Card { number: int, isJoker: bool }
  - Deck 생성 로직 (범위에 따라 자동 생성)
  - 조커 추가
  - 셔플 + 균등 배분

Step 5.2: 게임 상태 관리 (Firestore)
  - games/{roomCode}
    - round: number
    - totalRounds: number
    - currentPlayerIndex: int
    - players: [{ uid, hand: [...cards], score, roundWins }]
    - pile: { cards: [...], playedBy: uid }
    - passCount: int
    - roundResults: [{ round, rankings }]
    - totalPot: int (총 상금)
    - status: "dealing" | "playing" | "roundEnd" | "gameEnd"

Step 5.3: 카드 배분 로직 (Cloud Functions)
  - 전체 덱 셔플
  - 플레이어 수로 균등 분배 (나머지 카드 제거)
  - 각 플레이어 hand를 Firestore에 저장
  - 보안: 다른 플레이어 hand 읽기 불가 (Firestore Rules)

Step 5.4: 턴 진행 로직
  - 현재 턴 플레이어 표시
  - 카드 선택 UI (같은 숫자만 복수 선택 가능)
  - 유효성 검증 (Cloud Functions):
    - 같은 수량인가?
    - 더 낮은 숫자인가?
    - 조커 사용 시 처리
    - (첫 턴이면 아무거나 가능)
  - 제출 → Firestore 업데이트
  - 패스 → passCount 증가

Step 5.5: 라운드 종료 판정
  - passCount === 남은 플레이어 수 - 1 → 새 시작
  - 플레이어의 hand가 비면 → 라운드 종료
  - 순위 계산 + 점수 부여

Step 5.6: 게임 종료 판정 & 코인 분배
  - 승수제: 누군가 N승 달성
  - 점수제: 모든 라운드 완료 → 최저 점수 승리
  - 무제한: 호스트가 종료 결정
  - 최종 1등에게 totalPot 전액 지급 (Cloud Functions)

Step 5.7: 보안 (Cloud Functions + Firestore Rules)
  - 카드 배분: 서버에서만 실행
  - 카드 제출 유효성: 서버에서만 검증
  - 핸드 정보: 본인 것만 읽기 가능
  - 코인 변동: 서버에서만 처리
```

### Phase 6: UI 구현 (3~5일)

```
Step 6.1: 스플래시 화면
  - 로고 애니메이션
  - Firebase 초기화

Step 6.2: 메인 화면
  - 로고 + 게임 이름
  - "방 만들기" / "공개 방 목록" / "코드로 입장" 버튼
  - 코인 잔액 + 충전 버튼
  - 프로필/설정 아이콘
  - 하단 배너 광고

Step 6.3: 게임 설정 화면
  - Public/Private 토글
  - 카드 범위 슬라이더
  - 조커 수 선택
  - 라운드 설정
  - 승리 조건 토글
  - 참가비 설정

Step 6.4: 공개 방 목록 화면
  - 방 카드 리스트 (정보 + 참가 버튼)
  - 새로고침

Step 6.5: 대기실 화면
  - 방 정보 + 총 상금
  - 방 코드 + 공유 (Private)
  - 참가자 리스트
  - 시작/나가기 버튼

Step 6.6: 게임 화면 (가장 복잡)
  - 상대방 영역 (원형 배치, 남은 카드 수)
  - 중앙 플레이 영역 (카드 애니메이션, 총 상금)
  - 내 패 (선택 가능, 드래그 or 탭)
  - 내기/패스 버튼
  - 턴 타이머 (선택)

Step 6.7: 라운드 결과 화면
  - 순위 애니메이션
  - 점수 변동
  - 다음 라운드 / 홈 버튼

Step 6.8: 최종 결과 화면
  - 우승자 트로피 애니메이션
  - 코인 획득 연출
  - 최종 순위 + 점수
  - 다시하기 / 홈 버튼
  - 하단 배너 광고

Step 6.9: 코인 상점 화면
  - 패키지 리스트
  - 특특대 강조 디자인
  - 구매 플로우

Step 6.10: 스킨 상점 화면 (후순위)
  - 카드 스킨 리스트
  - 미리보기
  - 코인으로 구매
```

### Phase 7: 광고 연동 (1~2일)

```
Step 7.1: AdMob 계정 설정
  - AdMob 앱 등록 (iOS + Android)
  - 광고 단위 생성: 배너 2개, 전면 1개, 보상형 1개
  - 테스트 광고 ID 사용하여 개발

Step 7.2: 배너 광고 구현
  - 메인 화면 하단
  - 최종 결과 화면 하단
  - google_mobile_ads 패키지 사용

Step 7.3: 전면 광고 구현
  - 라운드 결과에서 버튼 누를 때
  - 최종 결과에서 버튼 누를 때
  - 사전 로드 (preload) → 즉시 표시
  - 광고 닫히면 목적지로 네비게이션

Step 7.4: 보상형 광고 구현
  - 메인 화면 "광고 보고 100코인" 버튼
  - 일일 5회 제한 표시 (n/5)
  - 광고 완료 → 서버에서 코인 지급
```

### Phase 8: 테스트 & 폴리시 (2~3일)

```
Step 8.1: 게임 로직 단위 테스트
  - 카드 배분 정확성
  - 유효성 검증 로직
  - 승리 판정 로직
  - 코인 증감 로직

Step 8.2: 통합 테스트
  - 2인 게임 플로우
  - 다인원 게임 플로우
  - Public 방 참가 플로우
  - 중도 이탈 처리 (참가비 몰수)
  - 네트워크 끊김 대응
  - IAP 구매 → 코인 지급 플로우

Step 8.3: UI 폴리시
  - 카드 애니메이션
  - 전환 애니메이션
  - 코인 획득 연출
  - 사운드 효과
  - 햅틱 피드백

Step 8.4: 성능 최적화
  - Firestore 읽기 횟수 최적화
  - 이미지 에셋 최적화
  - 앱 크기 최적화
```

### Phase 9: 출시 준비 (1~2일)

```
Step 9.1: 스토어 준비
  - 앱 아이콘 제작
  - 스크린샷 5장 (각 플랫폼)
  - 앱 설명 작성 (한국어 + 영어)
  - 개인정보 처리방침 페이지
  - 이용약관 (코인/IAP 관련 필수)

Step 9.2: 등급 심사
  - GRAC 등급 심사 신청 (사행성 요소로 15+ 또는 19+ 예상)
  - App Store 연령 등급 설정
  - Google Play 콘텐츠 등급 설정

Step 9.3: iOS 출시
  - Apple Developer 계정 ($99/년)
  - App Store Connect 앱 등록
  - IAP 상품 등록 + 심사
  - TestFlight 베타 테스트
  - 심사 제출

Step 9.4: Android 출시
  - Google Play Console 계정 ($25 1회)
  - 앱 등록 + IAP 상품 등록
  - 내부 테스트 → 프로덕션

Step 9.5: ONE Store 출시
  - 개발자 등록 (무료)
  - 앱 등록 + IAP 상품 등록
  - 심사 제출
```

---

## 12. 비용 정리

### 초기 비용 (출시까지)

| 항목 | 비용 | 비고 |
|------|------|------|
| Apple Developer | $99/년 | 필수 |
| Google Play | $25 (1회) | 필수 |
| ONE Store | $0 | 무료 |
| Firebase | $0 | 무료 티어로 시작 |
| AdMob | $0 | 무료 |
| 도메인 (개인정보처리방침) | ~$12/년 | GitHub Pages 쓰면 무료 |
| **합계** | **~$124** | |

### 월간 운영 비용

| DAU | Firebase | 기타 | 월 합계 |
|-----|---------|------|--------|
| ~1,000 | $0 (무료 범위) | $0 | **$0** |
| ~5,000 | $5~15 | $0 | **$5~15** |
| ~10,000 | $10~30 | $0 | **$10~30** |
| ~50,000 | $50~150 | $0 | **$50~150** |

---

## 13. 타임라인 요약

| Phase | 내용 | 예상 기간 |
|-------|------|----------|
| 1 | 프로젝트 세팅 | 1~2일 |
| 2 | 인증 시스템 | 1~2일 |
| 3 | 코인 시스템 + IAP | 2~3일 |
| 4 | 방 시스템 (Public/Private) | 2~3일 |
| 5 | 게임 로직 | 3~5일 |
| 6 | UI 구현 | 3~5일 |
| 7 | 광고 연동 | 1~2일 |
| 8 | 테스트 & 폴리시 | 2~3일 |
| 9 | 출시 준비 (3개 스토어) | 1~2일 |
| **합계** | | **~16~27일** |

※ 디자인 (Figma) 작업은 Phase 6 전에 별도 진행

---

## 14. 디자인 시스템 (확정)

### 테마: Clean Ivory
- 폰트: **Plus Jakarta Sans** (Google Fonts)
- 톤: 깔끔, 친근, 모던
- 배경: 오프 화이트 (#FAFAF9)
- 포인트: 딥 인디고 (#4F46E5)

### 컬러 팔레트

| 토큰 | Hex | 용도 |
|------|-----|------|
| `primary` | #4F46E5 | 주요 버튼, 강조 |
| `primary-light` | #818CF8 | 호버, 선택 |
| `primary-dark` | #3730A3 | 눌림 상태 |
| `on-primary` | #FFFFFF | 주요 버튼 위 텍스트 |
| `background` | #FAFAF9 | 앱 배경 |
| `surface` | #FFFFFF | 카드, 패널 |
| `surface-variant` | #F5F5F4 | 입력창, 비활성 |
| `on-background` | #1C1917 | 본문 텍스트 |
| `on-surface` | #44403C | 보조 텍스트 |
| `on-surface-variant` | #78716C | 비활성 텍스트 |
| `error` | #DC2626 | 에러 |
| `success` | #16A34A | 성공, 승리 |
| `coin` | #F59E0B | 코인 관련 |
| `outline` | #E7E5E4 | 구분선, 테두리 |

### 타이포그래피 (Plus Jakarta Sans)

| 토큰 | 크기 | 굵기 | 행간 |
|------|------|------|------|
| `display-lg` | 40px | ExtraBold (800) | 48px |
| `display-md` | 32px | Bold (700) | 40px |
| `heading-lg` | 24px | SemiBold (600) | 32px |
| `heading-md` | 20px | SemiBold (600) | 28px |
| `heading-sm` | 18px | Medium (500) | 24px |
| `body-lg` | 16px | Regular (400) | 24px |
| `body-md` | 14px | Regular (400) | 20px |
| `body-sm` | 12px | Regular (400) | 16px |
| `label-lg` | 16px | SemiBold (600) | 20px |
| `label-md` | 14px | SemiBold (600) | 18px |
| `label-sm` | 12px | Medium (500) | 16px |
| `number-lg` | 48px | ExtraBold (800) | 56px |
| `number-md` | 32px | Bold (700) | 40px |
| `number-sm` | 20px | SemiBold (600) | 28px |

### 스페이싱

| 토큰 | 값 |
|------|-----|
| `space-2xs` | 2px |
| `space-xs` | 4px |
| `space-sm` | 8px |
| `space-md` | 12px |
| `space-lg` | 16px |
| `space-xl` | 24px |
| `space-2xl` | 32px |
| `space-3xl` | 48px |

### Border Radius

| 토큰 | 값 |
|------|-----|
| `radius-sm` | 4px |
| `radius-md` | 8px |
| `radius-lg` | 12px |
| `radius-xl` | 16px |
| `radius-full` | 999px |

---

## 15. 데이터 스키마 (확정)

### Firestore 컬렉션 구조

```
firestore/
├── users/{uid}                    ← 유저 정보
├── rooms/{roomCode}               ← 방 정보 (대기실)
├── games/{gameId}                 ← 게임 진행 상태
│   └── hands/{uid}                ← 각 플레이어 핸드 (서브컬렉션)
├── transactions/{txId}            ← 코인 거래 기록
└── skins/{skinId}                 ← 스킨 상품 목록
```

### users/{uid}

```javascript
{
  uid: string,
  nickname: string,               // 게스트: 랜덤, 수정 가능
  authType: "anonymous" | "google" | "apple",
  coins: number,                  // 현재 잔액 (초기 1,000)
  totalCoinsEarned: number,
  totalCoinsSpent: number,
  dailyAdCount: number,           // 오늘 보상형 광고 횟수
  lastAdResetDate: string,        // "2026-03-04"
  stats: {
    totalGames: number,
    wins: number,
    winRate: number,
    currentStreak: number,
    maxStreak: number,
    totalCoinsWon: number,
  },
  ownedSkins: string[],           // ["default", "gold"]
  equippedSkin: string,
  titles: string[],               // ["대부"]
  equippedTitle: string | null,
  currentRoomCode: string | null, // 중복 입장 방지
  createdAt: Timestamp,
  lastActiveAt: Timestamp,
  fcmToken: string | null,
}
```

### rooms/{roomCode}

```javascript
{
  code: string,                   // "A3K7"
  hostUid: string,
  isPublic: boolean,
  settings: {
    maxPlayers: number,           // 2~10
    cardRange: number,            // 8~15
    jokerCount: number,           // 0~4
    totalRounds: number,          // 1~10, 0 = 무제한
    winCondition: "points" | "wins",
    betMultiplier: number,        // α (0~9)
  },
  entryFee: number,               // 100 + 100 * α
  players: [{
    uid: string,
    nickname: string,
    equippedSkin: string,
    equippedTitle: string | null,
    joinedAt: Timestamp,
  }],
  playerCount: number,
  status: "waiting" | "playing" | "finished",
  gameId: string | null,
  createdAt: Timestamp,
  expiresAt: Timestamp,           // +30분
}
```

### games/{gameId}

```javascript
{
  gameId: string,
  roomCode: string,
  settings: { cardRange, jokerCount, totalRounds, winCondition },
  entryFee: number,
  totalPot: number,
  players: [{
    uid: string,
    nickname: string,
    skin: string,
    handCount: number,            // 남은 카드 수 (공개)
    score: number,
    roundWins: number,
    isOut: boolean,
    isDisconnected: boolean,
    finishOrder: number | null,
  }],
  currentRound: number,
  turn: {
    currentPlayerIndex: number,
    pile: {
      cards: [{ number: number, isJoker: boolean }],
      playedByUid: string,
      quantity: number,
      value: number,
    } | null,                     // null = 새 시작
    passCount: number,
    activePlayers: number,
  },
  roundResults: [{
    round: number,
    rankings: [{ uid, nickname, rank, score }],
  }],
  status: "dealing" | "playing" | "roundEnd" | "gameEnd",
  finalResult: {
    winnerUid: string,
    winnerNickname: string,
    rankings: [{ uid, nickname, totalScore, rank }],
    potAwarded: boolean,
  } | null,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  finishedAt: Timestamp | null,
}
```

### games/{gameId}/hands/{uid} (서브컬렉션 - 본인만 읽기)

```javascript
{
  uid: string,
  cards: [{ number: number, isJoker: boolean }],
  cardCount: number,
  updatedAt: Timestamp,
}
```

### transactions/{txId}

```javascript
{
  txId: string,
  uid: string,
  type: "signup_bonus" | "ad_reward" | "iap_purchase" | "game_entry"
      | "game_entry_refund" | "game_win" | "skin_purchase",
  amount: number,                 // +획득 / -소비
  balanceAfter: number,
  relatedGameId: string | null,
  relatedRoomCode: string | null,
  relatedIapProductId: string | null,
  relatedSkinId: string | null,
  receipt: {
    store: "apple" | "google" | "onestore",
    receiptData: string,
    verified: boolean,
  } | null,
  createdAt: Timestamp,
}
```

### skins/{skinId}

```javascript
{
  skinId: string,
  name: string,
  description: string,
  price: number,                  // 코인
  previewImageUrl: string,
  rarity: "common" | "rare" | "epic" | "legendary",
  isAvailable: boolean,
  sortOrder: number,
  createdAt: Timestamp,
}
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth.uid == uid;
      allow create: if request.auth.uid == uid;
      allow update: if request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['coins', 'totalCoinsEarned', 'totalCoinsSpent', 'stats']);
    }
    match /rooms/{roomCode} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null
        && (request.auth.uid == resource.data.hostUid
            || request.resource.data.diff(resource.data).affectedKeys()
              .hasOnly(['players', 'playerCount']));
    }
    match /games/{gameId} {
      allow read: if request.auth.uid in resource.data.players.map(p => p.uid);
      allow write: if false;
      match /hands/{uid} {
        allow read: if request.auth.uid == uid;
        allow write: if false;
      }
    }
    match /transactions/{txId} {
      allow read: if request.auth.uid == resource.data.uid;
      allow write: if false;
    }
    match /skins/{skinId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### Cloud Functions 목록

| Function | 트리거 | 하는 일 |
|----------|--------|--------|
| `onUserCreate` | Auth onCreate | 유저 문서 생성, 1,000코인 지급 |
| `claimAdReward` | HTTPS callable | 5회 제한 체크, 100코인 지급 |
| `purchaseCoins` | HTTPS callable | IAP 영수증 검증, 코인 지급 |
| `createRoom` | HTTPS callable | 방 생성, 참가비 차감 |
| `joinRoom` | HTTPS callable | 입장 검증, 참가비 차감 |
| `leaveRoom` | HTTPS callable | 퇴장, 대기 중이면 환불 |
| `startGame` | HTTPS callable | 덱 생성, 셔플, 핸드 배분 |
| `playCards` | HTTPS callable | 유효성 검증, 카드 제출, 턴 진행 |
| `passTurn` | HTTPS callable | 패스 처리, 새 시작 판정 |
| `endRound` | 자동 | 순위 계산, 점수 부여 |
| `endGame` | 자동 | 1등에게 totalPot 지급 |
| `cleanupExpiredRooms` | Scheduled (5분) | 만료된 방 삭제, 참가비 환불 |
| `purchaseSkin` | HTTPS callable | 코인 차감, 스킨 부여 |

### 에러/엣지 케이스

| 상황 | 처리 |
|------|------|
| 코인 부족 입장 | 클라이언트+서버 모두 검증 → 에러 |
| 방 꽉 참 | playerCount 체크 → 에러 |
| 중복 방 입장 | currentRoomCode 체크 → 에러 |
| 게임 중 플레이어 나감 | isDisconnected, 자동 패스, 참가비 몰수 |
| 호스트 나감 (대기실) | 다음 플레이어에게 이관 |
| 모두 나감 | 방 삭제, 남은 1명 자동 승리 |
| 네트워크 끊김 | 오프라인 캐시 + 재접속 복구 |
| 동시 카드 제출 | 트랜잭션으로 원자성 보장 |
| IAP 결제 성공 + 코인 미지급 | 영수증 저장, 재검증 가능 |
| 균등 배분 안 되는 카드 | 가장 높은 숫자 카드부터 제거 |
| 앱 강제 종료 | gameId로 게임 화면 복귀 |

---

## 16. 미결정 사항 (추후 결정)

- [ ] 참가비 배율별 네이밍
- [ ] 코인 상점 패키지 네이밍
- [ ] 특특대 칭호/뱃지 디자인
- [ ] 앱 로고 디자인
- [ ] 카드 비주얼 디자인 (숫자만? 일러스트?)
- [ ] 카드 스킨 종류 및 가격
- [ ] 사운드 에셋
- [ ] 턴 타이머 필요 여부 (30초? 없음?)
- [ ] 나머지 카드 처리 (균등 배분 안 될 때)
- [ ] 언어 지원 범위 (한국어만? 영어도?)
- [ ] GRAC 등급 (15+ vs 19+) 전략
