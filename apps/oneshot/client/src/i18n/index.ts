import { create } from "zustand";
import type { GameId } from "@oneshot/shared";

/* =========================================================
   i18n — add a language by adding a `Lang` + a dict entry.
   HUD "system" codes (SECTOR_ACCESS_CODE etc.) stay English
   by design; only user-facing copy lives here.
   ========================================================= */
export const LANGS = ["ko", "en"] as const;
export type Lang = (typeof LANGS)[number];

/** label shown inside the language toggle circle */
export const LANG_LABEL: Record<Lang, string> = { ko: "KR", en: "EN" };

type Dict = Record<string, string>;

const ko: Dict = {
  "home.tagline": "파티 캘리브레이션 시스템",
  "home.nickname": "식별 닉네임",
  "home.nicknamePlaceholder": "이름을 입력하세요...",
  "home.code": "방 섹터 코드",
  "home.optional": "선택",
  "home.create": "방 만들기",
  "home.join": "입장하기",
  "home.config": "오퍼레이터 설정",
  "home.library": "게임 라이브러리",
  "home.modules": "모듈",

  "lobby.sectorCode": "섹터 접속 코드",
  "lobby.authLink": "초대 링크",
  "lobby.copyLink": "링크 복사",
  "lobby.scan": "모바일 입장 스캔",
  "lobby.sync": "암호화 동기화",
  "lobby.encryption": "로컬 암호화",
  "lobby.enabled": "활성화",
  "lobby.selectModule": "게임 선택",
  "lobby.priority": "우선순위: 높음",
  "lobby.available": "사용 가능한 모듈",
  "lobby.currentlySelected": "현재 선택됨",
  "lobby.players": "플레이어",
  "lobby.commanderOnly": "방장 전용",
  "lobby.initialize": "게임 시작",
  "lobby.settings": "설정",
  "lobby.closeRoom": "방 닫기",
  "lobby.operators": "참가자",
  "lobby.waitingFriend": "새로운 친구를 기다리는 중",
  "lobby.ranking": "세션 랭킹",
  "lobby.rankingNote": "// 이번 세션 승수",
  "lobby.loaded": "로드됨",
  "lobby.standby": "대기",
  "lobby.waitingHost": "방장 대기 중",
  "lobby.needPlayers": "인원 대기",
  "lobby.players_count": "명",
  "lobby.players_or_more_suffix": "명 이상",
  "lobby.minutes": "분",

  "role.commander": "방장",
  "role.temp": "임시 방장",
  "status.online": "온라인",
  "status.reconnecting": "복귀 중",
  "status.offline": "오프라인",

  "results.eyebrow": "// 캘리브레이션 사이클 완료",
  "results.title": "게임 종료",
  "results.champion": "최우수 오퍼레이터 // 챔피언",
  "results.score": "점수",
  "results.points": "점",
  "results.return": "방으로 돌아가기",
  "results.next": "다음 게임",
  "results.close": "방 닫기",

  "settings.title": "오퍼레이터 설정",
  "settings.language": "언어",
  "settings.theme": "테마",
  "settings.nickname": "식별 닉네임",
  "settings.avatar": "아바타 선택",
  "settings.units": "유닛",
  "settings.save": "저장",
  "settings.cancel": "취소",

  "error.title": "접속 실패",
  "error.retry": "다시 시도",
  "conn.establishing": "업링크 연결 중",
  "conn.establishingMsg": "섹터 그리드와 동기화 중입니다. 보안 채널이 협상되는 동안 대기하세요.",
  "conn.reconnecting": "재접속 중",
  "conn.reconnectingMsg": "보안 채널을 다시 연결하고 있습니다. 역할·좌석·패가 복원됩니다.",

  "action.home": "홈으로",
  "action.retry": "다시 시도",
  "action.findRoom": "다른 방 찾기",
  "state.notFound.title": "페이지를 찾을 수 없어요",
  "state.notFound.msg": "요청하신 페이지가 존재하지 않아요. 홈으로 돌아가 주세요.",
  "state.roomNotFound.title": "존재하지 않는 방",
  "state.roomNotFound.msg": "그 방 코드는 찾을 수 없어요. 코드를 다시 확인해 주세요.",
  "state.roomFull.title": "방이 가득 찼어요",
  "state.roomFull.msg": "이 방은 이미 친구들로 가득해요. 다른 방을 찾아보세요.",
  "state.roomExpired.title": "만료된 방이에요",
  "state.roomExpired.msg": "오래 비어 있어서 방이 닫혔어요.",
  "state.roomClosed.title": "방이 닫혔어요",
  "state.roomClosed.msg": "방장이 이 방을 종료했어요. 새 방을 만들거나 다른 방에 입장해 주세요.",
  "state.gameRunning.title": "게임 진행 중",
  "state.gameRunning.msg": "이미 게임이 시작되어 지금은 참여할 수 없어요.",
  "state.reconnectFailed.title": "재접속 실패",
  "state.reconnectFailed.msg": "세션이 만료됐어요. 새로 입장해 주세요.",
  "state.serverError.title": "일시적인 오류",
  "state.serverError.msg": "잠시 후 다시 시도해 주세요.",
  "state.kicked.title": "방에서 나왔어요",
  "state.kicked.msg": "방장이 당신을 방에서 내보냈어요.",
  "state.generic.title": "문제가 발생했어요",
  "state.generic.msg": "예상치 못한 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",

  "eject.title": "방 닫기 확인",
  "eject.body": "모든 참가자의 섹터를 종료하려고 합니다. 이 작업은 현재 사이클 내에서 되돌릴 수 없습니다.",
  "eject.abort": "취소",
  "eject.confirm": "방 닫기 실행",

  "king.loading": "게임 상태를 불러오는 중...",
  "king.round": "턴",
  "king.role.king": "왕",
  "king.endGame": "게임 종료",
  "king.setup.title": "왕게임 설정",
  "king.setup.chooseMode": "플레이 모드를 골라주세요",
  "king.setup.waitingHost": "방장이 모드를 정하는 중이에요...",
  "king.setup.start": "이 모드로 시작",
  "king.mode.free": "자유 모드",
  "king.mode.free.desc": "매 턴 카드만 나눠줘요. 왕이 마음대로 명령!",
  "king.mode.mild": "랜덤 · 순한맛",
  "king.mode.mild.desc": "가볍고 유쾌한 랜덤 미션이 나와요.",
  "king.mode.spicy": "랜덤 · 매운맛",
  "king.mode.spicy.desc": "수위 높고 과감한 랜덤 미션. 19+",
  "king.mode.custom": "랜덤 · 커스텀",
  "king.mode.custom.desc": "미션을 직접 골라 담아서 플레이해요.",
  "king.custom.title": "미션 담기",
  "king.custom.presetsMild": "순한맛 프리셋",
  "king.custom.presetsSpicy": "매운맛 프리셋",
  "king.custom.addOwn": "직접 만들기",
  "king.custom.placeholder": "미션을 입력하세요...",
  "king.custom.target1": "1명 대상",
  "king.custom.target2": "2명 대상",
  "king.custom.add": "담기",
  "king.custom.pool": "담은 미션",
  "king.custom.empty": "아직 담은 미션이 없어요. (최소 1개)",
  "king.custom.remove": "빼기",
  "king.custom.needOne": "미션을 최소 1개 담아주세요.",
  "king.card.kingTitle": "당신이 왕!",
  "king.card.kingHint": "이번 턴, 명령은 당신의 것.",
  "king.card.numberTitle": "당신의 번호",
  "king.card.numberHint": "호명되면 밝히세요.",
  "king.command.kingSuffix": "님이 왕이에요",
  "king.command.freeKing": "다음 턴 카드는 다시 섞여요. 왕의 명령을 내리세요!",
  "king.command.assign": "카드를 드래그해 대상을 채우세요",
  "king.command.tapHint": "또는 빈칸을 누르고 번호를 선택하세요",
  "king.command.numbers": "번호 카드",
  "king.command.confirm": "미션 공개",
  "king.command.waitingKing": "왕이 미션을 고르는 중이에요...",
  "king.command.nextTurn": "다음 턴",
  "king.reveal.prompt": "당신의 번호를 밝히세요!",
  "king.reveal.targeted": "당신이 지목됐어요",
  "king.reveal.waiting": "곧 미션이 공개돼요...",
  "king.reveal.title": "왕의 명령",
  "king.reveal.nextTurn": "다음 턴",
  "game.kinggame": "왕게임",
  "game.upstage": "업스테이지",
  "game.liar": "라이어",
  "game.fool-liar": "바보 라이어",
  "game.arithmetic": "사칙연산",
  "gametag.kinggame": "왕의 명령은 절대적!",
  "gametag.upstage": "카드를 모두 털어내자",
  "gametag.liar": "누가 거짓말을 하나요?",
  "gametag.fool-liar": "라이어인 듯 아닌 듯",
  "gametag.arithmetic": "계산은 빠르게!",
};

const en: Dict = {
  "home.tagline": "PARTY CALIBRATION SYSTEM",
  "home.nickname": "IDENTIFICATION NICKNAME",
  "home.nicknamePlaceholder": "ENTER_NAME...",
  "home.code": "ROOM SECTOR CODE",
  "home.optional": "OPTIONAL",
  "home.create": "CREATE ROOM",
  "home.join": "JOIN SECTOR",
  "home.config": "OPERATOR_CONFIG",
  "home.library": "GAME_LIBRARY",
  "home.modules": "MODULES",

  "lobby.sectorCode": "SECTOR_ACCESS_CODE",
  "lobby.authLink": "AUTHORIZATION_LINK",
  "lobby.copyLink": "COPY_LINK",
  "lobby.scan": "SCAN_FOR_MOBILE_ENTRY",
  "lobby.sync": "DIRECT_ENCRYPTION_SYNC",
  "lobby.encryption": "LOCAL_ENCRYPTION",
  "lobby.enabled": "ENABLED",
  "lobby.selectModule": "SELECT_MODULE",
  "lobby.priority": "PRIORITY: HIGH",
  "lobby.available": "AVAILABLE_MODULES",
  "lobby.currentlySelected": "CURRENTLY_SELECTED",
  "lobby.players": "PLAYERS",
  "lobby.commanderOnly": "COMMANDER_ONLY_ACCESS",
  "lobby.initialize": "INITIALIZE_SEQUENCE",
  "lobby.settings": "SETTINGS",
  "lobby.closeRoom": "CLOSE_ROOM",
  "lobby.operators": "OPERATORS_MANIFEST",
  "lobby.waitingFriend": "Waiting for a new friend",
  "lobby.ranking": "SESSION_RANKING",
  "lobby.rankingNote": "// WINS THIS SESSION",
  "lobby.loaded": "LOADED",
  "lobby.standby": "STANDBY",
  "lobby.waitingHost": "AWAITING COMMANDER",
  "lobby.needPlayers": "AWAITING PLAYERS",
  "lobby.players_count": " PLAYERS",
  "lobby.players_or_more_suffix": "+ PLAYERS",
  "lobby.minutes": " MIN",

  "role.commander": "COMMANDER",
  "role.temp": "TEMP_COMMAND",
  "status.online": "ONLINE",
  "status.reconnecting": "RECONNECTING",
  "status.offline": "OFFLINE",

  "results.eyebrow": "// CALIBRATION_CYCLE_COMPLETE",
  "results.title": "SEQUENCE COMPLETE",
  "results.champion": "TOP_OPERATOR // CHAMPION",
  "results.score": "SCORE",
  "results.points": "PTS",
  "results.return": "RETURN_TO_SECTOR",
  "results.next": "NEXT_MODULE",
  "results.close": "CLOSE_SECTOR",

  "settings.title": "OPERATOR_CONFIG",
  "settings.language": "LANGUAGE",
  "settings.theme": "THEME",
  "settings.nickname": "IDENTIFICATION_NICKNAME",
  "settings.avatar": "SELECT_AVATAR_UNIT",
  "settings.units": "UNITS",
  "settings.save": "SAVE_CONFIG",
  "settings.cancel": "CANCEL",

  "error.title": "CONNECTION FAILED",
  "error.retry": "RETRY",
  "conn.establishing": "ESTABLISHING UPLINK",
  "conn.establishingMsg": "Synchronizing with the sector grid. Hold position while the secure channel is negotiated.",
  "conn.reconnecting": "RECONNECTING",
  "conn.reconnectingMsg": "Re-establishing secure channel. Your role, seat and hand are being restored.",

  "action.home": "BACK_TO_HOME",
  "action.retry": "RETRY",
  "action.findRoom": "FIND_ANOTHER_ROOM",
  "state.notFound.title": "PAGE NOT FOUND",
  "state.notFound.msg": "The page you requested does not exist. Head back to home.",
  "state.roomNotFound.title": "SECTOR NOT FOUND",
  "state.roomNotFound.msg": "No active sector matches that code. Double-check the room code.",
  "state.roomFull.title": "SECTOR FULL",
  "state.roomFull.msg": "This room is already packed with friends. Try another one.",
  "state.roomExpired.title": "SECTOR EXPIRED",
  "state.roomExpired.msg": "The room was closed after sitting empty for too long.",
  "state.roomClosed.title": "SECTOR CLOSED",
  "state.roomClosed.msg": "The host closed this room. Create a new room or join another one.",
  "state.gameRunning.title": "GAME IN PROGRESS",
  "state.gameRunning.msg": "A game has already started, so you can't join right now.",
  "state.reconnectFailed.title": "RECONNECT FAILED",
  "state.reconnectFailed.msg": "Your session expired. Please join again.",
  "state.serverError.title": "TEMPORARY ERROR",
  "state.serverError.msg": "Something went wrong. Please try again in a moment.",
  "state.kicked.title": "REMOVED FROM ROOM",
  "state.kicked.msg": "The host removed you from the room.",
  "state.generic.title": "SOMETHING WENT WRONG",
  "state.generic.msg": "An unexpected problem occurred. Please try again shortly.",

  "eject.title": "CONFIRM_EJECT",
  "eject.body": "You are about to terminate the sector for all operators. This action is irreversible within the current calibration cycle.",
  "eject.abort": "ABORT",
  "eject.confirm": "CONFIRM_EJECT",

  "king.loading": "Loading game state...",
  "king.round": "ROUND",
  "king.role.king": "KING",
  "king.endGame": "END GAME",
  "king.setup.title": "KING GAME SETUP",
  "king.setup.chooseMode": "Choose a play mode",
  "king.setup.waitingHost": "The host is choosing a mode...",
  "king.setup.start": "START WITH THIS MODE",
  "king.mode.free": "FREE",
  "king.mode.free.desc": "Just deal cards each turn — the king commands freely!",
  "king.mode.mild": "RANDOM · MILD",
  "king.mode.mild.desc": "Light, playful random missions.",
  "king.mode.spicy": "RANDOM · SPICY",
  "king.mode.spicy.desc": "Bold, high-spice random missions. 19+",
  "king.mode.custom": "RANDOM · CUSTOM",
  "king.mode.custom.desc": "Build your own pool of missions.",
  "king.custom.title": "BUILD YOUR POOL",
  "king.custom.presetsMild": "MILD PRESETS",
  "king.custom.presetsSpicy": "SPICY PRESETS",
  "king.custom.addOwn": "MAKE YOUR OWN",
  "king.custom.placeholder": "Type a mission...",
  "king.custom.target1": "1 target",
  "king.custom.target2": "2 targets",
  "king.custom.add": "ADD",
  "king.custom.pool": "YOUR POOL",
  "king.custom.empty": "No missions yet. (at least one)",
  "king.custom.remove": "Remove",
  "king.custom.needOne": "Add at least one mission.",
  "king.card.kingTitle": "YOU ARE THE KING!",
  "king.card.kingHint": "This turn, the command is yours.",
  "king.card.numberTitle": "YOUR NUMBER",
  "king.card.numberHint": "Reveal it when you're called.",
  "king.command.kingSuffix": " is the King",
  "king.command.freeKing": "Cards reshuffle next turn. Give your royal command!",
  "king.command.assign": "Drag a card onto each blank",
  "king.command.tapHint": "or tap a blank, then pick a number",
  "king.command.numbers": "NUMBER CARDS",
  "king.command.confirm": "REVEAL MISSION",
  "king.command.waitingKing": "The king is choosing a mission...",
  "king.command.nextTurn": "NEXT TURN",
  "king.reveal.prompt": "Reveal your number!",
  "king.reveal.targeted": "You're the target",
  "king.reveal.waiting": "The mission is about to appear...",
  "king.reveal.title": "THE KING'S COMMAND",
  "king.reveal.nextTurn": "NEXT TURN",
  "game.kinggame": "KINGGAME",
  "game.upstage": "UPSTAGE",
  "game.liar": "LIAR",
  "game.fool-liar": "FOOL_LIAR",
  "game.arithmetic": "ARITHMETIC",
  "gametag.kinggame": "The king's word is law!",
  "gametag.upstage": "Shed all your cards first",
  "gametag.liar": "Who is lying?",
  "gametag.fool-liar": "Liar... or not?",
  "gametag.arithmetic": "Be quick on the math!",
};

const DICTS: Record<Lang, Dict> = { ko, en };

const STORAGE_KEY = "oneshot.lang";
const loadLang = (): Lang => {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  return saved && (LANGS as readonly string[]).includes(saved) ? (saved as Lang) : "ko";
};

type LangStore = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  cycle: () => void;
};

export const useLangStore = create<LangStore>((set, get) => ({
  lang: loadLang(),
  setLang: (lang) => {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
    set({ lang });
  },
  cycle: () => {
    const next = LANGS[(LANGS.indexOf(get().lang) + 1) % LANGS.length] ?? "ko";
    get().setLang(next);
  },
}));

/** translate a key in the active language (falls back to the key) */
export const useT = () => {
  const lang = useLangStore((s) => s.lang);
  return (key: string, fallback?: string) => DICTS[lang][key] ?? fallback ?? key;
};

/** localized game title, falling back to the server-provided title */
export const gameTitle = (lang: Lang, id: GameId, serverTitle: string): string =>
  DICTS[lang][`game.${id}`] ?? serverTitle;

/** short flavor tagline for a game */
export const gameTagline = (lang: Lang, id: GameId): string => DICTS[lang][`gametag.${id}`] ?? "";
