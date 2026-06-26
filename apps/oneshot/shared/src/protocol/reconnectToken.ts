export type ReconnectTokenEnvelope = {
  v: 1;
  roomCode: string;
  secret: string;
};

export const readReconnectTokenEnvelope = (token: string): ReconnectTokenEnvelope | null => {
  try {
    const base64 = token.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = globalThis.atob(padded);
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      "roomCode" in parsed &&
      "secret" in parsed &&
      parsed.v === 1 &&
      typeof parsed.roomCode === "string" &&
      typeof parsed.secret === "string"
    ) {
      return {
        v: 1,
        roomCode: parsed.roomCode,
        secret: parsed.secret,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const readRoomCodeFromReconnectToken = (token: string): string | null =>
  readReconnectTokenEnvelope(token)?.roomCode ?? null;
