import { describe, expect, it } from "vitest";
import { parseServerEnv } from "../src/config/env";

const validEnv = {
  NODE_ENV: "test",
  SERVER_HOST: "127.0.0.1",
  SERVER_PORT: "2567",
  PUBLIC_ORIGIN: "http://localhost:5173",
  ROOM_CODE_LENGTH: "5",
  ROOM_CODE_ALPHABET: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  SESSION_SECRET: "test-secret-value",
  COLYSEUS_RECONNECT_WINDOW_SECONDS: "86400",
  EMPTY_ROOM_TTL_SECONDS: "3600",
};

describe("server env", () => {
  it("parses a complete environment", () => {
    expect(parseServerEnv(validEnv).SERVER_PORT).toBe(2567);
  });

  it("rejects missing required values", () => {
    const { SERVER_HOST: _serverHost, ...missingHost } = validEnv;
    expect(() => parseServerEnv(missingHost)).toThrow();
  });

  it("rejects production with the development session secret", () => {
    expect(() =>
      parseServerEnv({
        ...validEnv,
        NODE_ENV: "production",
        SESSION_SECRET: "dev-only-change-me",
      }),
    ).toThrow();
  });
});
