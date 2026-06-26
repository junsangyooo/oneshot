import { createHash, timingSafeEqual } from "node:crypto";

type TokenEnvelope = {
  v: 1;
  roomCode: string;
  secret: string;
};

export const createReconnectSecret = (): string => crypto.randomUUID().replaceAll("-", "");

export const encodeReconnectToken = (roomCode: string, secret: string): string => {
  const json = JSON.stringify({ v: 1, roomCode, secret } satisfies TokenEnvelope);
  return Buffer.from(json, "utf8").toString("base64url");
};

export const decodeReconnectToken = (token: string): TokenEnvelope | null => {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as unknown;
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "v" in decoded &&
      "roomCode" in decoded &&
      "secret" in decoded &&
      decoded.v === 1 &&
      typeof decoded.roomCode === "string" &&
      typeof decoded.secret === "string"
    ) {
      return {
        v: 1,
        roomCode: decoded.roomCode,
        secret: decoded.secret,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const hashReconnectSecret = (secret: string, sessionSecret: string): string =>
  createHash("sha256").update(`${sessionSecret}:${secret}`).digest("hex");

export const verifyReconnectSecret = (
  secret: string,
  sessionSecret: string,
  expectedHash: string,
): boolean => {
  const actual = Buffer.from(hashReconnectSecret(secret, sessionSecret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
