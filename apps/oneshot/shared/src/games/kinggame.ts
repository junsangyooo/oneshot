export type KingGameOptions = {
  missionTemplates: string[];
  allowCustomMission: boolean;
};

export type KingGamePublicState = {
  phase: "assigning" | "awaiting_command" | "revealed" | "complete";
  round: number;
  kingPlayerId: string | null;
  availableNumbers: number[];
  command: KingGameCommand | null;
};

export type KingGamePrivateState = {
  role: "king" | "subject";
  number: number | null;
};

export type KingGameCommand = {
  kingPlayerId: string;
  targetPlayerId: string;
  targetNumber: number;
  mission: string;
  createdAt: number;
};

export type KingGameSetCommandPayload = {
  targetNumber: number;
  mission: string;
};

export const defaultKingGameOptions: KingGameOptions = {
  missionTemplates: [
    "가장 최근에 마신 사람과 잔을 부딪치기",
    "오른쪽 사람에게 짧은 칭찬하기",
    "모두에게 다음 건배사를 제안하기",
    "선택한 사람이 질문 하나에 답하기",
    "둘이 동시에 같은 단어 말하기",
    "지목한 사람이 10초 안에 노래 제목 말하기",
  ],
  allowCustomMission: true,
};
