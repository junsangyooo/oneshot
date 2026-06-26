import { Clipboard, Crown } from "lucide-react";
import type { GameId, PartyRoomState } from "@oneshot/shared";
import { clientConfig } from "../config/env";
import { useRoomStore } from "../app/useRoomStore";
import {
  ActionBar,
  Button,
  GameCatalog,
  LeaveButton,
  PlayerList,
  QRPanel,
  RoomCode,
  StartIcon,
} from "../ui-kit";

type RoomScreenProps = {
  roomState: PartyRoomState;
  currentPlayerId: string | null;
};

export const RoomScreen = ({ roomState, currentPlayerId }: RoomScreenProps) => {
  const send = useRoomStore((state) => state.send);
  const leave = useRoomStore((state) => state.leave);
  const players = Object.values(roomState.players).sort((left, right) => left.seatIndex - right.seatIndex);
  const currentPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = currentPlayer?.isHost ?? false;
  const selectedGame = roomState.catalog.find((game) => game.id === roomState.selectedGameId);
  const enoughPlayers = selectedGame ? players.length >= selectedGame.minPlayers : false;
  const joinUrl = `${clientConfig.publicOrigin}/r/${roomState.roomCode}`;

  const selectGame = (gameId: GameId) => {
    send({ type: "room:selectGame", gameId });
  };

  const copyJoinUrl = () => {
    void navigator.clipboard.writeText(joinUrl);
  };

  return (
    <main className="app-screen room-screen">
      <header className="top-bar">
        <div>
          <p>파티 방</p>
          <h1>{selectedGame?.title ?? "게임 선택"}</h1>
        </div>
        <LeaveButton onClick={() => void leave()} />
      </header>

      <section className="room-join-band">
        <div>
          <span className="eyebrow">방 코드</span>
          <RoomCode code={roomState.roomCode} />
          <Button variant="ghost" onClick={copyJoinUrl}>
            <Clipboard size={18} />
            링크 복사
          </Button>
        </div>
        <QRPanel value={joinUrl} />
      </section>

      <section className="room-grid">
        <div className="section-block">
          <div className="section-heading">
            <h2>참가자</h2>
            <span>{players.length}명</span>
          </div>
          <PlayerList
            players={players}
            currentPlayerId={currentPlayerId}
            canKick={isHost}
            onKick={(playerId) => send({ type: "room:kickPlayer", playerId })}
          />
        </div>

        <div className="section-block">
          <div className="section-heading">
            <h2>게임</h2>
            {isHost ? (
              <span className="inline-host">
                <Crown size={14} />
                선택 가능
              </span>
            ) : (
              <span>방장 대기</span>
            )}
          </div>
          <GameCatalog
            games={roomState.catalog}
            selectedGameId={roomState.selectedGameId}
            playerCount={players.length}
            isHost={isHost}
            onSelect={selectGame}
          />
        </div>
      </section>

      <ActionBar>
        <Button
          disabled={!isHost || !enoughPlayers}
          onClick={() => send({ type: "room:startGame" })}
          title={!isHost ? "방장만 시작할 수 있습니다." : undefined}
        >
          <StartIcon />
          시작
        </Button>
      </ActionBar>
    </main>
  );
};
