import type { PartyRoomState } from "@oneshot/shared";
import { useRoomStore } from "../app/useRoomStore";
import { useT, useLangStore, gameTitle } from "../i18n";
import { Backdrop, AvatarImg } from "../ui/terminal";
import { resolveAvatar, avatarSrc } from "../design/avatars";
import { isThemeId } from "../theme";

type ResultsScreenProps = {
  roomState: PartyRoomState;
  currentPlayerId: string | null;
};

export const ResultsScreen = ({ roomState, currentPlayerId }: ResultsScreenProps) => {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const send = useRoomStore((state) => state.send);
  const leave = useRoomStore((state) => state.leave);
  const currentPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = currentPlayer?.isHost ?? false;
  const result = roomState.activeGame?.result;
  const gameId = roomState.activeGame?.gameId ?? roomState.selectedGameId;

  const ranking = [...(result?.ranking ?? [])].sort((a, b) => a.rank - b.rank);
  const champ = ranking[0] ? roomState.players[ranking[0].playerId] : null;
  const champScore = ranking[0]?.scoreDelta ?? 0;
  const rest = ranking.slice(1);

  return (
    <main className="scr scr--results">
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>BR-K/S/61X-081</div>
          <div>
            SECTOR_ID: <span className="hot">#{roomState.roomCode}</span>
          </div>
          <div>
            STATUS: <span className="cool">CYCLE_COMPLETE</span>
          </div>
        </div>
        <div className="readout readout--r">
          <div>SYS.OS_V.4.20.1</div>
          <div>LOC: SUB-LEVEL 4</div>
        </div>
      </header>

      <main className="stage">
        <div className="head">
          <div className="eyebrow">{t("results.eyebrow")}</div>
          <h1>{t("results.title")}</h1>
          <div className="mod">{gameTitle(lang, gameId, gameId)}</div>
        </div>

        {champ ? (
          <div className="champ">
            <span className="crown">♛</span>
            <span className="glyph glyph--img" style={{ borderColor: "var(--gold)" }}>
              <img src={avatarSrc(resolveAvatar(champ.avatarKey).id, isThemeId(champ.themeId) ? champ.themeId : "cyber")} alt="" />
            </span>
            <span className="who">
              <span className="rolelbl">{t("results.champion")}</span>
              <span className="nm">{champ.nickname}</span>
            </span>
            <span className="sc">
              <b>{champScore.toLocaleString()}</b>
              <span>{t("results.score")}</span>
            </span>
          </div>
        ) : null}

        <div className="table">
          {rest.map((row) => {
            const p = roomState.players[row.playerId];
            return (
              <div className={`r ${p?.connectionStatus === "offline" ? "off" : ""}`} key={row.playerId}>
                <span className="pos">{String(row.rank).padStart(2, "0")}</span>
                <AvatarImg avatarKey={p?.avatarKey} themeId={p?.themeId} />
                <span className="nm">
                  {p?.nickname ?? "—"}
                  <small>SEAT {p ? String(p.seatIndex + 1).padStart(2, "0") : "--"}</small>
                </span>
                <span className="sc">
                  {(row.scoreDelta ?? 0).toLocaleString()} <span>{t("results.points")}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="actions">
          <button
            className="btn btn--primary"
            type="button"
            disabled={!isHost}
            onClick={() => send({ type: "room:returnToLobby" })}
          >
            <span>↩ {t("results.return")}</span>
          </button>
          <button
            className="btn"
            type="button"
            disabled={!isHost}
            onClick={() => send({ type: "room:returnToLobby" })}
          >
            <span>{t("results.next")} →</span>
          </button>
          <button className="btn btn--danger" type="button" onClick={() => void leave()}>
            <span>⏻ {t("results.close")}</span>
          </button>
        </div>
      </main>

      <footer className="botbar">
        <div className="readout">{result?.summary ?? "RESULTS_VERIFIED_BY_SECTOR"}</div>
        <div className="readout readout--r">[ ARCHIVING_TRANSCRIPT ]</div>
      </footer>
    </main>
  );
};
