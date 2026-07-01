import { useState } from "react";
import type { ReactNode } from "react";
import { LANGS, LANG_LABEL, useLangStore, useT } from "../i18n";
import { THEMES, THEME_META, isThemeId, useTheme } from "../theme";
import type { ThemeId } from "../theme";
import { AVATARS, avatarSrc, resolveAvatar } from "../design/avatars";
import { useIdentity } from "../app/identity";
import { useRoomStore } from "../app/useRoomStore";

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
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <AvatarImg avatarKey={players[s.id]?.avatarKey} themeId={players[s.id]?.themeId} />
        <span className="rail-seat__body">
          <span className="rail-seat__name">{nameOf(s.id)}</span>
          {s.badge ? <span className="rail-seat__badge">{s.badge}</span> : null}
        </span>
        <span className="rail-seat__count">{s.countLabel}</span>
      </div>
    ))}
  </aside>
);

/* KR / EN language toggle (extensible: driven by LANGS) */
export const LangToggle = () => {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  return (
    <div className="lang-toggle">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={`lang-dot ${l === lang ? "on" : ""}`}
          aria-label={l}
          onClick={() => setLang(l)}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
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

/* settings modal: nickname + avatar pick (local; nickname syncs via onSaveNickname) */
export const SettingsModal = ({
  open,
  onClose,
  onSaveNickname,
}: {
  open: boolean;
  onClose: () => void;
  onSaveNickname?: (nickname: string) => void;
}) => {
  const t = useT();
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
  paragraphs: string[];
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
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
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

/* small readout block helper */
export const Readout = ({ lines, align }: { lines: ReactNode[]; align?: "right" }) => (
  <div className={`readout ${align === "right" ? "readout--r" : ""}`}>
    {lines.map((line, i) => (
      <div key={i}>{line}</div>
    ))}
  </div>
);
