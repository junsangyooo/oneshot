import { useMemo, useState } from "react";
import type {
  KingGamePrivateState,
  KingGamePublicState,
  PartyRoomState,
  PublicPlayerState,
} from "@oneshot/shared";
import { Crown, Send } from "lucide-react";
import { defaultKingGameOptions } from "@oneshot/shared";
import { useRoomStore } from "../../app/useRoomStore";
import { ActionBar, Button, EmptyState, PhaseBanner, PlayerBadge } from "../../ui-kit";

type KingGameScreenProps = {
  roomState: PartyRoomState;
  privateState: unknown;
};

export const KingGameScreen = ({ roomState, privateState }: KingGameScreenProps) => {
  const send = useRoomStore((state) => state.send);
  const gameState = roomState.activeGame?.publicState as KingGamePublicState | undefined;
  const ownState = privateState as KingGamePrivateState | null;
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [mission, setMission] = useState(defaultKingGameOptions.missionTemplates[0] ?? "");

  const playersById = roomState.players;
  const king = gameState?.kingPlayerId ? (playersById[gameState.kingPlayerId] ?? null) : null;
  const target = gameState?.command?.targetPlayerId
    ? (playersById[gameState.command.targetPlayerId] ?? null)
    : null;
  const isKing = ownState?.role === "king";

  const numberOptions = useMemo(() => gameState?.availableNumbers ?? [], [gameState]);
  const selectedTarget = targetNumber ?? numberOptions[0] ?? null;

  const submitCommand = () => {
    if (!selectedTarget || mission.trim().length < 2) {
      return;
    }
    send({
      type: "game:action",
      action: {
        type: "kinggame:setCommand",
        payload: { targetNumber: selectedTarget, mission: mission.trim() },
        clientActionId: crypto.randomUUID(),
      },
    });
  };

  const finish = () => {
    send({
      type: "game:action",
      action: { type: "kinggame:finish", clientActionId: crypto.randomUUID() },
    });
  };

  if (!gameState || !ownState) {
    return (
      <main className="app-screen game-screen">
        <EmptyState>게임 상태를 기다리는 중입니다.</EmptyState>
      </main>
    );
  }

  return (
    <main className="app-screen game-screen">
      <PhaseBanner
        icon={<Crown size={34} />}
        title={gameState.phase === "revealed" ? "왕의 지시" : "왕게임"}
        body={king ? `${king.nickname} 님이 왕입니다.` : "역할을 배정하고 있습니다."}
      />

      <section className="king-status-band">
        <img src="/assets/king-crown.svg" alt="" />
        <div>
          <span className="eyebrow">내 역할</span>
          <h2>{ownState.role === "king" ? "왕" : `${ownState.number ?? "-"}번`}</h2>
        </div>
      </section>

      {gameState.phase === "awaiting_command" ? (
        isKing ? (
          <KingCommandForm
            numbers={numberOptions}
            selectedTarget={selectedTarget}
            mission={mission}
            onTargetChange={setTargetNumber}
            onMissionChange={setMission}
            onSubmit={submitCommand}
          />
        ) : (
          <WaitingForKing king={king} />
        )
      ) : null}

      {gameState.phase === "revealed" && gameState.command ? (
        <RevealedCommand
          target={target}
          targetNumber={gameState.command.targetNumber}
          mission={gameState.command.mission}
        />
      ) : null}

      <ActionBar>
        <Button disabled={!isKing || gameState.phase !== "revealed"} onClick={finish}>
          확인 완료
        </Button>
      </ActionBar>
    </main>
  );
};

const KingCommandForm = ({
  numbers,
  selectedTarget,
  mission,
  onTargetChange,
  onMissionChange,
  onSubmit,
}: {
  numbers: number[];
  selectedTarget: number | null;
  mission: string;
  onTargetChange: (number: number) => void;
  onMissionChange: (mission: string) => void;
  onSubmit: () => void;
}) => (
  <section className="king-command">
    <div className="section-heading">
      <h2>대상</h2>
      <span>{numbers.length}개 번호</span>
    </div>
    <div className="number-grid">
      {numbers.map((number) => (
        <button
          key={number}
          type="button"
          className={selectedTarget === number ? "is-selected" : ""}
          onClick={() => onTargetChange(number)}
        >
          {number}
        </button>
      ))}
    </div>
    <label className="field field--textarea">
      <span>미션</span>
      <textarea
        maxLength={80}
        value={mission}
        onChange={(event) => onMissionChange(event.currentTarget.value)}
      />
    </label>
    <div className="mission-chips">
      {defaultKingGameOptions.missionTemplates.map((template) => (
        <button key={template} type="button" onClick={() => onMissionChange(template)}>
          {template}
        </button>
      ))}
    </div>
    <Button disabled={!selectedTarget || mission.trim().length < 2} onClick={onSubmit}>
      <Send size={18} />
      공개
    </Button>
  </section>
);

const WaitingForKing = ({ king }: { king: PublicPlayerState | null }) => (
  <section className="waiting-panel">
    {king ? <PlayerBadge player={king} /> : null}
    <p>왕이 번호와 미션을 고르는 중입니다.</p>
  </section>
);

const RevealedCommand = ({
  target,
  targetNumber,
  mission,
}: {
  target: PublicPlayerState | null;
  targetNumber: number;
  mission: string;
}) => (
  <section className="revealed-command">
    <span className="eyebrow">{targetNumber}번</span>
    <h2>{target?.nickname ?? "선택된 참가자"}</h2>
    <p>{mission}</p>
  </section>
);
