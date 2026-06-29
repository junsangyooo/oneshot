import { Backdrop } from "./terminal";

export type StatusAction = { label: string; primary?: boolean; onClick: () => void };

type StatusScreenProps = {
  code: string;
  accent: "cyan" | "red" | "warn";
  icon: string;
  title: string;
  message: string;
  spinner?: boolean;
  glitch?: boolean;
  actions?: StatusAction[];
};

/* shared full-screen status surface — connecting, reconnecting, errors */
export const StatusScreen = ({
  code,
  accent,
  icon,
  title,
  message,
  spinner,
  glitch,
  actions = [],
}: StatusScreenProps) => (
  <main className="scr scr--conn">
    <Backdrop />
    <header className="topbar">
      <div className="readout">
        <div>BR-K/S/61X-081</div>
        <div>STATUS: {code}</div>
      </div>
      <div className="readout readout--r">
        <div>SYS.OS_V.4.20.1</div>
        <div>LOC: SUB-LEVEL 4</div>
      </div>
    </header>

    <div className="stage">
      <div className={`emblem is-${accent} ${spinner ? "" : "no-ring"}`}>
        <span className="ring" />
        <span className="ico">{icon}</span>
      </div>
      <div className={`st-code c-${accent}`}>{code}</div>
      <h1 className={`st-title ${glitch ? "glitch" : ""}`}>{title}</h1>
      <p className="st-msg">{message}</p>
      {actions.length > 0 ? (
        <div className="st-actions">
          {actions.map((a) => (
            <button key={a.label} type="button" className={`btn ${a.primary ? "btn--primary" : ""}`} onClick={a.onClick}>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>

    <footer className="botbar">
      <div className="readout">CONNECTION_TYPE: AES-256_ENCRYPTED_TUNNEL</div>
      <div className="readout readout--r">[ {code} ]</div>
    </footer>
  </main>
);
