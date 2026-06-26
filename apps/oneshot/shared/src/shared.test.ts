import { describe, expect, it } from "vitest";
import {
  ERROR_MESSAGES,
  gameCatalog,
  isValidNickname,
  normalizeNickname,
  RETRYABLE_ERRORS,
} from "./index";

describe("nickname helpers", () => {
  it("normalizes whitespace and caps nickname length", () => {
    expect(normalizeNickname("  hello   world  ")).toBe("hello world");
    expect(normalizeNickname("a".repeat(40))).toHaveLength(16);
  });

  it("validates non-empty nicknames", () => {
    expect(isValidNickname("   ")).toBe(false);
    expect(isValidNickname("준상")).toBe(true);
  });
});

describe("shared catalog and errors", () => {
  it("contains kinggame as an available catalog item", () => {
    expect(gameCatalog.find((game) => game.id === "kinggame")?.status).toBe("available");
  });

  it("keeps user-facing error copy and retryability centralized", () => {
    expect(ERROR_MESSAGES.HOST_ONLY).toContain("방장");
    expect(RETRYABLE_ERRORS.has("SERVER_ERROR")).toBe(true);
    expect(RETRYABLE_ERRORS.has("HOST_ONLY")).toBe(false);
  });
});
