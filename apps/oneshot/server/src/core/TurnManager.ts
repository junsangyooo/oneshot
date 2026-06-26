export class TurnManager {
  private cursor = 0;
  private readonly activePlayerIds: string[];

  constructor(playerIds: readonly string[]) {
    if (playerIds.length === 0) {
      throw new Error("TurnManager requires at least one player");
    }
    this.activePlayerIds = [...playerIds];
  }

  current(): string {
    const playerId = this.activePlayerIds[this.cursor];
    if (playerId === undefined) {
      throw new Error("No current turn player");
    }
    return playerId;
  }

  advance(): string {
    this.cursor = (this.cursor + 1) % this.activePlayerIds.length;
    return this.current();
  }

  remove(playerId: string): void {
    const index = this.activePlayerIds.indexOf(playerId);
    if (index === -1) {
      return;
    }
    this.activePlayerIds.splice(index, 1);
    if (this.activePlayerIds.length === 0) {
      this.cursor = 0;
      return;
    }
    if (this.cursor >= this.activePlayerIds.length) {
      this.cursor = 0;
    }
  }
}
