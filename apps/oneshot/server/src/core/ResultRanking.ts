import type { GameResult, PublicPlayerState } from "@oneshot/shared";

export const equalRankingResult = (
  players: readonly PublicPlayerState[],
  summary: string,
): GameResult => ({
  ranking: players.map((player) => ({ playerId: player.id, rank: 1, scoreDelta: 0 })),
  winnerPlayerIds: [],
  summary,
});
