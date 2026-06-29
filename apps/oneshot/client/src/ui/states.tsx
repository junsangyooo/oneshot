import { useState } from "react";
import { StatusScreen } from "./StatusScreen";
import { useT } from "../i18n";

/* =========================================================
   Every non-game "state" page lives here. Add a kind +
   preset and it is instantly themeable + previewable at
   /_states. App.tsx routes real cases (errors, 404, etc.)
   onto these.
   ========================================================= */
export type StateKind =
  | "notFound"
  | "connecting"
  | "reconnecting"
  | "roomNotFound"
  | "roomFull"
  | "roomExpired"
  | "roomClosed"
  | "gameRunning"
  | "reconnectFailed"
  | "serverError"
  | "kicked"
  | "generic";

type ActSpec = { labelKey: string; primary?: boolean; act: "home" | "retry" };
type Preset = {
  code: string;
  accent: "cyan" | "red" | "warn";
  icon: string;
  spinner?: boolean;
  glitch?: boolean;
  titleKey: string;
  msgKey: string;
  actions: ActSpec[];
};

const HOME: ActSpec = { labelKey: "action.home", primary: true, act: "home" };
const RETRY: ActSpec = { labelKey: "action.retry", primary: true, act: "retry" };

const PRESETS: Record<StateKind, Preset> = {
  notFound: { code: "404 // NOT_FOUND", accent: "red", icon: "⊘", glitch: true, titleKey: "state.notFound.title", msgKey: "state.notFound.msg", actions: [HOME] },
  connecting: { code: "LINK_01", accent: "cyan", icon: "◴", spinner: true, titleKey: "conn.establishing", msgKey: "conn.establishingMsg", actions: [] },
  reconnecting: { code: "LINK_03", accent: "warn", icon: "⟳", spinner: true, titleKey: "conn.reconnecting", msgKey: "conn.reconnectingMsg", actions: [] },
  roomNotFound: { code: "SECTOR // ERR", accent: "red", icon: "✕", glitch: true, titleKey: "state.roomNotFound.title", msgKey: "state.roomNotFound.msg", actions: [HOME] },
  roomFull: { code: "SECTOR // FULL", accent: "warn", icon: "▦", titleKey: "state.roomFull.title", msgKey: "state.roomFull.msg", actions: [{ labelKey: "action.findRoom", primary: true, act: "home" }] },
  roomExpired: { code: "SECTOR // EXPIRED", accent: "red", icon: "⊘", titleKey: "state.roomExpired.title", msgKey: "state.roomExpired.msg", actions: [HOME] },
  roomClosed: { code: "SECTOR // CLOSED", accent: "red", icon: "⏻", titleKey: "state.roomClosed.title", msgKey: "state.roomClosed.msg", actions: [HOME] },
  gameRunning: { code: "SECTOR // LOCKED", accent: "cyan", icon: "▶", titleKey: "state.gameRunning.title", msgKey: "state.gameRunning.msg", actions: [HOME] },
  reconnectFailed: { code: "LINK // ERR", accent: "red", icon: "⚠", glitch: true, titleKey: "state.reconnectFailed.title", msgKey: "state.reconnectFailed.msg", actions: [RETRY, { labelKey: "action.home", act: "home" }] },
  serverError: { code: "SYS // ERR", accent: "red", icon: "⚠", glitch: true, titleKey: "state.serverError.title", msgKey: "state.serverError.msg", actions: [RETRY, { labelKey: "action.home", act: "home" }] },
  kicked: { code: "ACCESS // REVOKED", accent: "red", icon: "⛔", glitch: true, titleKey: "state.kicked.title", msgKey: "state.kicked.msg", actions: [HOME] },
  generic: { code: "SYS // ERR", accent: "red", icon: "⚠", glitch: true, titleKey: "state.generic.title", msgKey: "state.generic.msg", actions: [RETRY, { labelKey: "action.home", act: "home" }] },
};

export const STATE_KINDS = Object.keys(PRESETS) as StateKind[];

/** map a server ErrorCode (or a synthetic one) onto a state kind */
export const kindForCode = (code: string | undefined): StateKind => {
  switch (code) {
    case "ROOM_NOT_FOUND": return "roomNotFound";
    case "ROOM_FULL": return "roomFull";
    case "ROOM_EXPIRED": return "roomExpired";
    case "ROOM_CLOSED": return "roomClosed";
    case "GAME_ALREADY_RUNNING": return "gameRunning";
    case "RECONNECT_FAILED": return "reconnectFailed";
    case "SERVER_ERROR": return "serverError";
    case "KICKED": return "kicked";
    default: return "generic";
  }
};

export const StateScreen = ({
  kind,
  message,
  onHome,
  onRetry,
}: {
  kind: StateKind;
  message?: string;
  onHome: () => void;
  onRetry: () => void;
}) => {
  const t = useT();
  const p = PRESETS[kind];
  const actions = p.actions.map((a) => ({
    label: t(a.labelKey),
    primary: a.primary,
    onClick: a.act === "retry" ? onRetry : onHome,
  }));
  return (
    <StatusScreen
      code={p.code}
      accent={p.accent}
      icon={p.icon}
      spinner={p.spinner}
      glitch={p.glitch}
      title={t(p.titleKey)}
      message={message ?? t(p.msgKey)}
      actions={actions}
    />
  );
};

/* dev-only gallery to eyeball every state page (route: /_states) */
export const StatesGallery = () => {
  const [kind, setKind] = useState<StateKind>("notFound");
  return (
    <>
      <div
        style={{
          position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 50,
          display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: "92vw",
          background: "rgba(20,13,26,0.7)", border: "1px solid var(--line)", padding: 6, borderRadius: 8,
        }}
      >
        {STATE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", cursor: "pointer",
              padding: "5px 8px", borderRadius: 6,
              border: k === kind ? "1px solid var(--accent)" : "1px solid var(--line)",
              color: k === kind ? "var(--accent)" : "var(--ink-dim)",
              background: k === kind ? "rgba(255,59,71,0.1)" : "transparent",
            }}
          >
            {k}
          </button>
        ))}
      </div>
      <StateScreen
        kind={kind}
        onHome={() => (window.location.href = "/")}
        onRetry={() => setKind("connecting")}
      />
    </>
  );
};
