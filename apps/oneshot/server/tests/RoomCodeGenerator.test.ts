import { describe, expect, it } from "vitest";
import { RoomCodeGenerator } from "../src/core/RoomCodeGenerator";

describe("RoomCodeGenerator", () => {
  it("generates readable fixed-length codes outside the collision set", () => {
    const generator = new RoomCodeGenerator({
      ROOM_CODE_ALPHABET: "ABCD2345",
      ROOM_CODE_LENGTH: 4,
    });
    const existing = new Set<string>();

    for (let index = 0; index < 50; index += 1) {
      const code = generator.generate(existing);
      expect(code).toHaveLength(4);
      expect(code).toMatch(/^[ABCD2345]+$/);
      expect(existing.has(code)).toBe(false);
      existing.add(code);
    }
  });
});
