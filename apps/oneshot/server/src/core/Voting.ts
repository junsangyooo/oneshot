export type VoteResult = {
  counts: Record<string, number>;
  topCandidateIds: string[];
};

export class Voting {
  private readonly votes = new Map<string, string>();

  cast(voterId: string, candidateId: string): void {
    this.votes.set(voterId, candidateId);
  }

  tally(): VoteResult {
    const counts: Record<string, number> = {};
    for (const candidateId of this.votes.values()) {
      counts[candidateId] = (counts[candidateId] ?? 0) + 1;
    }
    const highest = Math.max(0, ...Object.values(counts));
    const topCandidateIds = Object.entries(counts)
      .filter(([, count]) => count === highest)
      .map(([candidateId]) => candidateId);
    return { counts, topCandidateIds };
  }
}
