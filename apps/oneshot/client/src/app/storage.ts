const keys = {
  nickname: "oneshot.nickname",
  reconnectToken: "oneshot.reconnectToken",
} as const;

export const storage = {
  getNickname(): string {
    return localStorage.getItem(keys.nickname) ?? "";
  },
  setNickname(nickname: string): void {
    localStorage.setItem(keys.nickname, nickname);
  },
  getReconnectToken(): string | null {
    return localStorage.getItem(keys.reconnectToken);
  },
  setReconnectToken(token: string): void {
    localStorage.setItem(keys.reconnectToken, token);
  },
  clearReconnectToken(): void {
    localStorage.removeItem(keys.reconnectToken);
  },
};
