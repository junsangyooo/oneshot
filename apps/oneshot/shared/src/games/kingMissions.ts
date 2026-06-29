// King Game — bilingual mission pack + render helpers.
//
// Missions are stored as language-agnostic TEMPLATES with target tokens:
//   {A} = the first targeted number-holder, {B} = the second (only for slots === 2).
// The server picks a mission (by id) and the targeted numbers; each CLIENT renders
// the template in its own language via renderMission(). The token text "{A}"/"{B}"
// is identical in ko and en and must never be translated.

export type KingMissionSpice = "mild" | "spicy";

export type KingMission = {
  id: string;
  slots: 1 | 2;
  spice: KingMissionSpice;
  ko: string; // template with {A} (and {B} iff slots === 2)
  en: string; // faithful translation, same tokens
};

// Adversarially-reviewed bilingual pack (mild/spicy x 1/2 targets). Mild contains
// zero sexual/skinship content; spicy is bold but stays within an adults-only
// safety line (no minors / coercion / real harm / hardcore-explicit content).
export const KING_MISSIONS: KingMission[] = [
  // --- mild, 1 target ---
  { id: "mild-s1-01", slots: 1, spice: "mild", ko: "{A}, 지금 당장 일어나서 아이돌 데뷔 무대처럼 30초 댄스 보여줘.", en: "{A}, stand up right now and give us a 30-second idol debut-stage dance." },
  { id: "mild-s1-02", slots: 1, spice: "mild", ko: "{A}, 여기 있는 사람 중 한 명 성대모사 해서 누군지 다 같이 맞히게 해.", en: "{A}, do an impression of someone in this room and make everyone guess who." },
  { id: "mild-s1-03", slots: 1, spice: "mild", ko: "{A}, 이 술자리가 끝날 때까지 모든 문장을 사극 말투로 말해.", en: "{A}, speak every sentence in old-timey royal-court drama style until this drinking session is over." },
  { id: "mild-s1-04", slots: 1, spice: "mild", ko: "{A}, 케첩이랑 사이다 섞어서 한 컵 만들고 표정 안 바꾸고 원샷해.", en: "{A}, mix ketchup with soda into one cup and chug it without changing your face." },
  { id: "mild-s1-05", slots: 1, spice: "mild", ko: "{A}, 지금 당장 엄마한테 전화해서 '갑자기 사랑한다고 말하고 싶었어'라고 말해.", en: "{A}, call your mom right now and say 'I just suddenly wanted to tell you I love you.'" },
  { id: "mild-s1-06", slots: 1, spice: "mild", ko: "{A}, 초등학생 때 가장 흑역사였던 별명이나 사건 하나 솔직하게 털어놔.", en: "{A}, confess your single most embarrassing nickname or moment from elementary school." },
  { id: "mild-s1-07", slots: 1, spice: "mild", ko: "{A}, 다음 차례 올 때까지 닭이 된 것처럼 꼬꼬댁거리면서 행동해.", en: "{A}, act like a chicken, clucking and all, until your next turn comes around." },
  { id: "mild-s1-08", slots: 1, spice: "mild", ko: "{A}, 눈앞에 안 보이는 라면 한 그릇 먹는 척을 30초 동안 리얼하게 연기해.", en: "{A}, mime eating an invisible bowl of ramen as realistically as you can for 30 seconds." },
  { id: "mild-s1-09", slots: 1, spice: "mild", ko: "{A}, 휴대폰 사진첩에서 제일 웃긴 셀카 하나 골라서 다 같이 보게 띄워.", en: "{A}, pull up the funniest selfie in your phone's camera roll and show it to everyone." },
  { id: "mild-s1-10", slots: 1, spice: "mild", ko: "{A}, 지금 마시는 음료를 광고하는 30초짜리 오버액션 홈쇼핑 멘트를 쳐.", en: "{A}, do a 30-second over-the-top home-shopping pitch advertising whatever you're drinking." },
  { id: "mild-s1-11", slots: 1, spice: "mild", ko: "{A}, 자기 콧구멍에 빨대 두 개 꽂고 다음 미션 나올 때까지 그대로 있어.", en: "{A}, stick two straws up your nostrils and keep them there until the next mission." },
  { id: "mild-s1-12", slots: 1, spice: "mild", ko: "{A}, 방금 한 입 먹은 안주를 세계적인 미슐랭 심사위원처럼 진지하게 평가해.", en: "{A}, review the snack you just bit into as seriously as a world-class Michelin judge." },
  // --- mild, 2 targets ---
  { id: "mild-s2-01", slots: 2, spice: "mild", ko: "{A}랑 {B} 가위바위보, 진 사람은 다음 판까지 이긴 사람 별명 끝에 '님' 붙여 부르기.", en: "{A} and {B} play rock-paper-scissors; the loser must add 'sir/ma'am' to the winner's name until the next round." },
  { id: "mild-s2-02", slots: 2, spice: "mild", ko: "{A}가 동작을 하나 하면 {B}는 거울처럼 똑같이 따라 하기, 10초 동안 안 틀리면 성공.", en: "{A} makes moves and {B} mirrors them exactly like a reflection for 10 seconds without messing up." },
  { id: "mild-s2-03", slots: 2, spice: "mild", ko: "{A}랑 {B}가 같이 일어나서 아이돌 후렴구 안무를 진지하게 듀엣으로 추기.", en: "{A} and {B} stand up and perform an idol chorus dance together as a dead-serious duet." },
  { id: "mild-s2-04", slots: 2, spice: "mild", ko: "{A}랑 {B} 팔씨름, 진 사람이 이긴 사람한테 '내가 졌습니다' 우렁차게 외치기.", en: "{A} and {B} arm-wrestle; the loser shouts 'I LOST!' to the winner at full volume." },
  { id: "mild-s2-05", slots: 2, spice: "mild", ko: "{A}가 한 문장 말하면 {B}가 똑같은 문장을 사투리로 통역해 주기.", en: "{A} says a sentence and {B} 'translates' it into an exaggerated regional dialect." },
  { id: "mild-s2-06", slots: 2, spice: "mild", ko: "{A}랑 {B}가 눈 안 깜빡이고 마주 보기, 먼저 웃거나 깜빡이는 사람이 패배.", en: "{A} and {B} have a staring contest; whoever laughs or blinks first loses." },
  { id: "mild-s2-07", slots: 2, spice: "mild", ko: "{A}랑 {B}가 합동으로 30초짜리 라면 광고 한 편을 즉석에서 만들어 연기하기.", en: "{A} and {B} improvise and act out a 30-second instant-noodle commercial together." },
  { id: "mild-s2-08", slots: 2, spice: "mild", ko: "{A}가 표정만으로 감정을 하나 보여주면 {B}가 무슨 감정인지 세 번 안에 맞히기.", en: "{A} acts out an emotion using only their face and {B} must guess it within three tries." },
  { id: "mild-s2-09", slots: 2, spice: "mild", ko: "{A}랑 {B}가 동시에 같은 단어를 외치는 텔레파시 게임, 세 번 안에 맞히면 둘 다 통과.", en: "{A} and {B} play telepathy and shout the same word at once; match within three tries and both pass." },
  { id: "mild-s2-10", slots: 2, spice: "mild", ko: "{A}가 {B}의 장점을 손발 오그라들게 과장해서 칭찬하고, {B}는 끝까지 무표정 유지하기.", en: "{A} showers {B} with cringe-level over-the-top compliments while {B} keeps a totally straight face the whole time." },
  // --- spicy, 1 target ---
  { id: "spicy-s1-01", slots: 1, spice: "spicy", ko: "{A}, 지금 입고 있는 속옷 색깔을 모두에게 큰 소리로 공개해.", en: "{A}, announce the color of the underwear you're wearing right now, out loud to everyone." },
  { id: "spicy-s1-02", slots: 1, spice: "spicy", ko: "{A}, 휴대폰 사진첩 맨 끝에서 세 번째 사진을 아무 설명 없이 모두에게 보여줘.", en: "{A}, show everyone the third-from-last photo in your camera roll with zero explanation." },
  { id: "spicy-s1-03", slots: 1, spice: "spicy", ko: "{A}, 살면서 가장 부끄러웠던 '술 마시고 한 짓'을 디테일까지 자백해.", en: "{A}, confess your most mortifying drunk moment ever, with full embarrassing detail." },
  { id: "spicy-s1-04", slots: 1, spice: "spicy", ko: "{A}, 30초 동안 네가 생각하는 가장 야한 표정과 윙크를 한 명씩 돌아가며 날려.", en: "{A}, spend 30 seconds giving each person your sexiest face and a wink, one by one." },
  { id: "spicy-s1-05", slots: 1, spice: "spicy", ko: "{A}, 지금 이 방에서 제일 끌리는 사람을 솔직하게 지목하고 그 이유까지 말해.", en: "{A}, honestly point out who in this room you find most attractive and say exactly why." },
  { id: "spicy-s1-06", slots: 1, spice: "spicy", ko: "{A}, 입에 얼음을 물고 다 녹을 때까지 가장 야한 목소리로 신음 연기를 해.", en: "{A}, hold an ice cube in your mouth and moan in your most seductive voice until it melts." },
  { id: "spicy-s1-07", slots: 1, spice: "spicy", ko: "{A}, 가장 최근에 보낸 카톡 다섯 개를 화면째로 모두에게 읽어줘.", en: "{A}, read your last five sent text messages out loud to everyone, screen and all." },
  { id: "spicy-s1-08", slots: 1, spice: "spicy", ko: "{A}, 트림이든 방귀든 지금 당장 사람들 앞에서 하나 시원하게 터뜨려.", en: "{A}, let out a burp or a fart right now, in front of everyone, no holding back." },
  { id: "spicy-s1-09", slots: 1, spice: "spicy", ko: "{A}, 야동에서 본 가장 변태 같은 장르를 솔직하게 실토해.", en: "{A}, fess up to the kinkiest genre you've ever searched for in porn." },
  { id: "spicy-s1-10", slots: 1, spice: "spicy", ko: "{A}, 의자를 끌어안고 헤어진 전 애인 이름을 부르며 진하게 키스 연기를 해.", en: "{A}, hug a chair and dramatically make out with it while calling your ex's name." },
  { id: "spicy-s1-11", slots: 1, spice: "spicy", ko: "{A}, 셔츠 안에 손 넣고 겨드랑이로 방귀 소리 한 곡 완성해서 들려줘.", en: "{A}, stick your hand in your shirt and play a full armpit-fart tune for everyone." },
  { id: "spicy-s1-12", slots: 1, spice: "spicy", ko: "{A}, 네 인생 최고의 '한 번도 안 들킨 비밀'을 지금 처음으로 털어놔.", en: "{A}, reveal the biggest secret you've never told anyone, right here, right now." },
  { id: "spicy-s1-13", slots: 1, spice: "spicy", ko: "{A}, 바닥에 엎드려서 가장 야한 자세 세 가지를 진지하게 시연해.", en: "{A}, get on the floor and seriously demonstrate three of your sexiest poses." },
  { id: "spicy-s1-14", slots: 1, spice: "spicy", ko: "{A}, 이 방에서 한 명을 골라 진지한 표정으로 즉석 작업 멘트를 날려.", en: "{A}, pick someone in this room and hit them with a serious pickup line on the spot." },
  // --- spicy, 2 targets ---
  { id: "spicy-s2-01", slots: 2, spice: "spicy", ko: "{A}는 {B}를 뒤에서 백허그한 자세로 다음 한 라운드 내내 안 떨어지고 버텨라.", en: "{A} back-hugs {B} from behind and stays locked in that pose without letting go for one entire round." },
  { id: "spicy-s2-02", slots: 2, spice: "spicy", ko: "{A}는 {B}의 무릎에 앉아서, {B}가 직접 안주 한 입을 먹여줄 때까지 안 일어난다.", en: "{A} sits on {B}'s lap and refuses to get up until {B} feeds them a bite of snack by hand." },
  { id: "spicy-s2-03", slots: 2, spice: "spicy", ko: "{A}와 {B}는 코끝이 닿을 만큼 가까이서 가장 야릇한 눈빛으로 눈싸움, 먼저 눈 피하거나 웃은 사람이 원샷.", en: "{A} and {B} get nose-to-nose for a staring contest with the most smoldering eyes possible, whoever looks away or laughs first downs their drink." },
  { id: "spicy-s2-04", slots: 2, spice: "spicy", ko: "{A}가 {B}의 귀에 대고 가장 느끼한 멘트를 속삭이고, {B}는 무표정을 끝까지 유지해라.", en: "{A} whispers the cheesiest pickup line into {B}'s ear while {B} must keep a totally straight face to the end." },
  { id: "spicy-s2-05", slots: 2, spice: "spicy", ko: "{A}와 {B}는 과자 하나를 양쪽 끝에서 동시에 물고, 가운데에서 누가 먼저 멈추나 빼빼로 게임 가즈아.", en: "{A} and {B} each bite one end of a single snack stick and play the Pepero game to see who chickens out first in the middle." },
  { id: "spicy-s2-06", slots: 2, spice: "spicy", ko: "{A}는 {B}의 목과 어깨를 30초 동안 안마하면서, 귀에 대고 느끼한 칭찬을 끊임없이 속삭여라.", en: "{A} massages {B}'s neck and shoulders for 30 seconds while whispering nonstop cheesy compliments into their ear." },
  { id: "spicy-s2-07", slots: 2, spice: "spicy", ko: "{A}와 {B}는 손목을 맞붙인 채로 다음 두 턴 동안 절대 떨어지지 마라, 화장실도 같이.", en: "{A} and {B} keep their wrists pressed together for the next two turns and can't separate, bathroom trips included." },
  { id: "spicy-s2-08", slots: 2, spice: "spicy", ko: "{A}는 {B}를 공주님 안기로 들어올려서 방 한 바퀴를 돌아라.", en: "{A} scoops {B} up in a princess carry and does one full lap around the room." },
  { id: "spicy-s2-09", slots: 2, spice: "spicy", ko: "{A}와 {B}는 서로 마주 보고 30초 동안 가장 유혹적인 표정으로 윙크 배틀, 먼저 웃으면 패배.", en: "{A} and {B} face off in a 30-second seductive wink battle, first one to laugh loses." },
  { id: "spicy-s2-10", slots: 2, spice: "spicy", ko: "{A}는 {B}의 손등에 입맞추고 '오늘 밤 제 술잔의 주인이 되어주세요'라고 진지하게 고백해라.", en: "{A} kisses the back of {B}'s hand and solemnly confesses, 'Be the owner of my glass tonight.'" },
  { id: "spicy-s2-11", slots: 2, spice: "spicy", ko: "{A}와 {B}는 등을 딱 붙이고 팔짱 낀 채 동시에 일어나는 데 성공할 때까지 도전해라.", en: "{A} and {B} sit back-to-back with arms linked and keep trying until they can stand up together in one go." },
  { id: "spicy-s2-12", slots: 2, spice: "spicy", ko: "{A}는 {B}의 눈을 가리고, {B}는 {A}가 먹여주는 미스터리 안주를 맛만으로 맞혀야 한다.", en: "{A} covers {B}'s eyes and {B} must guess the mystery snack {A} feeds them using taste alone." },
];

const MISSIONS_BY_ID: ReadonlyMap<string, KingMission> = new Map(
  KING_MISSIONS.map((mission) => [mission.id, mission]),
);

export const missionById = (id: string): KingMission | undefined => MISSIONS_BY_ID.get(id);

export const missionsBySpice = (spice: KingMissionSpice): KingMission[] =>
  KING_MISSIONS.filter((mission) => mission.spice === spice);

// A parsed mission template: literal text chunks interleaved with target slots.
// slot.index is 0 for {A}, 1 for {B}.
export type MissionTemplatePart =
  | { type: "text"; value: string }
  | { type: "slot"; index: number };

const SLOT_TOKENS: Record<string, number> = { A: 0, B: 1 };

export const parseMissionTemplate = (template: string): MissionTemplatePart[] => {
  const parts: MissionTemplatePart[] = [];
  const regex = /\{([AB])\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: template.slice(lastIndex, match.index) });
    }
    parts.push({ type: "slot", index: SLOT_TOKENS[match[1] ?? "A"] ?? 0 });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < template.length) {
    parts.push({ type: "text", value: template.slice(lastIndex) });
  }
  return parts;
};

// Substitute target labels into a template. fills[0] -> {A}, fills[1] -> {B}.
// A missing fill renders as a blank marker so partial states are still readable.
export const renderMission = (template: string, fills: Array<string | null | undefined>): string =>
  template.replace(/\{([AB])\}/g, (_, token: string) => {
    const value = fills[SLOT_TOKENS[token] ?? 0];
    return value != null && value !== "" ? value : "____";
  });
