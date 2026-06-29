import "dotenv/config";

import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server, matchMaker } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import { WebSocketTransport } from "@colyseus/ws-transport";
import compression from "compression";
import cors from "cors";
import type { CorsOptions } from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
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

// Security + transport headers. CSP is left off because the SPA loads Google
// Fonts and opens same-origin WebSockets; tighten with a tailored policy later.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// Throttle room creation so a single client can't spin up unlimited rooms.
const createRoomLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "잠시 후 다시 시도해 주세요." },
});

app.get("/healthz", (_request, response) => {
  response.json({ ok: true, service: "oneshot", time: new Date().toISOString() });
});

app.post("/api/rooms", createRoomLimiter, async (_request, response, next) => {
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

// The Colyseus monitor exposes room internals; only mount it outside production.
// To use it in production, put it behind auth/an allowlist before re-enabling.
if (config.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const clientDistPath = path.resolve(currentDir, "../../client/dist");
app.use(
  express.static(clientDistPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders: (response, filePath) => {
      // Vite hashes asset filenames, so they're safe to cache long-term, but the
      // HTML entrypoint must always revalidate to pick up new builds.
      if (filePath.endsWith("index.html")) {
        response.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);
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
