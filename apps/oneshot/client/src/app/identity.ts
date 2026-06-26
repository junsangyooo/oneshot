import { create } from "zustand";
import { DEFAULT_AVATAR_ID } from "../design/avatars";
import { storage } from "./storage";

/* local player identity (nickname + chosen avatar), persisted.
   nickname also syncs to the server via room:updateNickname. */
const AVATAR_KEY = "oneshot.avatar";

type Identity = {
  nickname: string;
  avatarId: string;
  setNickname: (nickname: string) => void;
  setAvatar: (avatarId: string) => void;
};

export const useIdentity = create<Identity>((set) => ({
  nickname: storage.getNickname(),
  avatarId: globalThis.localStorage?.getItem(AVATAR_KEY) ?? DEFAULT_AVATAR_ID,
  setNickname: (nickname) => {
    storage.setNickname(nickname);
    set({ nickname });
  },
  setAvatar: (avatarId) => {
    globalThis.localStorage?.setItem(AVATAR_KEY, avatarId);
    set({ avatarId });
  },
}));
