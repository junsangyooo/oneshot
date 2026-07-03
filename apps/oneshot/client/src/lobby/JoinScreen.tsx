import { useState } from "react";
import type { FormEvent } from "react";
import { useRoomStore } from "../app/useRoomStore";
import { useIdentity } from "../app/identity";
import { useT } from "../i18n";
import { useTheme } from "../theme";
import { Backdrop, SettingsModal } from "../ui/terminal";

/* Landing page for invite links / QR scans (/r/CODE): the room already exists,
   so the visitor only needs a nickname and a join button — no create flow, no
   code field. Escape hatch to the full home screen at the bottom. */

type JoinScreenProps = {
  roomCode: string;
};

export const JoinScreen = ({ roomCode }: JoinScreenProps) => {
  const t = useT();
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const connectionState = useRoomStore((state) => state.connectionState);
  const identity = useIdentity();
  const theme = useTheme((s) => s.theme);
  const [nickname, setNickname] = useState(identity.nickname);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const connecting = connectionState === "connecting";

  const doJoin = () => {
    if (connecting || nickname.trim().length === 0) return;
    identity.setNickname(nickname.trim());
    void joinRoom(roomCode, nickname.trim(), { avatarKey: identity.avatarId, themeId: theme });
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    doJoin();
  };

  return (
    <main className="scr scr--join">
      <Backdrop />
      <button type="button" className="config-pill" onClick={() => setSettingsOpen(true)}>
        ⚙ <span>{t("home.config")}</span>
      </button>

      <div className="join-card">
        <span className="brand" data-text="OneShot">
          OneShot
        </span>
        <p className="join-invited">{t("join.invited")}</p>
        <div className="join-code">
          <span className="lbl">{t("lobby.sectorCode")}</span>
          <span className="val">#{roomCode}</span>
        </div>

        <form className="join-form" onSubmit={onSubmit} autoComplete="off">
          <label className="field">
            <div className="field-head">
              <span>{t("home.nickname")}</span>
              <span>{nickname.length}/12</span>
            </div>
            <input
              type="text"
              maxLength={12}
              value={nickname}
              placeholder={t("home.nicknamePlaceholder")}
              onChange={(e) => setNickname(e.currentTarget.value)}
              autoFocus
            />
          </label>
          <button
            className="btn btn--primary join-cta"
            type="submit"
            disabled={connecting || nickname.trim().length === 0}
          >
            <span>{t("home.join")}</span>
            <span className="enter">&#x21B5;</span>
          </button>
        </form>

        <a className="join-other" href="/">
          {t("join.other")}
        </a>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaveNickname={(n) => setNickname(n)}
      />
    </main>
  );
};
