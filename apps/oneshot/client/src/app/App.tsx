import { useEffect, useMemo } from "react";
import { HomeScreen } from "../lobby/HomeScreen";
import { RoomScreen } from "../room/RoomScreen";
import { ResultsScreen } from "../room/ResultsScreen";
import { KingGameScreen } from "../games/kinggame/KingGameScreen";
import { Toast } from "../ui-kit";
import { StateScreen, StatesGallery, kindForCode } from "../ui/states";
import { useRoomStore } from "./useRoomStore";

export const App = () => {
  const roomState = useRoomStore((state) => state.roomState);
  const joinResult = useRoomStore((state) => state.joinResult);
  const privateGameState = useRoomStore((state) => state.privateGameState);
  const connectionState = useRoomStore((state) => state.connectionState);
  const reconnect = useRoomStore((state) => state.reconnect);
  const toast = useRoomStore((state) => state.toast);
  const screenError = useRoomStore((state) => state.screenError);
  const clearToast = useRoomStore((state) => state.clearToast);
  const clearScreenError = useRoomStore((state) => state.clearScreenError);

  useEffect(() => {
    void reconnect();
  }, [reconnect]);

  const path = window.location.pathname;
  const routeRoomCode = useMemo(() => {
    const match = path.match(/^\/r\/([A-Za-z0-9]{4,6})\/?$/);
    return match?.[1]?.toUpperCase() ?? "";
  }, [path]);
  const isStatesRoute = path === "/_states";
  const isKnownRoute = path === "/" || routeRoomCode.length > 0;

  const goHome = () => {
    clearScreenError();
    if (window.location.pathname !== "/") window.location.href = "/";
  };

  let screen = <HomeScreen initialRoomCode={routeRoomCode} />;
  if (isStatesRoute) {
    screen = <StatesGallery />;
  } else if (!roomState && screenError) {
    const kind = kindForCode(screenError.code);
    screen = (
      <StateScreen
        kind={kind}
        message={kind === "generic" ? screenError.message : undefined}
        onHome={() => clearScreenError()}
        onRetry={() => clearScreenError()}
      />
    );
  } else if (!roomState && connectionState === "connecting") {
    screen = <StateScreen kind="connecting" onHome={goHome} onRetry={() => clearScreenError()} />;
  } else if (!roomState && !isKnownRoute) {
    screen = <StateScreen kind="notFound" onHome={goHome} onRetry={goHome} />;
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
