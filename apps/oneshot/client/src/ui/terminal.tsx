import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { GameId } from "@oneshot/shared";
import { LANGS, LANG_LABEL, useLangStore, useT } from "../i18n";
import { THEMES, THEME_META, isThemeId, useTheme } from "../theme";
import type { ThemeId } from "../theme";
import { AVATARS, avatarSrc, resolveAvatar } from "../design/avatars";
import { gameMeta, gameThumb } from "../design/games";
import { useIdentity } from "../app/identity";
import { useRoomStore } from "../app/useRoomStore";
import { enterFullscreen, exitFullscreen, useFullscreen, useFullscreenPref } from "./useFullscreen";

/* fx overlays + HUD corner brackets — on every screen */
export const Backdrop = () => (
  <>
    <div className="fx fx--grid" />
    <div className="fx fx--scanlines" />
    <div className="fx fx--vignette" />
    <span className="corner corner--tl" />
    <span className="corner corner--tr" />
    <span className="corner corner--bl" />
    <span className="corner corner--br" />
  </>
);

/* One entry in the shared player rail. Games map their own state onto this. */
export type RailSeat = {
  id: string;
  countLabel: string; // hand size, "OUT", etc.
  turn?: boolean; // whose turn it is now
  accent?: "attacker" | "lead" | null; // extra emphasis (e.g. last attacker)
  badge?: string | null; // small status word ("패스", "한 장!")
  dim?: boolean; // finished / eliminated
  me?: boolean; // this seat is the viewer — gets a coloured avatar ring
  // Seconds left on this seat's clock. Rendered INSIDE the avatar (which dims
  // behind it) so "whose turn" and "how long left" are one glance, not two.
  timer?: number | null;
};

/* Shared player rail. A scrollable list of every player (icon + nickname +
   count + turn marker). It sits as a LEFT column on wide/landscape screens and
   collapses to a horizontal scroll strip on narrow/portrait screens (see the
   .game-rail rules in each screen's CSS). Keeping icon+nickname always visible
   makes turn order and hand sizes legible even with many players. */
export const GameRail = ({
  seats,
  players,
  nameOf,
}: {
  seats: RailSeat[];
  players: Record<string, { avatarKey: string; themeId: string } | undefined>;
  nameOf: (id: string) => string;
}) => (
  <aside className="game-rail" aria-label="players">
    {seats.map((s) => (
      <div
        key={s.id}
        className={[
          "rail-seat",
          s.turn ? "is-turn" : "",
          s.accent === "attacker" ? "is-attacker" : "",
          s.accent === "lead" ? "is-lead" : "",
          s.dim ? "is-out" : "",
          s.me ? "is-me" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={`rail-seat__face ${s.timer != null ? "is-ticking" : ""}`}>
          <AvatarImg avatarKey={players[s.id]?.avatarKey} themeId={players[s.id]?.themeId} />
          {s.timer != null ? <b className="rail-seat__timer">{s.timer}</b> : null}
        </span>
        <span className="rail-seat__body">
          <span className="rail-seat__name">{nameOf(s.id)}</span>
          {s.badge ? <span className="rail-seat__badge">{s.badge}</span> : null}
        </span>
        <span className="rail-seat__count">{s.countLabel}</span>
      </div>
    ))}
  </aside>
);

/* themed game thumbnail box. Tries /themes/<theme>/games/<id>.png and falls
   back to the terminal glyph when that theme has no art for the game yet —
   so themes can gain thumbnails one image at a time. */
export const GameIcon = ({ id }: { id: GameId }) => {
  const theme = useTheme((s) => s.theme);
  const meta = gameMeta(id);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id, theme]);
  if (failed) {
    return <span className={`glyph glyph--game glyph--${meta.accent}`}>{meta.glyph}</span>;
  }
  return (
    <span className={`glyph glyph--img glyph--game glyph--${meta.accent}`}>
      <img src={gameThumb(id, theme)} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
};

/* image-filled avatar box. A player always renders in THEIR OWN theme,
   so pass that player's themeId; falls back to the viewer's theme. */
export const AvatarImg = ({
  avatarKey,
  themeId,
}: {
  avatarKey: string | undefined;
  themeId?: string;
}) => {
  const current = useTheme((s) => s.theme);
  const theme: ThemeId = isThemeId(themeId) ? themeId : current;
  const a = resolveAvatar(avatarKey);
  return (
    <span className={`glyph glyph--img glyph--${a.accent}`}>
      <img src={avatarSrc(a.id, theme)} alt={a.label} loading="lazy" />
    </span>
  );
};

/* Settings trigger — icon-only so it reads at a glance in any language.
   The gear is the universally understood "settings" affordance; the label
   lives in aria-label/title instead of on screen. */
export const ConfigButton = ({ onClick }: { onClick: () => void }) => {
  const t = useT();
  const label = t("home.config");
  return (
    <button type="button" className="config-pill" onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M19.14 12.94a7.5 7.5 0 0 0 .05-.94 7.5 7.5 0 0 0-.05-.94l2.03-1.58a.49.49 0 0 0 .12-.62l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54A.49.49 0 0 0 13.92 2h-3.84a.49.49 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.72 8.47a.49.49 0 0 0 .12.62l2.03 1.58c-.04.31-.06.62-.06.94 0 .32.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.62l1.92 3.32c.12.22.38.3.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.62l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
        />
      </svg>
    </button>
  );
};

/* settings modal: nickname + avatar pick (local; nickname syncs via onSaveNickname) */
export const SettingsModal = ({
  open,
  onClose,
  onSaveNickname,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  onSaveNickname?: (nickname: string) => void;
  // Slot for screen-specific actions (e.g. a game's "end game vote"). Rendered
  // at the top of the body so leaving a game is where players look for it,
  // instead of every game inventing its own modal (CLAUDE.md §3-8).
  extra?: ReactNode;
}) => {
  const t = useT();
  const fullscreen = useFullscreen();
  const autoFullscreen = useFullscreenPref((s) => s.auto);
  const setAutoFullscreen = useFullscreenPref((s) => s.setAuto);
  const identity = useIdentity();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const roomState = useRoomStore((s) => s.roomState);
  const send = useRoomStore((s) => s.send);
  const [nickname, setNickname] = useState(identity.nickname);
  const [avatarId, setAvatarId] = useState(identity.avatarId);

  if (!open) return null;

  // Avatar (character icon) is locked once a game is running — see updateProfile.
  const inGame = roomState?.phase === "game";

  const save = () => {
    identity.setNickname(nickname.trim());
    if (!inGame) identity.setAvatar(avatarId);
    // theme is applied live on click; broadcast my profile if I'm in a room
    if (roomState) {
      send({
        type: "room:updateProfile",
        nickname: nickname.trim(),
        ...(inGame ? {} : { avatarKey: avatarId }),
        themeId: theme,
      });
    }
    onSaveNickname?.(nickname.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop open" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("settings.title")}</h3>
          <button type="button" className="x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {extra ? <div className="settings-extra">{extra}</div> : null}
          {/* Hidden entirely where the API doesn't exist (iPhone Safari) rather
              than shown as a button that does nothing. */}
          {fullscreen.supported ? (
            <div>
              <div className="field-head" style={{ marginBottom: 10 }}>
                <span>{t("settings.fullscreen")}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`btn btn--sm ${autoFullscreen ? "btn--primary" : ""}`}
                  aria-pressed={autoFullscreen}
                  onClick={() => {
                    setAutoFullscreen(!autoFullscreen);
                    if (!autoFullscreen) void enterFullscreen();
                  }}
                >
                  <span>{autoFullscreen ? t("settings.fullscreenOn") : t("settings.fullscreenOff")}</span>
                </button>
                {fullscreen.active ? (
                  <button type="button" className="btn btn--sm" onClick={() => void exitFullscreen()}>
                    <span>{t("settings.fullscreenExit")}</span>
                  </button>
                ) : null}
              </div>
              <p className="settings-note">{t("settings.fullscreenNote")}</p>
            </div>
          ) : null}
          <div>
            <div className="field-head" style={{ marginBottom: 10 }}>
              <span>{t("settings.language")}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`lang-dot ${l === lang ? "on" : ""}`}
                  onClick={() => setLang(l)}
                >
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="field-head" style={{ marginBottom: 10 }}>
              <span>{t("settings.theme")}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {THEMES.map((th) => (
                <button
                  key={th}
                  type="button"
                  className={`btn btn--sm ${th === theme ? "btn--primary" : ""}`}
                  onClick={() => setTheme(th)}
                >
                  <span>{THEME_META[th].label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <div className="field-head">
              <span>{t("settings.nickname")}</span>
              <span className="opt">{nickname.length}/12</span>
            </div>
            <input
              type="text"
              maxLength={12}
              value={nickname}
              placeholder={t("home.nicknamePlaceholder")}
              onChange={(e) => setNickname(e.currentTarget.value)}
            />
          </label>
          <div>
            <div className="field-head" style={{ marginBottom: 10 }}>
              <span>{t("settings.avatar")}</span>
              <span className="opt">
                {inGame ? t("settings.locked") : `${AVATARS.length} ${t("settings.units")}`}
              </span>
            </div>
            {inGame ? (
              <p className="settings-note">{t("settings.avatarLocked")}</p>
            ) : (
              <div className="avatar-grid">
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`avatar-opt ${a.id === avatarId ? "sel" : ""}`}
                    title={a.label}
                    onClick={() => setAvatarId(a.id)}
                  >
                    <img src={avatarSrc(a.id, theme)} alt={a.label} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn--sm" onClick={onClose}>
            <span>{t("settings.cancel")}</span>
          </button>
          <button type="button" className="btn btn--sm btn--primary" onClick={save}>
            <span>{t("settings.save")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* reusable rules / how-to-play modal. Each game passes its own localized title +
   paragraphs; reuses the shared .modal chrome (so it scrolls + themes for free). */
export const RulesModal = ({
  open,
  onClose,
  title,
  paragraphs,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  // Plain strings render as paragraphs; a node renders as-is so a game can slot
  // in visual examples (e.g. real tile faces) alongside the prose.
  paragraphs: ReactNode[];
}) => {
  const t = useT();
  if (!open) return null;
  return (
    <div className="modal-backdrop open" role="presentation" onMouseDown={onClose}>
      <div className="modal modal--rules" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="x" onClick={onClose} aria-label={t("rules.close")}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="rules-body">
            {paragraphs.map((p, i) =>
              typeof p === "string" ? <p key={i}>{p}</p> : <div key={i}>{p}</div>,
            )}
          </div>
        </div>
        <div className="modal-foot modal-foot--single">
          <button type="button" className="btn btn--sm btn--primary" onClick={onClose}>
            <span>{t("rules.close")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* reusable confirm dialog for destructive actions (kick / end game / close).
   Reuses the shared .modal chrome so it themes + scrolls for free. */
export const ConfirmModal = ({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
}) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop open" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>⚠ {title}</h3>
          <button type="button" className="x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="settings-note" style={{ lineHeight: 1.8 }}>{body}</p>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn--sm" onClick={onClose}>
            <span>{cancelLabel}</span>
          </button>
          <button
            type="button"
            className="btn btn--sm btn--danger"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            <span>● {confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* small readout block helper */
export const Readout = ({ lines, align }: { lines: ReactNode[]; align?: "right" }) => (
  <div className={`readout ${align === "right" ? "readout--r" : ""}`}>
    {lines.map((line, i) => (
      <div key={i}>{line}</div>
    ))}
  </div>
);
