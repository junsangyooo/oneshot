import type { PartyRoomState } from "@oneshot/shared";
import { Trophy } from "lucide-react";
import { useRoomStore } from "../app/useRoomStore";
import { ActionBar, Button, PhaseBanner, ResultTable } from "../ui-kit";

type ResultsScreenProps = {
  roomState: PartyRoomState;
  currentPlayerId: string | null;
};

export const ResultsScreen = ({ roomState, currentPlayerId }: ResultsScreenProps) => {
  const send = useRoomStore((state) => state.send);
  const currentPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const result = roomState.activeGame?.result;

  return (
    <main className="app-screen result-screen">
      <PhaseBanner
        icon={<Trophy size={30} />}
        title="결과"
        body={result?.summary ?? "이번 라운드가 끝났습니다."}
      />
      {result ? <ResultTable playersById={roomState.players} ranking={result.ranking} /> : null}
      <ActionBar>
        <Button
          disabled={!currentPlayer?.isHost}
          onClick={() => send({ type: "room:returnToLobby" })}
          variant="secondary"
        >
          방으로 돌아가기
        </Button>
      </ActionBar>
    </main>
  );
};
