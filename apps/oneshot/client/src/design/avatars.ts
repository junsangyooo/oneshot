/* =========================================================
   Avatar units — the preset character icons a player can pick.
   Files live in /public/themes/<theme>/avatars/<id>.png
   `avatarKey` from the server maps onto one of these ids.
   ========================================================= */
export type AvatarAccent = "red" | "cyan" | "gold" | "gray";
export type Avatar = { id: string; label: string; accent: AvatarAccent };

export const AVATARS: Avatar[] = [
  { id: "cyborg", label: "CYBORG", accent: "cyan" },
  { id: "ninja", label: "NINJA", accent: "red" },
  { id: "samurai", label: "SAMURAI", accent: "red" },
  { id: "assassin", label: "ASSASSIN", accent: "red" },
  { id: "hawkeye", label: "HAWKEYE", accent: "gold" },
  { id: "alien", label: "ALIEN", accent: "cyan" },
  { id: "buddhist-nun", label: "MONK", accent: "gold" },
  { id: "fox", label: "FOX", accent: "gold" },
  { id: "wolf", label: "WOLF", accent: "cyan" },
  { id: "tiger", label: "TIGER", accent: "gold" },
  { id: "bear", label: "BEAR", accent: "red" },
  { id: "shark", label: "SHARK", accent: "cyan" },
  { id: "eagle", label: "EAGLE", accent: "gold" },
  { id: "owl", label: "OWL", accent: "cyan" },
  { id: "cat", label: "CAT", accent: "gold" },
  { id: "rabbit", label: "RABBIT", accent: "red" },
];

import type { ThemeId } from "../theme";

const FIRST = AVATARS[0]!;
export const DEFAULT_AVATAR_ID = FIRST.id;

export const avatarById = (id: string | undefined): Avatar =>
  AVATARS.find((a) => a.id === id) ?? FIRST;

/* themed avatar image: same character, theme-specific art.
   a player always renders in THEIR OWN theme. */
export const avatarSrc = (id: string | undefined, theme: ThemeId = "cyber"): string =>
  `/themes/${theme}/avatars/${avatarById(id).id}.png`;

/** stable mapping from any avatarKey string to one of our avatars */
export const resolveAvatar = (avatarKey: string | undefined): Avatar => {
  if (!avatarKey) return FIRST;
  const direct = AVATARS.find((a) => a.id === avatarKey);
  if (direct) return direct;
  // fall back: hash the key onto a slot so unknown keys are stable
  let hash = 0;
  for (let i = 0; i < avatarKey.length; i += 1) hash = (hash * 31 + avatarKey.charCodeAt(i)) >>> 0;
  return AVATARS[hash % AVATARS.length] ?? FIRST;
};
