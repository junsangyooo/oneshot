import { useEffect, useMemo } from "react";
import { HomeScreen } from "../lobby/HomeScreen";
import { RoomScreen } from "../room/RoomScreen";
import { ResultsScreen } from "../room/ResultsScreen";
import { KingGameScreen } from "../games/kinggame/KingGameScreen";
import { Toast } from "../ui-kit";
import { useRoomStore } from "./useRoomStore";
import { ErrorScreen } from "./ErrorScreen";

export const App = () => {
  const roomState = useRoomStore((state) => state.roomState);
  const joinResult = useRoomStore((state) => state.joinResult);
  const privateGameState = useRoomStore((state) => state.privateGameState);
  const reconnect = useRoomStore((state) => state.reconnect);
  const toast = useRoomStore((state) => state.toast);
  const screenError = useRoomStore((state) => state.screenError);
  const clearToast = useRoomStore((state) => state.clearToast);

  useEffect(() => {
    void reconnect();
  }, [reconnect]);

  const routeRoomCode = useMemo(() => {
    const match = window.location.pathname.match(/^\/r\/([A-Za-z0-9]{4,6})/);
    return match?.[1]?.toUpperCase() ?? "";
  }, []);

  let screen = <HomeScreen initialRoomCode={routeRoomCode} />;
  if (!roomState && screenError) {
    screen = <ErrorScreen message={screenError.message} retryable={screenError.retryable} />;
  } else if (roomState?.phase === "lobby") {
    screen = <RoomScreen roomState={roomState} currentPlayerId={joinResult?.playerId ?? null} />;
  } else if (roomState?.phase === "game" && roomState.activeGame?.gameId === "kinggame") {
    screen = <KingGameScreen roomState={roomState} privateState={privateGameState} />;
  } else if (roomState?.phase === "results") {
    screen = <ResultsScreen roomState={roomState} currentPlayerId={joinResult?.playerId ?? null} />;
  }

  return (
    <div className="app-shell">
      {screen}
      <Toast message={toast} onClose={clearToast} />
    </div>
  );
};
