import type { Randomizer } from "./Randomizer";

export type SecretAssignment<TSecret> = {
  playerId: string;
  secret: TSecret;
};

export class SecretDealer {
  constructor(private readonly randomizer: Randomizer) {}

  assignOneEach<TSecret>(
    playerIds: readonly string[],
    secrets: readonly TSecret[],
  ): SecretAssignment<TSecret>[] {
    if (secrets.length < playerIds.length) {
      throw new Error("Not enough secrets for players");
    }
    const shuffledSecrets = this.randomizer.shuffle(secrets);
    return playerIds.map((playerId, index) => {
      const secret = shuffledSecrets[index];
      if (secret === undefined) {
        throw new Error("Secret assignment failed");
      }
      return { playerId, secret };
    });
  }
}
