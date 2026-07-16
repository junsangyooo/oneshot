import type { GameId } from "@oneshot/shared";
import type { ThemeId } from "../theme";

/* display-only meta for each game: terminal glyph icon + accent + a
   player-range fallback used on the home preview (the lobby uses the
   real catalog ranges from the server). */
export type GameMeta = {
  glyph: string;
  accent: "red" | "cyan" | "gold" | "gray";
  min: number;
  max: number | null;
};

export const GAME_META: Record<GameId, GameMeta> = {
  kinggame: { glyph: "♔", accent: "gold", min: 2, max: null },
  upstage: { glyph: "⛁", accent: "cyan", min: 3, max: null },
  liar: { glyph: "◎", accent: "red", min: 3, max: null },
  "fool-liar": { glyph: "✕", accent: "gray", min: 3, max: null },
  arithmetic: { glyph: "⌗", accent: "cyan", min: 2, max: null },
  allout: { glyph: "◆", accent: "red", min: 2, max: 16 },
  dice: { glyph: "⚄", accent: "cyan", min: 1, max: null },
  roulette: { glyph: "◉", accent: "gold", min: 1, max: 24 },
  rummikub: { glyph: "▤", accent: "gold", min: 2, max: 8 },
};

export const GAME_ORDER: GameId[] = [
  "kinggame",
  "upstage",
  "allout",
  "rummikub",
  "dice",
  "roulette",
  "liar",
  "fool-liar",
  "arithmetic",
];

export const gameMeta = (id: GameId): GameMeta =>
  GAME_META[id] ?? { glyph: "▣", accent: "gray", min: 2, max: null };

/* themed game thumbnail path (per theme). Render this when the active
   theme declares hasGameThumbs; otherwise fall back to the glyph icon. */
export const gameThumb = (id: GameId, theme: ThemeId): string => `/themes/${theme}/games/${id}.png`;
