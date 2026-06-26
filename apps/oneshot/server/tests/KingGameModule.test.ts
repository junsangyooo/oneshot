import { describe, expect, it } from "vitest";
import type { PublicPlayerState } from "@oneshot/shared";
import { defaultKingGameOptions } from "@oneshot/shared";
import { KingGameModule } from "../src/games/kinggame/KingGameModule";

const makePlayers = (count: number): PublicPlayerState[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    nickname: `P${index + 1}`,
    avatarKey: `shot-${index + 1}`,
    seatIndex: index,
    isHost: index === 0,
    connectionStatus: "online",
    joinedAt: index,
    lastSeenAt: index,
  }));

describe("KingGameModule", () => {
  it("assigns exactly one king and unique subject numbers", () => {
    for (let round = 0; round < 100; round += 1) {
      const module = new KingGameModule();
      const players = makePlayers(8);
      module.start({ players, options: defaultKingGameOptions, randomSeed: `seed-${round}` });

      const privateStates = players.map((player) => module.getStateFor(player.id));
      expect(privateStates.filter((state) => state.role === "king")).toHaveLength(1);

      const subjectNumbers = privateStates
        .filter((state) => state.role === "subject")
        .map((state) => state.number);
      expect(new Set(subjectNumbers).size).toBe(players.length - 1);
      expect(subjectNumbers.sort((left, right) => Number(left) - Number(right))).toEqual([
        1, 2, 3, 4, 5, 6, 7,
      ]);
    }
  });

  it("only allows the king to reveal and finish a command", () => {
    const module = new KingGameModule();
    const players = makePlayers(4);
    module.start({ players, options: defaultKingGameOptions, randomSeed: "action-seed" });

    const publicState = module.getPublicState();
    const kingPlayerId = publicState.kingPlayerId;
    expect(kingPlayerId).toBeTruthy();

    const subject = players.find((player) => player.id !== kingPlayerId);
    expect(subject).toBeTruthy();
    const notKingResult = module.handleAction({
      playerId: subject?.id ?? "",
      action: {
        type: "kinggame:setCommand",
        payload: { targetNumber: 1, mission: "테스트 미션" },
        clientActionId: "1",
      },
    });
    expect(notKingResult).toMatchObject({ ok: false, code: "NOT_YOUR_TURN" });

    const commandResult = module.handleAction({
      playerId: kingPlayerId ?? "",
      action: {
        type: "kinggame:setCommand",
        payload: { targetNumber: 1, mission: "테스트 미션" },
        clientActionId: "2",
      },
    });
    expect(commandResult).toMatchObject({ ok: true });
    expect(module.getPublicState().phase).toBe("revealed");

    const finishResult = module.handleAction({
      playerId: kingPlayerId ?? "",
      action: { type: "kinggame:finish", clientActionId: "3" },
    });
    expect(finishResult).toMatchObject({ ok: true });
    expect(module.isOver()?.ranking).toHaveLength(players.length);
  });

  it("completes 100 bot rounds for 2 to 10 players", () => {
    for (let playerCount = 2; playerCount <= 10; playerCount += 1) {
      for (let round = 0; round < 100; round += 1) {
        const module = new KingGameModule();
        const players = makePlayers(playerCount);
        module.start({
          players,
          options: defaultKingGameOptions,
          randomSeed: `bot-${playerCount}-${round}`,
        });

        const kingPlayerId = module.getPublicState().kingPlayerId;
        expect(kingPlayerId).toBeTruthy();

        const targetNumber = module.getPublicState().availableNumbers[0];
        expect(targetNumber).toBeTruthy();

        expect(
          module.handleAction({
            playerId: kingPlayerId ?? "",
            action: {
              type: "kinggame:setCommand",
              payload: { targetNumber, mission: "봇 라운드 미션" },
              clientActionId: `bot-command-${round}`,
            },
          }),
        ).toMatchObject({ ok: true });

        expect(
          module.handleAction({
            playerId: kingPlayerId ?? "",
            action: { type: "kinggame:finish", clientActionId: `bot-finish-${round}` },
          }),
        ).toMatchObject({ ok: true });
        expect(module.isOver()?.ranking).toHaveLength(playerCount);
      }
    }
  });
});
