import { create } from "zustand";

/* =========================================================
   Theme system — the top-level visual identity.
   Add a theme by: adding an id here + a token block in
   terminal.css ([data-theme="<id>"]) + dropping art into
   /public/themes/<id>/{avatars,games}/.
   ========================================================= */
export const THEMES = ["cyber", "cozy"] as const;
export type ThemeId = (typeof THEMES)[number];

export type ThemeMeta = {
  /** label shown in the theme picker */
  label: string;
  /** are themed avatar images present under /themes/<id>/avatars/ ? */
  hasAvatars: boolean;
  /** are themed game thumbnails present under /themes/<id>/games/ ? */
  hasGameThumbs: boolean;
};

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  cyber: { label: "CYBER", hasAvatars: true, hasGameThumbs: false },
  cozy: { label: "COZY", hasAvatars: true, hasGameThumbs: false },
};

export const isThemeId = (value: string | undefined): value is ThemeId =>
  !!value && (THEMES as readonly string[]).includes(value);

const STORAGE_KEY = "oneshot.theme";
const DEFAULT_THEME: ThemeId = "cyber";

const loadTheme = (): ThemeId => {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  return isThemeId(saved ?? undefined) ? (saved as ThemeId) : DEFAULT_THEME;
};

const applyTheme = (theme: ThemeId): void => {
  if (globalThis.document) document.documentElement.dataset.theme = theme;
};

type ThemeStore = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
};

export const useTheme = create<ThemeStore>((set) => ({
  theme: loadTheme(),
  setTheme: (theme) => {
    globalThis.localStorage?.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
}));

// apply on first load so there is no unthemed flash
applyTheme(loadTheme());
