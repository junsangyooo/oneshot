export type ClientConfig = {
  publicOrigin: string;
  wsUrl: string;
  apiUrl: string;
};

const env = import.meta.env;

const currentOrigin = globalThis.location?.origin ?? "http://localhost:5173";
const currentProtocol = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
const currentWsUrl = `${currentProtocol}//${globalThis.location?.host ?? "localhost:2567"}`;

export const clientConfig: ClientConfig = {
  publicOrigin: String(env.VITE_PUBLIC_ORIGIN ?? currentOrigin),
  wsUrl: String(env.VITE_WS_URL ?? currentWsUrl),
  apiUrl: String(env.VITE_API_URL ?? currentOrigin),
};
