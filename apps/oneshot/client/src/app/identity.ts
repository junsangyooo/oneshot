import { create } from "zustand";
import { AVATARS, DEFAULT_AVATAR_ID } from "../design/avatars";
import { storage } from "./storage";

/* local player identity (nickname + chosen avatar), persisted.
   nickname also syncs to the server via room:updateNickname. */
const AVATAR_KEY = "oneshot.avatar";

/* First visit: pick a random avatar (and persist it) instead of always the
   first one — otherwise every new player at the table looks identical. */
const initialAvatarId = (): string => {
  const stored = globalThis.localStorage?.getItem(AVATAR_KEY);
  if (stored) return stored;
  const pick = AVATARS[Math.floor(Math.random() * AVATARS.length)]?.id ?? DEFAULT_AVATAR_ID;
  globalThis.localStorage?.setItem(AVATAR_KEY, pick);
  return pick;
};

type Identity = {
  nickname: string;
  avatarId: string;
  setNickname: (nickname: string) => void;
  setAvatar: (avatarId: string) => void;
};

export const useIdentity = create<Identity>((set) => ({
  nickname: storage.getNickname(),
  avatarId: initialAvatarId(),
  setNickname: (nickname) => {
    storage.setNickname(nickname);
    set({ nickname });
  },
  setAvatar: (avatarId) => {
    globalThis.localStorage?.setItem(AVATAR_KEY, avatarId);
    set({ avatarId });
  },
}));
