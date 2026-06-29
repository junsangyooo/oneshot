import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { GameId, PartyRoomState } from "@oneshot/shared";
import { clientConfig } from "../config/env";
import { useRoomStore } from "../app/useRoomStore";
import { useT, useLangStore, gameTitle, gameTagline } from "../i18n";
import { useTheme } from "../theme";
import { gameMeta } from "../design/games";
import { Backdrop, AvatarImg, SettingsModal } from "../ui/terminal";

type RoomScreenProps = {
  roomState: PartyRoomState;
  currentPlayerId: string | null;
};

const QrBox = ({ value }: { value: string }) => {
  const theme = useTheme((s) => s.theme);
  const [url, setUrl] = useState("");
  const dark = theme === "cozy" ? "#595959" : "#e7e3ee";
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, { margin: 1, width: 240, color: { dark, light: "#00000000" } })
      .then((d) => !cancelled && setUrl(d))
      .catch(() => !cancelled && setUrl(""));
    return () => {
      cancelled = true;
    };
  }, [value, dark]);
  return <div className="qr-box hud-box hud-box--bracket">{url ? <img src={url} alt="QR" /> : null}</div>;
};

export const RoomScreen = ({ roomState, currentPlayerId }: RoomScreenProps) => {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const send = useRoomStore((state) => state.send);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ejectOpen, setEjectOpen] = useState(false);

  const players = Object.values(roomState.players).sort((a, b) => a.seatIndex - b.seatIndex);
  const currentPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = currentPlayer?.isHost ?? false;
  const selectedGame = roomState.catalog.find((g) => g.id === roomState.selectedGameId);
  const enoughPlayers = selectedGame ? players.length >= selectedGame.minPlayers : false;
  const joinUrl = `${clientConfig.publicOrigin}/r/${roomState.roomCode}`;
  const onlineCount = players.filter((p) => p.connectionStatus !== "offline").length;
  const selectedIndex = Math.max(0, roomState.catalog.findIndex((g) => g.id === roomState.selectedGameId));

  const statusText: Record<string, string> = {
    online: t("status.online"),
    reconnecting: t("status.reconnecting"),
    offline: t("status.offline"),
  };
  const statusDot: Record<string, string> = { online: "dot--ok", reconnecting: "dot--warn", offline: "dot--off" };
  const playerRange = (min: number, max: number | null) =>
    max === null ? `${min}${t("lobby.players_or_more_suffix")}` : `${min}-${max}${t("lobby.players_count")}`;

  const selectGame = (gameId: GameId) => send({ type: "room:selectGame", gameId });
  const copyLink = () => void navigator.clipboard.writeText(joinUrl);
  const closeRoom = () => {
    setEjectOpen(false);
    send({ type: "room:close" });
  };

  return (
    <main className="scr scr--lobby">
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>BR-K/S/61X-081</div>
          <div>
            SECTOR_ID: <span className="hot">#{roomState.roomCode}</span>
          </div>
          <div>
            <span className="dot" />
            STATUS: LOBBY_ACTIVE
          </div>
        </div>
        <div className="sector">
          <div className="lbl">{t("lobby.sectorCode")}</div>
          <div className="code">
            <span>#{roomState.roomCode}</span>
            <button className="copy" type="button" title={t("lobby.copyLink")} onClick={copyLink}>
              &#x2750;
            </button>
          </div>
        </div>
        <div className="readout readout--r">
          <div>SYS.OS_V.4.20.1</div>
          <div>LOC: SUB-LEVEL 4</div>
          <div>SECTOR: #{roomState.roomCode}</div>
        </div>
      </header>

      <div className="cols">
        {/* LEFT — access / share */}
        <section className="col">
          <div>
            <div className="panel-label">{t("lobby.authLink")}</div>
            <div className="link-box">
              <div className="link-url">{joinUrl}</div>
              <button className="btn btn--sm" type="button" onClick={copyLink}>
                <span>{t("lobby.copyLink")}</span>
                <span>&#x2750;</span>
              </button>
            </div>
          </div>
          <div className="qr-wrap">
            <div className="panel-label">{t("lobby.scan")}</div>
            <QrBox value={joinUrl} />
            <div className="sub-note">{t("lobby.sync")}</div>
          </div>
          <div className="enc">
            <div className="enc-row">
              <span>{t("lobby.encryption")}</span>
              <span className="s-online">{t("lobby.enabled")}</span>
            </div>
            <div className="enc-bar">
              <i />
            </div>
          </div>
        </section>

        {/* CENTER — game selection */}
        <section className="col col--center">
          <div className="head-row">
            <h2>{t("lobby.selectModule")}</h2>
            <span className="count-chip">
              {String(selectedIndex + 1).padStart(2, "0")}/{String(roomState.catalog.length).padStart(2, "0")}
            </span>
            <span className="priority">{t("lobby.priority")}</span>
          </div>

          {selectedGame ? (
            <div className="hero">
              <div className="sel">{t("lobby.currentlySelected")}</div>
              <div className="title">{gameTitle(lang, selectedGame.id, selectedGame.title)}</div>
              <div className="desc">{gameTagline(lang, selectedGame.id)}</div>
	              <div className="meta">
	                <span>⧉ {playerRange(selectedGame.minPlayers, selectedGame.maxPlayers)}</span>
	                <span>◷ LV.{selectedGame.complexity}</span>
	              </div>
            </div>
          ) : null}

          <div className="avail">
            <div className="panel-label">{t("lobby.available")}</div>
            <div className="mod-grid">
              {roomState.catalog.map((game) => {
                const available = game.status === "available";
                const selected = game.id === roomState.selectedGameId;
                const meta = gameMeta(game.id);
                return (
                  <button
                    key={game.id}
                    type="button"
                    className={`mod ${selected ? "is-selected" : ""}`}
                    disabled={!isHost || !available}
                    onClick={() => selectGame(game.id)}
                  >
                    <div className="mod-top">
                      <span className={`glyph glyph--${meta.accent}`}>{meta.glyph}</span>
                      <span className={`st ${selected ? "loaded" : "standby"}`}>
                        {selected ? t("lobby.loaded") : t("lobby.standby")}
                      </span>
                    </div>
                    <div>
                      <div className="nm">{gameTitle(lang, game.id, game.title)}</div>
                      <div className="dsc">{gameTagline(lang, game.id)}</div>
                    </div>
	                    <div className="mt">
	                      <span>{playerRange(game.minPlayers, game.maxPlayers)}</span>
	                      <span>LV.{game.complexity}</span>
	                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cmd">
            <div className="access">
              {isHost ? t("lobby.commanderOnly") : t("lobby.waitingHost")}
            </div>
            <button
              className="btn btn--primary btn--init"
              type="button"
              disabled={!isHost || !enoughPlayers}
              onClick={() => send({ type: "room:startGame" })}
            >
              <span>{t("lobby.initialize")}</span>
              <span>{enoughPlayers ? "→" : `· ${t("lobby.needPlayers")}`}</span>
            </button>
            <div className="cmd-row">
              <button className="btn btn--sm" type="button" onClick={() => setSettingsOpen(true)}>
                <span>⚙ {t("lobby.settings")}</span>
              </button>
	              <button
	                className="btn btn--sm btn--danger"
	                type="button"
	                disabled={!isHost}
	                onClick={() => setEjectOpen(true)}
	              >
	                <span>⏻ {t("lobby.closeRoom")}</span>
	              </button>
            </div>
          </div>
        </section>

        {/* RIGHT — operators */}
        <section className="col">
          <div>
            <div className="head-row" style={{ marginBottom: 14 }}>
              <div className="panel-label" style={{ margin: 0 }}>
                {t("lobby.operators")}
              </div>
              <span className="count-chip">
                {String(onlineCount).padStart(2, "0")}/{String(players.length).padStart(2, "0")}
              </span>
            </div>
            <div>
              {players.map((p) => {
                const isTemp = roomState.temporaryHostPlayerId === p.id;
                return (
                  <div
                    className={`op ${p.connectionStatus === "offline" ? "is-off" : ""} ${p.isHost ? "is-host" : ""}`}
                    key={p.id}
                  >
                    <AvatarImg avatarKey={p.avatarKey} themeId={p.themeId} />
                    <span>
                      <div className="nm">
                        {p.nickname}
                        {p.isHost ? <span className="role role--cmd">♛ {t("role.commander")}</span> : null}
                        {isTemp && !p.isHost ? <span className="role role--temp">⛨ {t("role.temp")}</span> : null}
                      </div>
                      <div className="ip">SEAT {String(p.seatIndex + 1).padStart(2, "0")}</div>
                    </span>
                    <span className="st">
                      <span className={p.connectionStatus === "online" ? "s-online" : p.connectionStatus === "reconnecting" ? "s-warn" : "s-off"}>
                        <span className={`dot ${statusDot[p.connectionStatus]}`} style={{ marginRight: 5 }} />
                        {statusText[p.connectionStatus]}
                      </span>
                      {isHost && p.id !== currentPlayerId ? (
                        <button
                          className="kick"
                          type="button"
                          title="kick"
                          onClick={() => send({ type: "room:kickPlayer", playerId: p.id })}
                        >
                          ✕
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
              {Array.from({
	                length: Math.max((selectedGame?.minPlayers ?? 2) - players.length, players.length < 2 ? 3 : 1),
	              }).map((_, i) => (
                <div className="op is-empty" key={`empty-${i}`}>
                  <span className="glyph glyph--empty">+</span>
                  <span className="nm">{t("lobby.waitingFriend")}</span>
                  <span />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="botbar">
        <div className="readout">CONNECTION_TYPE: AES-256_ENCRYPTED_TUNNEL // PROTOCOL_STABLE</div>
        <div className="mid">A SYSTEM OF CELLS INTERLINKED</div>
        <div className="readout readout--r">
          <div>OPERATORS: {players.length}</div>
          <div>[ SCAN_FOR_PROTOCOL ]</div>
        </div>
      </footer>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {ejectOpen ? (
        <div className="modal-backdrop open" role="presentation" onMouseDown={() => setEjectOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>⚠ {t("eject.title")}</h3>
              <button className="x" type="button" onClick={() => setEjectOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: "var(--ink-dim)" }}>{t("eject.body")}</p>
            </div>
            <div className="modal-foot">
              <button className="btn btn--sm" type="button" onClick={() => setEjectOpen(false)}>
                <span>{t("eject.abort")}</span>
              </button>
	              <button className="btn btn--sm btn--danger" type="button" onClick={closeRoom}>
	                <span>● {t("eject.confirm")}</span>
	              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};
