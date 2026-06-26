import "dotenv/config";

import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server, matchMaker } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import type { CorsOptions } from "cors";
import express from "express";
import { getServerConfig } from "./config/env";
import {
  getRoomSummaryByCode,
  PartyRoom,
  releaseReservedRoomCode,
  reserveAvailableRoomCode,
} from "./rooms/PartyRoom";

const config = getServerConfig();
const app = express();
const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("party", PartyRoom).filterBy(["roomCode"]);

const corsOrigin: CorsOptions["origin"] = (origin, callback) => {
  if (!origin || origin === config.PUBLIC_ORIGIN) {
    callback(null, true);
    return;
  }

  if (config.NODE_ENV !== "production" && isLocalDevOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(null, false);
};

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.get("/healthz", (_request, response) => {
  response.json({ ok: true, service: "oneshot", time: new Date().toISOString() });
});

app.post("/api/rooms", async (_request, response, next) => {
  let roomCode: string | null = null;
  try {
    roomCode = reserveAvailableRoomCode();
    const room = await matchMaker.createRoom("party", { roomCode });
    const metadata = room.metadata as { roomCode?: string } | undefined;
    response.status(201).json({
      roomId: room.roomId,
      roomCode: metadata?.roomCode ?? roomCode,
    });
  } catch (error) {
    if (roomCode) {
      releaseReservedRoomCode(roomCode);
    }
    next(error);
  }
});

app.get("/api/rooms/:roomCode/summary", (request, response) => {
  const roomCode = request.params.roomCode?.toUpperCase() ?? "";
  const summary = getRoomSummaryByCode(roomCode);
  if (!summary) {
    response.status(404).json({ code: "ROOM_NOT_FOUND", message: "방을 찾지 못했습니다." });
    return;
  }
  response.json(summary);
});

app.use("/colyseus", monitor());

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientDistPath = path.resolve(currentDir, "../../client/dist");
app.use(express.static(clientDistPath));
app.get(["/", "/r/:roomCode"], (_request, response) => {
  response.sendFile(path.join(clientDistPath, "index.html"), (error) => {
    if (error) {
      response.status(200).json({
        ok: true,
        service: "oneshot",
        message: "Client build not found. Run pnpm --filter @oneshot/client build.",
      });
    }
  });
});

httpServer.listen(config.SERVER_PORT, config.SERVER_HOST, () => {
  console.log(`OneShot server listening on http://${config.SERVER_HOST}:${config.SERVER_PORT}`);
});

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname)) {
      return true;
    }
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname);
  } catch {
    return false;
  }
}
