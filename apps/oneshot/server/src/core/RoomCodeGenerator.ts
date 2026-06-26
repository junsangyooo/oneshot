import type { ServerConfig } from "../config/env";
import { Randomizer } from "./Randomizer";

export class RoomCodeGenerator {
  private readonly alphabet: string[];
  private readonly codeLength: number;
  private readonly randomizer = new Randomizer(`${Date.now()}-room-code`);

  constructor(config: Pick<ServerConfig, "ROOM_CODE_ALPHABET" | "ROOM_CODE_LENGTH">) {
    this.alphabet = Array.from(new Set(config.ROOM_CODE_ALPHABET.split("")));
    this.codeLength = config.ROOM_CODE_LENGTH;
  }

  generate(existingCodes: ReadonlySet<string> = new Set()): string {
    const maxAttempts = 1000;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const code = Array.from({ length: this.codeLength }, () =>
        this.randomizer.pick(this.alphabet),
      ).join("");
      if (!existingCodes.has(code)) {
        return code;
      }
    }
    throw new Error("Unable to allocate a room code");
  }
}
