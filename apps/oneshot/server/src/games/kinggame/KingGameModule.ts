import type {
  GameAction,
  GameResult,
  KingGameCommand,
  KingGameOptions,
  KingGamePrivateState,
  KingGamePublicState,
  KingGameSetCommandPayload,
  PublicPlayerState,
} from "@oneshot/shared";
import { defaultKingGameOptions } from "@oneshot/shared";
import { Randomizer } from "../../core/Randomizer";
import { SecretDealer } from "../../core/SecretDealer";
import type { ActionResult, GameModule } from "../GameModule";

type Assignment =
  | { role: "king"; number: null }
  | { role: "subject"; number: number };

type CommandParseResult =
  | { ok: true; payload: KingGameSetCommandPayload }
  | { ok: false; code: "INVALID_ACTION"; message: string };

export class KingGameModule
  implements GameModule<KingGameOptions, KingGamePublicState, KingGamePrivateState>
{
  readonly id = "kinggame" as const;
  readonly minPlayers = 2;
  readonly maxPlayers = 12;

  private players: PublicPlayerState[] = [];
  private assignments = new Map<string, Assignment>();
  private kingPlayerId: string | null = null;
  private availableNumbers: number[] = [];
  private command: KingGameCommand | null = null;
  private phase: KingGamePublicState["phase"] = "assigning";
  private result: GameResult | null = null;
  private options: KingGameOptions = defaultKingGameOptions;

  start(input: {
    players: PublicPlayerState[];
    options: KingGameOptions;
    randomSeed: string;
  }): void {
    if (input.players.length < this.minPlayers || input.players.length > this.maxPlayers) {
      throw new Error(`KingGame requires ${this.minPlayers}-${this.maxPlayers} players`);
    }

    this.players = [...input.players].sort((left, right) => left.seatIndex - right.seatIndex);
    this.options = {
      ...defaultKingGameOptions,
      ...input.options,
      missionTemplates:
        input.options.missionTemplates?.length > 0
          ? input.options.missionTemplates
          : defaultKingGameOptions.missionTemplates,
    };

    const randomizer = new Randomizer(input.randomSeed);
    const dealer = new SecretDealer(randomizer);
    const playerIds = this.players.map((player) => player.id);
    const roleSecrets = [
      { role: "king" as const, number: null },
      ...Array.from({ length: playerIds.length - 1 }, (_, index) => ({
        role: "subject" as const,
        number: index + 1,
      })),
    ];

    this.assignments.clear();
    for (const assignment of dealer.assignOneEach(playerIds, roleSecrets)) {
      this.assignments.set(assignment.playerId, assignment.secret);
      if (assignment.secret.role === "king") {
        this.kingPlayerId = assignment.playerId;
      }
    }

    this.availableNumbers = roleSecrets
      .filter((secret): secret is { role: "subject"; number: number } => secret.role === "subject")
      .map((secret) => secret.number)
      .sort((left, right) => left - right);
    this.phase = "awaiting_command";
    this.command = null;
    this.result = null;
  }

  handleAction(input: { playerId: string; action: GameAction }): ActionResult {
    if (input.action.type === "kinggame:setCommand") {
      return this.setCommand(input.playerId, input.action.payload);
    }
    if (input.action.type === "kinggame:finish") {
      return this.finish(input.playerId);
    }
    return { ok: false, code: "INVALID_ACTION", message: "지원하지 않는 왕게임 행동입니다." };
  }

  getPublicState(): KingGamePublicState {
    return {
      phase: this.phase,
      round: 1,
      kingPlayerId: this.kingPlayerId,
      availableNumbers: [...this.availableNumbers],
      command: this.command,
    };
  }

  getStateFor(playerId: string): KingGamePrivateState {
    const assignment = this.assignments.get(playerId);
    if (!assignment) {
      return { role: "subject", number: null };
    }
    return assignment;
  }

  onPlayerLeave(_playerId: string): void {
    // 왕게임은 자동 스킵하지 않는다. 방장이 수동으로 흐름을 정리한다.
  }

  onPlayerReturn(_playerId: string): void {
    // 개인 배정은 서버 메모리에 유지되어 그대로 복귀한다.
  }

  isOver(): GameResult | null {
    return this.result;
  }

  private setCommand(playerId: string, payload: unknown): ActionResult {
    if (this.phase !== "awaiting_command") {
      return { ok: false, code: "INVALID_ACTION", message: "이미 왕의 지시가 공개됐습니다." };
    }
    if (playerId !== this.kingPlayerId) {
      return { ok: false, code: "NOT_YOUR_TURN", message: "왕만 미션을 선택할 수 있습니다." };
    }

    const parsed = this.parseCommandPayload(payload);
    if (!parsed.ok) {
      return parsed;
    }

    const targetPlayerId = this.findPlayerIdByNumber(parsed.payload.targetNumber);
    if (!targetPlayerId) {
      return { ok: false, code: "INVALID_ACTION", message: "없는 번호입니다." };
    }

    const mission = parsed.payload.mission.trim();
    const allowedMission =
      this.options.allowCustomMission || this.options.missionTemplates.includes(mission);
    if (!allowedMission) {
      return { ok: false, code: "INVALID_ACTION", message: "선택할 수 없는 미션입니다." };
    }

    this.command = {
      kingPlayerId: playerId,
      targetPlayerId,
      targetNumber: parsed.payload.targetNumber,
      mission,
      createdAt: Date.now(),
    };
    this.phase = "revealed";
    return { ok: true, events: [{ type: "kinggame:commandRevealed", payload: this.command }] };
  }

  private finish(playerId: string): ActionResult {
    if (this.phase !== "revealed" || !this.command) {
      return { ok: false, code: "INVALID_ACTION", message: "아직 결과를 확정할 수 없습니다." };
    }
    if (playerId !== this.kingPlayerId) {
      return { ok: false, code: "NOT_YOUR_TURN", message: "왕만 결과를 확정할 수 있습니다." };
    }

    const target = this.players.find((player) => player.id === this.command?.targetPlayerId);
    const targetName = target?.nickname ?? "선택된 참가자";
    this.phase = "complete";
    this.result = {
      ranking: this.players.map((player) => ({
        playerId: player.id,
        rank: player.id === this.kingPlayerId ? 1 : 2,
        scoreDelta: player.id === this.kingPlayerId ? 1 : 0,
      })),
      winnerPlayerIds: this.kingPlayerId ? [this.kingPlayerId] : [],
      summary: `${targetName} 님이 ${this.command.targetNumber}번 미션을 확인했습니다.`,
    };
    return { ok: true, events: [{ type: "kinggame:complete" }] };
  }

  private parseCommandPayload(
    payload: unknown,
  ): CommandParseResult {
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("targetNumber" in payload) ||
      !("mission" in payload)
    ) {
      return { ok: false, code: "INVALID_ACTION", message: "미션 입력이 올바르지 않습니다." };
    }

    const targetNumber = Number(payload.targetNumber);
    const mission = String(payload.mission);
    if (!Number.isInteger(targetNumber) || !this.availableNumbers.includes(targetNumber)) {
      return { ok: false, code: "INVALID_ACTION", message: "대상 번호가 올바르지 않습니다." };
    }
    if (mission.trim().length < 2 || mission.trim().length > 80) {
      return { ok: false, code: "INVALID_ACTION", message: "미션은 2-80자로 입력해주세요." };
    }

    return { ok: true, payload: { targetNumber, mission } };
  }

  private findPlayerIdByNumber(targetNumber: number): string | null {
    for (const [playerId, assignment] of this.assignments) {
      if (assignment.role === "subject" && assignment.number === targetNumber) {
        return playerId;
      }
    }
    return null;
  }
}
