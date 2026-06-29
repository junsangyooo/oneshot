import type {
  GameAction,
  GameResult,
  KingGameCommand,
  KingGameMode,
  KingGameOptions,
  KingGamePendingMission,
  KingGamePrivateState,
  KingGamePublicState,
  PublicPlayerState,
} from "@oneshot/shared";
import {
  KING_ACTIONS,
  KING_CUSTOM_POOL_MAX,
  KING_CUSTOM_TEXT_MAX,
  KING_CUSTOM_TEXT_MIN,
  missionById,
  missionsBySpice,
} from "@oneshot/shared";
import { Randomizer } from "../../core/Randomizer";
import { SecretDealer } from "../../core/SecretDealer";
import type { ActionResult, GameModule } from "../GameModule";

type Assignment =
  | { role: "king"; number: null }
  | { role: "subject"; number: number };

// A roll candidate: a preset (missionId) or a host-typed custom (missionRaw),
// always with a known slot count.
type MissionCandidate = {
  missionId?: string;
  missionRaw?: string;
  slots: number;
};

const RANDOM_MODES: ReadonlySet<KingGameMode> = new Set(["mild", "spicy", "custom"]);

export class KingGameModule
  implements GameModule<KingGameOptions, KingGamePublicState, KingGamePrivateState>
{
  readonly id = "kinggame" as const;
  readonly minPlayers = 2;

  private players: PublicPlayerState[] = [];
  private randomizer = new Randomizer("kinggame");
  private mode: KingGameMode | null = null;
  private customCandidates: MissionCandidate[] = [];
  private phase: KingGamePublicState["phase"] = "setup";
  private round = 0;
  private assignments = new Map<string, Assignment>();
  private kingPlayerId: string | null = null;
  private availableNumbers: number[] = [];
  private pendingMission: KingGamePendingMission | null = null;
  private command: KingGameCommand | null = null;
  private result: GameResult | null = null;

  start(input: { players: PublicPlayerState[]; options: KingGameOptions; randomSeed: string }): void {
    if (input.players.length < this.minPlayers) {
      throw new Error(`KingGame requires at least ${this.minPlayers} players`);
    }
    this.players = [...input.players].sort((left, right) => left.seatIndex - right.seatIndex);
    this.randomizer = new Randomizer(input.randomSeed);
    this.mode = null;
    this.customCandidates = [];
    this.phase = "setup";
    this.round = 0;
    this.assignments.clear();
    this.kingPlayerId = null;
    this.availableNumbers = [];
    this.pendingMission = null;
    this.command = null;
    this.result = null;
  }

  handleAction(input: { playerId: string; action: GameAction; isHost: boolean }): ActionResult {
    switch (input.action.type) {
      case KING_ACTIONS.configure:
        return this.configure(input.isHost, input.action.payload);
      case KING_ACTIONS.reveal:
        return this.reveal(input.playerId, input.action.payload);
      case KING_ACTIONS.nextTurn:
        return this.nextTurn(input.playerId, input.isHost);
      case KING_ACTIONS.endGame:
        return this.endGame(input.isHost);
      default:
        return { ok: false, code: "INVALID_ACTION", message: "지원하지 않는 왕게임 행동입니다." };
    }
  }

  getPublicState(): KingGamePublicState {
    return {
      mode: this.mode,
      phase: this.phase,
      round: this.round,
      kingPlayerId: this.kingPlayerId,
      availableNumbers: [...this.availableNumbers],
      command: this.command ? { ...this.command, targets: [...this.command.targets] } : null,
      customMissionCount: this.mode === "custom" ? this.customCandidates.length : 0,
    };
  }

  getStateFor(playerId: string): KingGamePrivateState {
    const assignment = this.assignments.get(playerId);
    const base: KingGamePrivateState =
      assignment != null
        ? { role: assignment.role, number: assignment.number, pendingMission: null }
        : { role: "subject", number: null, pendingMission: null };

    // The pending mission is secret: only the king sees it, and only while the
    // command is still being composed (random/custom modes).
    if (
      playerId === this.kingPlayerId &&
      this.phase === "command" &&
      this.pendingMission != null &&
      this.mode != null &&
      RANDOM_MODES.has(this.mode)
    ) {
      base.pendingMission = { ...this.pendingMission };
    }
    return base;
  }

  onPlayerLeave(_playerId: string): void {
    // King Game never auto-skips; the host (or king) drives the flow manually.
  }

  onPlayerReturn(_playerId: string): void {
    // Per-player assignments live in server memory and survive reconnects.
  }

  onPlayerRemoved(playerId: string): void {
    // A kick is permanent: drop the player from the deal roster so future turns
    // (and the 2-player number-count guarantee) reflect the live room. The
    // current turn is recovered by the host pressing "next turn".
    this.players = this.players.filter((player) => player.id !== playerId);
    const removed = this.assignments.get(playerId);
    this.assignments.delete(playerId);
    // Drop the kicked subject's number from the live deal so the king can't
    // reveal against a seat that no longer maps to anyone (which would otherwise
    // store an empty playerId and render a "—" target on the current turn).
    if (removed?.number != null) {
      this.availableNumbers = this.availableNumbers.filter((number) => number !== removed.number);
    }
    if (this.kingPlayerId === playerId) {
      this.kingPlayerId = null;
    }
  }

  isOver(): GameResult | null {
    return this.result;
  }

  // --- actions ---

  private configure(isHost: boolean, payload: unknown): ActionResult {
    if (this.phase !== "setup") {
      return { ok: false, code: "INVALID_ACTION", message: "이미 게임이 설정됐습니다." };
    }
    if (!isHost) {
      return { ok: false, code: "HOST_ONLY", message: "방장만 모드를 정할 수 있습니다." };
    }

    const parsed = this.parseConfigure(payload);
    if (!parsed.ok) {
      return parsed;
    }

    this.mode = parsed.mode;
    this.customCandidates = parsed.candidates;
    this.beginTurn(1);
    return { ok: true };
  }

  private reveal(playerId: string, payload: unknown): ActionResult {
    if (this.phase !== "command") {
      return { ok: false, code: "INVALID_ACTION", message: "지금은 미션을 공개할 수 없습니다." };
    }
    if (this.mode == null || !RANDOM_MODES.has(this.mode)) {
      return { ok: false, code: "INVALID_ACTION", message: "자유 모드에는 공개할 미션이 없습니다." };
    }
    if (playerId !== this.kingPlayerId) {
      return { ok: false, code: "NOT_YOUR_TURN", message: "왕만 미션을 공개할 수 있습니다." };
    }
    if (this.pendingMission == null) {
      return { ok: false, code: "INVALID_ACTION", message: "공개할 미션이 없습니다." };
    }

    const parsed = this.parseReveal(payload, this.pendingMission.slots);
    if (!parsed.ok) {
      return parsed;
    }

    const targets = parsed.targetNumbers.map((number) => ({
      number,
      playerId: this.findPlayerIdByNumber(number) ?? "",
    }));

    this.command = {
      missionId: this.pendingMission.missionId,
      missionRaw: this.pendingMission.missionRaw,
      slots: this.pendingMission.slots,
      targets,
      revealAt: Date.now(),
    };
    this.phase = "revealed";
    return { ok: true };
  }

  private nextTurn(playerId: string, isHost: boolean): ActionResult {
    if (playerId !== this.kingPlayerId && !isHost) {
      return { ok: false, code: "NOT_YOUR_TURN", message: "왕 또는 방장만 다음 턴으로 넘길 수 있습니다." };
    }
    if (this.phase === "setup") {
      return { ok: false, code: "INVALID_ACTION", message: "아직 게임이 시작되지 않았습니다." };
    }
    // Free mode advances from "command"; random modes advance from "revealed".
    // The host may also skip a stalled "command" turn (recovery).
    const freeAdvance = this.mode === "free" && this.phase === "command";
    const revealedAdvance = this.phase === "revealed";
    const hostSkip = isHost && this.phase === "command";
    if (!freeAdvance && !revealedAdvance && !hostSkip) {
      return { ok: false, code: "INVALID_ACTION", message: "먼저 미션을 공개하세요." };
    }

    this.beginTurn(this.round + 1);
    return { ok: true };
  }

  private endGame(isHost: boolean): ActionResult {
    if (!isHost) {
      return { ok: false, code: "HOST_ONLY", message: "방장만 게임을 종료할 수 있습니다." };
    }
    // King Game has no scoring/winner — emit a neutral result so the room moves
    // to the results phase (an empty ranking renders as a clean end screen).
    this.result = {
      ranking: [],
      winnerPlayerIds: [],
      summary: `왕게임 ${this.round}턴으로 마무리했어요.`,
    };
    return { ok: true };
  }

  // --- turn lifecycle ---

  private beginTurn(round: number): void {
    const playerIds = this.players.map((player) => player.id);
    const roleSecrets: Assignment[] = [
      { role: "king", number: null },
      ...Array.from({ length: playerIds.length - 1 }, (_, index) => ({
        role: "subject" as const,
        number: index + 1,
      })),
    ];

    const dealer = new SecretDealer(this.randomizer);
    this.assignments.clear();
    this.kingPlayerId = null;
    for (const { playerId, secret } of dealer.assignOneEach(playerIds, roleSecrets)) {
      this.assignments.set(playerId, secret);
      if (secret.role === "king") {
        this.kingPlayerId = playerId;
      }
    }

    this.availableNumbers = roleSecrets
      .filter((secret): secret is { role: "subject"; number: number } => secret.role === "subject")
      .map((secret) => secret.number)
      .sort((left, right) => left - right);

    this.round = round;
    this.command = null;
    this.pendingMission =
      this.mode != null && RANDOM_MODES.has(this.mode) ? this.rollMission() : null;
    this.phase = "command";
  }

  private rollMission(): KingGamePendingMission | null {
    const pool = this.candidatePool().filter(
      (candidate) => candidate.slots <= this.availableNumbers.length,
    );
    if (pool.length === 0) {
      return null;
    }
    const picked = this.randomizer.pick(pool);
    return { missionId: picked.missionId, missionRaw: picked.missionRaw, slots: picked.slots };
  }

  private candidatePool(): MissionCandidate[] {
    if (this.mode === "custom") {
      return this.customCandidates;
    }
    const spice = this.mode === "spicy" ? "spicy" : "mild";
    return missionsBySpice(spice).map((mission) => ({ missionId: mission.id, slots: mission.slots }));
  }

  // --- payload parsing / validation ---

  private parseConfigure(
    payload: unknown,
  ):
    | { ok: true; mode: KingGameMode; candidates: MissionCandidate[] }
    | { ok: false; code: "INVALID_ACTION"; message: string } {
    if (typeof payload !== "object" || payload === null || !("mode" in payload)) {
      return { ok: false, code: "INVALID_ACTION", message: "모드 설정이 올바르지 않습니다." };
    }
    const mode = payload.mode;
    if (mode !== "free" && mode !== "mild" && mode !== "spicy" && mode !== "custom") {
      return { ok: false, code: "INVALID_ACTION", message: "알 수 없는 모드입니다." };
    }
    if (mode !== "custom") {
      return { ok: true, mode, candidates: [] };
    }

    const rawList = (payload as { customMissions?: unknown }).customMissions;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return { ok: false, code: "INVALID_ACTION", message: "커스텀 미션을 한 개 이상 추가해주세요." };
    }
    if (rawList.length > KING_CUSTOM_POOL_MAX) {
      return { ok: false, code: "INVALID_ACTION", message: `커스텀 미션은 최대 ${KING_CUSTOM_POOL_MAX}개까지예요.` };
    }

    const candidates: MissionCandidate[] = [];
    for (const rawEntry of rawList) {
      const entry: unknown = rawEntry;
      if (entry === null || typeof entry !== "object" || !("kind" in entry)) {
        return { ok: false, code: "INVALID_ACTION", message: "커스텀 미션 형식이 올바르지 않습니다." };
      }
      const record = entry as {
        kind: unknown;
        missionId?: unknown;
        text?: unknown;
        slots?: unknown;
      };
      if (record.kind === "preset") {
        const preset =
          typeof record.missionId === "string" ? missionById(record.missionId) : undefined;
        if (!preset) {
          return { ok: false, code: "INVALID_ACTION", message: "없는 프리셋 미션입니다." };
        }
        candidates.push({ missionId: preset.id, slots: preset.slots });
      } else if (record.kind === "custom") {
        const text = typeof record.text === "string" ? record.text.trim() : "";
        if (text.length < KING_CUSTOM_TEXT_MIN || text.length > KING_CUSTOM_TEXT_MAX) {
          return {
            ok: false,
            code: "INVALID_ACTION",
            message: `미션은 ${KING_CUSTOM_TEXT_MIN}-${KING_CUSTOM_TEXT_MAX}자로 입력해주세요.`,
          };
        }
        if (record.slots !== 1 && record.slots !== 2) {
          return { ok: false, code: "INVALID_ACTION", message: "대상 인원은 1명 또는 2명이어야 합니다." };
        }
        candidates.push({ missionRaw: text, slots: record.slots });
      } else {
        return { ok: false, code: "INVALID_ACTION", message: "커스텀 미션 형식이 올바르지 않습니다." };
      }
    }

    // Guarantee at least one mission is playable with the available number count
    // (a 2-player room has only one number, so it needs a 1-target mission).
    const numberCount = this.players.length - 1;
    if (!candidates.some((candidate) => candidate.slots <= numberCount)) {
      return {
        ok: false,
        code: "INVALID_ACTION",
        message: "현재 인원에서 진행할 수 있는 1인 대상 미션이 최소 한 개 필요해요.",
      };
    }

    return { ok: true, mode, candidates };
  }

  private parseReveal(
    payload: unknown,
    slots: number,
  ):
    | { ok: true; targetNumbers: number[] }
    | { ok: false; code: "INVALID_ACTION"; message: string } {
    if (typeof payload !== "object" || payload === null || !("targetNumbers" in payload)) {
      return { ok: false, code: "INVALID_ACTION", message: "대상 입력이 올바르지 않습니다." };
    }
    const raw = payload.targetNumbers;
    if (!Array.isArray(raw)) {
      return { ok: false, code: "INVALID_ACTION", message: "대상 입력이 올바르지 않습니다." };
    }
    // Reject (not coerce) non-integer entries so the payload matches its number[] contract.
    const targetNumbers = raw.filter(
      (value): value is number => typeof value === "number" && Number.isInteger(value),
    );
    if (targetNumbers.length !== slots) {
      return { ok: false, code: "INVALID_ACTION", message: `대상 ${slots}명을 정해주세요.` };
    }
    if (targetNumbers.some((number) => !this.availableNumbers.includes(number))) {
      return { ok: false, code: "INVALID_ACTION", message: "없는 번호가 포함됐습니다." };
    }
    if (new Set(targetNumbers).size !== targetNumbers.length) {
      return { ok: false, code: "INVALID_ACTION", message: "서로 다른 번호를 골라주세요." };
    }
    return { ok: true, targetNumbers };
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
