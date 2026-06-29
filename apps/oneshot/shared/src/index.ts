export * from "./schema/domain";
export * from "./protocol/errors";
export * from "./protocol/messages";
export * from "./protocol/reconnectToken";
export * from "./games/catalog";
export * from "./games/kinggame";
export * from "./games/kingMissions";
export * from "./games/liar";
export * from "./games/liarCategories";

export const NICKNAME_MIN = 1;
export const NICKNAME_MAX = 16;

export const normalizeNickname = (raw: string): string =>
  raw.trim().replace(/\s+/g, " ").slice(0, NICKNAME_MAX);

export const isValidNickname = (raw: string): boolean => {
  const nickname = normalizeNickname(raw);
  return nickname.length >= NICKNAME_MIN && nickname.length <= NICKNAME_MAX;
};
