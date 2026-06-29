import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { clientConfig } from "../config/env";
import { useRoomStore } from "../app/useRoomStore";
import { useIdentity } from "../app/identity";
import { gameCatalog } from "@oneshot/shared";
import { useT, useLangStore, gameTitle } from "../i18n";
import { useTheme } from "../theme";
import { GAME_ORDER, gameMeta } from "../design/games";

/* The home library mirrors the catalog: only games marked "available" on the
   server are shown. Flipping a game's status to "available" surfaces it here
   automatically — no edits to this screen needed. */
const AVAILABLE_GAMES = GAME_ORDER.filter(
  (id) => gameCatalog.find((game) => game.id === id)?.status === "available",
);
import { Backdrop, SettingsModal } from "../ui/terminal";

type HomeScreenProps = {
  initialRoomCode: string;
};

export const HomeScreen = ({ initialRoomCode }: HomeScreenProps) => {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const createRoom = useRoomStore((state) => state.createRoom);
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const connectionState = useRoomStore((state) => state.connectionState);
  const identity = useIdentity();
  const theme = useTheme((s) => s.theme);
  const [nickname, setNickname] = useState(identity.nickname);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const connecting = connectionState === "connecting";

  const normalizedRoomCode = useMemo(
    () => roomCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6),
    [roomCode],
  );
  const host = clientConfig.publicOrigin.replace(/^https?:\/\//, "");
  const playerRange = (min: number, max: number | null) =>
    max === null ? `${min}${t("lobby.players_or_more_suffix")}` : `${min}-${max}${t("lobby.players_count")}`;

  const profile = { avatarKey: identity.avatarId, themeId: theme };

  const doCreate = () => {
    if (nickname.trim().length === 0) return;
    identity.setNickname(nickname.trim());
    void createRoom(nickname.trim(), profile);
  };

  const doJoin = () => {
    if (nickname.trim().length === 0 || normalizedRoomCode.length < 4) return;
    identity.setNickname(nickname.trim());
    void joinRoom(normalizedRoomCode, nickname.trim(), profile);
  };

  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    doCreate();
  };

  return (
    <main className="scr scr--home">
      <Backdrop />
      <button type="button" className="config-pill" onClick={() => setSettingsOpen(true)}>
        ⚙ <span>{t("home.config")}</span>
      </button>

      <aside className="rail">
        <div className="rail-head">
          <span>{t("home.library")}</span>
          <span className="n">
            {String(AVAILABLE_GAMES.length).padStart(2, "0")} {t("home.modules")}
          </span>
        </div>
        <div>
          {AVAILABLE_GAMES.map((id, i) => {
            const meta = gameMeta(id);
            return (
              <div className={`game-row ${i === 0 ? "is-active" : ""}`} key={id}>
                <span className={`glyph glyph--${meta.accent}`}>{meta.glyph}</span>
                <span>
	                  <div className="nm">{gameTitle(lang, id, id)}</div>
	                  <div className="mt">{playerRange(meta.min, meta.max)}</div>
	                </span>
	                <span className="pl">{meta.max === null ? `${meta.min}+` : `${meta.min}-${meta.max}`}</span>
              </div>
            );
          })}
        </div>
      </aside>

      <header className="topbar">
        <div className="readout">
          <div>BR-K/S/61X-081</div>
          <div>BASELINE TRANSCRIPT A</div>
          <div>
            STATUS: <span className="hot">ACTIVE</span>
          </div>
        </div>
        <div className="readout readout--r">
          <div>SYS.OS_V.4.20.1</div>
          <div>LOC: SUB-LEVEL 4</div>
          <div>[{host}]</div>
        </div>
      </header>

      <div className="center">
        <div>
          <span className="brand" data-text="OneShot">
            OneShot
          </span>
          <div className="brand-sub">{t("home.tagline")}</div>
        </div>

        <form className="form" onSubmit={onCreate} autoComplete="off">
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
            />
          </label>

          <div className="field field--code">
            <div className="field-head">
              <span>{t("home.code")}</span>
              <span className="opt">{t("home.optional")}</span>
            </div>
            <input
              type="text"
              maxLength={6}
              value={normalizedRoomCode}
              placeholder="X X X X X X"
              onChange={(e) => setRoomCode(e.currentTarget.value)}
            />
          </div>

          <div className="actions">
            <button className="btn btn--primary" type="submit" disabled={connecting || nickname.trim().length === 0}>
              <span>{t("home.create")}</span>
              <span className="dot" style={{ margin: 0 }} />
            </button>
            <button
              className="btn"
              type="button"
              disabled={connecting || nickname.trim().length === 0 || normalizedRoomCode.length < 4}
              onClick={doJoin}
            >
              <span>{t("home.join")}</span>
              <span className="enter">&#x21B5;</span>
            </button>
          </div>
        </form>
      </div>

      <footer className="botbar">
        <div className="readout">
          <div>CONNECTED_USERS: 14,082</div>
          <div>
            <span className="dot" />
            UPTIME: 1,024H 12M
          </div>
        </div>
        <div className="readout readout--r">
          <div>A SYSTEM OF CONTROLLED CHAOS</div>
          <div>SCANNING_FOR_PLAYERS...</div>
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaveNickname={(n) => setNickname(n)}
      />
    </main>
  );
};
