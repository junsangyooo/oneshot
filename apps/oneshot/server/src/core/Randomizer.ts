export class Randomizer {
  private state: number;

  constructor(seed: string) {
    this.state = this.hashSeed(seed);
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(minInclusive: number, maxInclusive: number): number {
    return Math.floor(this.next() * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.integer(0, index);
      const current = copy[index];
      const next = copy[swapIndex];
      if (current !== undefined && next !== undefined) {
        copy[index] = next;
        copy[swapIndex] = current;
      }
    }
    return copy;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty array");
    }
    const picked = items[this.integer(0, items.length - 1)];
    if (picked === undefined) {
      throw new Error("Random pick failed");
    }
    return picked;
  }

  private hashSeed(seed: string): number {
    let hash = 1779033703 ^ seed.length;
    for (let index = 0; index < seed.length; index += 1) {
      hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash >>> 0;
  }
}

export const createRandomSeed = (): string =>
  `${Date.now().toString(36)}-${crypto.randomUUID()}`;
