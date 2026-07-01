// ALL OUT (올아웃) — 색 기반 UNO 변형 셰딩 게임. shared wire types.
//
// 손패를 가장 먼저 비우면 1등. 색(빨/노/파/초)·숫자(1~13) 매칭으로 카드를 내고,
// +2/+4/+7 누적 공격, Shield/Reflect 방어, Exchange(손패 교환)·Reverse·색변환 같은
// 기능 카드를 섞는다. 여러 판을 돌려 순위 합(낮을수록 우승)으로 챔피언을 가린다.
//
// 권위 서버: 덱/딜/검증/랜덤/승패/점수는 서버 모듈에만. 손패·뽑은 카드는
// getStateFor(playerId)로만 전달하고 getPublicState()엔 handCount만 노출한다.
// 색 선택(+4/+7/Exchange/Reflect/색변환)과 Exchange 대상은 play 액션 payload에
// 실어 보내 별도 대기 phase 없이 처리한다(추방 데드락 회피).

export type AlloutColor = "red" | "yellow" | "blue" | "green";
export const ALLOUT_COLORS: AlloutColor[] = ["red", "yellow", "blue", "green"];

// 색무관 kind: plus4 plus7 exchange reflect wild. 색있는 kind: number plus2 reverse shield.
export type AlloutCard =
  | { id: string; kind: "number"; color: AlloutColor; value: number } // value 1..13
  | { id: string; kind: "plus2"; color: AlloutColor }
  | { id: string; kind: "plus4" }
  | { id: string; kind: "plus7" }
  | { id: string; kind: "exchange" }
  | { id: string; kind: "reverse"; color: AlloutColor }
  | { id: string; kind: "shield"; color: AlloutColor }
  | { id: string; kind: "reflect" }
  | { id: string; kind: "wild" }; // 색변환

export type AlloutKind = AlloutCard["kind"];
export const ALLOUT_COLORLESS: AlloutKind[] = ["plus4", "plus7", "exchange", "reflect", "wild"];
export const ALLOUT_ATTACK: AlloutKind[] = ["plus2", "plus4", "plus7"];

// 공격 카드별 누적 장수.
export const alloutAttackAmount = (kind: AlloutKind): number =>
  kind === "plus2" ? 2 : kind === "plus4" ? 4 : kind === "plus7" ? 7 : 0;

// 옵션은 in-game setup phase에서 설정하므로 로비 옵션은 비운다.
export type AlloutOptions = Record<string, never>;
export const defaultAlloutOptions: AlloutOptions = {};

export const ALLOUT_ROUNDS_MIN = 1;
export const ALLOUT_ROUNDS_MAX = 10;
export const ALLOUT_ROUNDS_DEFAULT = 3;
export const ALLOUT_BANKRUPT_MIN = 8; // 시작 7장 초과
export const ALLOUT_BANKRUPT_MAX = 20;
export const ALLOUT_BANKRUPT_DEFAULT = 15;
export const ALLOUT_START_HAND = 7;

export type AlloutPhase = "setup" | "play" | "roundEnd" | "ended";

export type AlloutPlayerPublic = {
  playerId: string;
  handCount: number;
  rank: number | null; // 이번 라운드 등수(1=1등), 진행 중이면 null
  cumulativeScore: number; // 라운드 등수 합(낮을수록 우승)
  finished: boolean; // 이번 라운드 완주(손패 0) 또는 파산 탈락
  bankrupt: boolean; // 파산으로 탈락
};

export type AlloutTop = {
  card: AlloutCard; // 마지막으로 놓인 카드
  color: AlloutColor; // 매칭 기준 색(색무관 카드면 지정색)
};

export type AlloutEndVote = { proposedBy: string; votes: Record<string, boolean> };

export type AlloutPublicState = {
  phase: AlloutPhase;
  roundNumber: number; // 1-based
  totalRounds: number;
  bankruptcyOn: boolean;
  bankruptcyLimit: number;
  doubleDeck: boolean; // 9~16명이면 덱 2배
  drawPileCount: number;
  order: string[]; // 좌석/턴 순서(라운드 시작 시 직전 등수순)
  players: AlloutPlayerPublic[];
  currentTurnPlayerId: string | null;
  direction: 1 | -1; // 1=정방향
  top: AlloutTop | null;
  pendingAttack: number; // 누적 공격 장수(0=없음)
  attackFromId: string | null; // 직전에 공격을 얹은 사람(Reflect 대상 계산용)
  drawnPendingPlayerId: string | null; // draw 후 그 카드로 낼지/패스할지 대기 중인 플레이어
  lastRoundRanking: string[] | null;
  endVote: AlloutEndVote | null;
};

export type AlloutPrivateState = {
  hand: AlloutCard[]; // 내 손패(정렬: 색→숫자→기능)
  drawnCardId: string | null; // 방금 뽑아 아직 낼지 결정 안 한 카드 id
};

// --- action payloads (carried on { type: "game:action"; action: GameAction }) ---

export type AlloutConfigurePayload = {
  totalRounds: number; // [MIN,MAX] clamp
  bankruptcyOn: boolean;
  bankruptcyLimit: number; // [MIN,MAX] clamp
};

export type AlloutPlayPayload = {
  cards: string[]; // 카드 id들(순서 = 놓는 순서, 마지막이 색 기준)
  chosenColor?: AlloutColor; // 색무관 카드를 낼 때 필수
  exchangeTargetId?: string; // exchange를 낼 때 필수
};

export type AlloutVoteEndPayload = { agree: boolean };

export const ALLOUT_ACTIONS = {
  configure: "allout:configure", // host: setup -> play(라운드 1)
  play: "allout:play",
  draw: "allout:draw", // 공격 중=더미 받기 / 평상시=1장 뽑기
  pass: "allout:pass", // draw 후 안 내고 턴 종료
  nextRound: "allout:nextRound", // host: roundEnd -> 다음 라운드
  proposeEnd: "allout:proposeEnd",
  voteEnd: "allout:voteEnd",
} as const;

// 덱 배수: 9명 이상이면 2배.
export const alloutDeckCopies = (playerCount: number): number => (playerCount >= 9 ? 2 : 1);
