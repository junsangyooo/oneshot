import { useEffect, useRef, useState } from "react";
import type { PartyRoomState, RummikubPrivateState, RummikubPublicState, Tile } from "@oneshot/shared";
import {
  RUMMIKUB_ACTIONS,
  RUMMIKUB_DEFAULT_TURN_SECONDS,
  RUMMIKUB_TURN_SECONDS,
} from "@oneshot/shared";
import { useRoomStore } from "../../app/useRoomStore";
import { useT } from "../../i18n";
import { Backdrop, AvatarImg, GameRail, RulesModal, SettingsModal } from "../../ui/terminal";
import type { RailSeat } from "../../ui/terminal";
import { useCountdown } from "../../ui/useCountdown";
import {
  checkCommit,
  invalidMeldIds,
  place,
  playedTileIds,
  stageFromServer,
  toCommitPayload,
  type DropTarget,
  type Stage,
} from "./staging";
import { autoExtend, sort777, sort789 } from "./tileSort";

type Props = { roomState: PartyRoomState; privateState: unknown; currentPlayerId: string | null };

const fill = (s: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

const turnLabel = (secs: number, t: ReturnType<typeof useT>): string =>
  secs === 0 ? t("rummikub.setup.unlimited") : `${secs}${t("rummikub.setup.sec")}`;

// ---------------------------- tile face ----------------------------

const TileFace = ({ tile, cls }: { tile: Tile; cls?: string }) => {
  if (tile.kind === "joker") {
    return (
      <span className={`rk-tile rk-tile--joker ${cls ?? ""}`}>
        <span className="rk-tile__joker">☺</span>
        <i className="rk-tile__hole" />
      </span>
    );
  }
  return (
    <span className={`rk-tile rk-tile--${tile.color} ${cls ?? ""}`}>
      <b className="rk-tile__num">{tile.num}</b>
      <i className="rk-tile__hole" />
    </span>
  );
};

// ---------------------------- orientation ----------------------------

const useIsPortrait = (): boolean => {
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(orientation: portrait)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = () => setPortrait(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return portrait;
};

// ---------------------------- setup ----------------------------

const SetupView = ({
  isHost,
  onStart,
}: {
  isHost: boolean;
  onStart: (turnSeconds: number) => void;
}) => {
  const t = useT();
  const [idx, setIdx] = useState(() => Math.max(0, RUMMIKUB_TURN_SECONDS.indexOf(RUMMIKUB_DEFAULT_TURN_SECONDS)));
  const secs = RUMMIKUB_TURN_SECONDS[idx]!;
  return (
    <section className="rk-setup">
      <h2 className="rk-setup__title">{t("rummikub.setup.title")}</h2>
      {isHost ? (
        <>
          <div className="rk-setup__label">{t("rummikub.setup.turnTime")}</div>
          <div className="rk-stepper">
            <button
              type="button"
              className="rk-stepper__arrow"
              aria-label={t("rummikub.setup.more")}
              disabled={idx >= RUMMIKUB_TURN_SECONDS.length - 1}
              onClick={() => setIdx((i) => Math.min(RUMMIKUB_TURN_SECONDS.length - 1, i + 1))}
            >
              ▲
            </button>
            <div className="rk-stepper__value">{turnLabel(secs, t)}</div>
            <button
              type="button"
              className="rk-stepper__arrow"
              aria-label={t("rummikub.setup.less")}
              disabled={idx <= 0}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
            >
              ▼
            </button>
          </div>
          <button type="button" className="btn btn--primary rk-setup__start" onClick={() => onStart(secs)}>
            <span>{t("rummikub.setup.start")}</span>
          </button>
        </>
      ) : (
        <p className="rk-setup__wait">{t("rummikub.setup.waitHost")}</p>
      )}
    </section>
  );
};

// ---------------------------- main ----------------------------

export const RummikubGameScreen = ({ roomState, privateState, currentPlayerId }: Props) => {
  const t = useT();
  const send = useRoomStore((s) => s.send);
  const pub = roomState.activeGame?.publicState as RummikubPublicState | undefined;
  const me = privateState as RummikubPrivateState | null;
  const myPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = myPlayer?.isHost ?? false;
  const portrait = useIsPortrait();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"none" | "777" | "789">("none");
  const [sel, setSel] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>(() => stageFromServer(pub?.board ?? [], me?.hand ?? []));
  const [glowMelds, setGlowMelds] = useState<string[]>([]);

  const sendAction = (type: string, payload?: unknown) =>
    send({ type: "game:action", action: { type, payload, clientActionId: crypto.randomUUID() } });

  const isMyTurn = pub?.phase === "play" && pub.currentTurnPlayerId === currentPlayerId;
  const meState = pub?.players.find((p) => p.playerId === currentPlayerId);
  const didInitial = meState?.hasDoneInitialMeld ?? false;

  // Resync the working copy at every turn boundary (and on mount). During my own
  // turn the turn number is stable, so local edits are never clobbered.
  const turnNumber = pub?.turnNumber ?? 0;
  useEffect(() => {
    setStage(stageFromServer(pub?.board ?? [], me?.hand ?? []));
    setSel([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnNumber, pub?.phase]);

  // Opponent commit glow.
  const eventSeq = pub?.lastEvent?.seq ?? 0;
  useEffect(() => {
    if (pub?.lastEvent?.kind === "commit" && pub.lastEvent.playerId !== currentPlayerId) {
      setGlowMelds(pub.lastEvent.meldIds ?? []);
      const timer = setTimeout(() => setGlowMelds([]), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSeq]);

  const timeLeft = useCountdown(isMyTurn ? pub?.turnDeadline : null);
  // Fire a validated timeout when my deadline passes (server re-checks the clock).
  useEffect(() => {
    if (!pub || pub.phase !== "play" || pub.turnDeadline == null) return;
    if (pub.currentTurnPlayerId !== currentPlayerId) return;
    const ms = pub.turnDeadline - Date.now();
    const timer = setTimeout(
      () => sendAction(RUMMIKUB_ACTIONS.timeout, { turnNumber: pub.turnNumber }),
      Math.max(0, ms) + 250,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub?.turnDeadline, pub?.currentTurnPlayerId, pub?.turnNumber]);

  // ---- drag state ----
  const dragRef = useRef<{ ids: string[]; moved: boolean } | null>(null);
  const pressRef = useRef<{ id: string; x: number; y: number; timer: number | null; from: "hand" | "board" } | null>(
    null,
  );
  const [ghost, setGhost] = useState<{ x: number; y: number; tiles: Tile[] } | null>(null);

  if (!pub) {
    return (
      <main className="scr scr--rummikub">
        <Backdrop />
        <div className="rk-loading">{t("rummikub.loading")}</div>
      </main>
    );
  }

  const nameOf = (id: string): string =>
    id === currentPlayerId ? t("rummikub.you") : (roomState.players[id]?.nickname ?? "—");

  // ---- setup phase ----
  if (pub.phase === "setup") {
    return (
      <main className="scr scr--rummikub scr--rummikub-setup">
        <Backdrop />
        <header className="topbar rk-topbar">
          <div className="readout">
            <div>{t("rummikub.title")}</div>
            <div className="rk-topbar__code">#{roomState.roomCode}</div>
          </div>
          <div className="rk-toolbar">
            <button type="button" className="btn btn--sm" aria-label={t("rules.help")} onClick={() => setRulesOpen(true)}>
              <span>?</span>
            </button>
            <button type="button" className="btn btn--sm" aria-label={t("settings.title")} onClick={() => setSettingsOpen(true)}>
              <span>⚙</span>
            </button>
          </div>
        </header>
        <SetupView isHost={isHost} onStart={(s) => sendAction(RUMMIKUB_ACTIONS.configure, { turnSeconds: s })} />
        <RummikubModals
          rulesOpen={rulesOpen}
          settingsOpen={settingsOpen}
          onRules={() => setRulesOpen(false)}
          onSettings={() => setSettingsOpen(false)}
          t={t}
        />
      </main>
    );
  }

  // ---- results handled by the room; here we render play / ended-play ----

  const tileById = (id: string): Tile | null => {
    const inHand = stage.hand.find((x) => x.id === id);
    if (inHand) return inHand;
    for (const m of stage.board) {
      const found = m.tiles.find((x) => x.id === id);
      if (found) return found;
    }
    return null;
  };

  const sortedHand = sortMode === "777" ? sort777(stage.hand) : sortMode === "789" ? sort789(stage.hand) : stage.hand;
  const invalidIds = invalidMeldIds(stage);
  const played = playedTileIds(stage);
  const commit = checkCommit(stage, didInitial);
  const canManip = didInitial;

  const applyPlace = (ids: string[], target: DropTarget) => {
    const next = place(stage, ids, target, canManip);
    if (next) setStage(next);
    setSel([]);
  };

  const toggleSel = (id: string, from: "hand" | "board") => {
    if (from === "board" && !canManip) return; // can't touch board before initial meld
    setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  // ---- pointer handlers (tap-select + long-press + drag) ----
  const onTilePointerDown = (e: React.PointerEvent, id: string, from: "hand" | "board") => {
    if (!isMyTurn) return;
    if (from === "board" && !canManip) return;
    const timer = window.setTimeout(() => {
      if (from === "hand") {
        setSel(autoExtend(stage.hand, id));
        pressRef.current = null;
      }
    }, 430);
    pressRef.current = { id, x: e.clientX, y: e.clientY, timer, from };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onTilePointerMove = (e: React.PointerEvent) => {
    const press = pressRef.current;
    if (!press) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!dragRef.current && Math.hypot(dx, dy) > 8) {
      if (press.timer) window.clearTimeout(press.timer);
      const ids = sel.includes(press.id) && sel.length > 0 ? sel : [press.id];
      dragRef.current = { ids, moved: true };
    }
    if (dragRef.current) {
      const tiles = dragRef.current.ids.map(tileById).filter(Boolean) as Tile[];
      setGhost({ x: e.clientX, y: e.clientY, tiles });
    }
  };

  const onTilePointerUp = (e: React.PointerEvent, id: string, from: "hand" | "board") => {
    const press = pressRef.current;
    if (press?.timer) window.clearTimeout(press.timer);
    pressRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    setGhost(null);
    if (!drag) {
      // tap
      toggleSel(id, from);
      return;
    }
    // drop: hit-test the element under the pointer
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const zone = el?.closest("[data-drop]") as HTMLElement | null;
    if (!zone) return;
    const kind = zone.dataset.drop;
    if (kind === "new") applyPlace(drag.ids, { zone: "new" });
    else if (kind === "hand") applyPlace(drag.ids, { zone: "hand" });
    else if (kind === "meld") {
      const meldId = zone.dataset.meldId!;
      const index = computeInsertIndex(zone, e.clientX);
      applyPlace(drag.ids, { zone: "meld", meldId, index });
    }
  };

  // ---- rail ----
  const railSeats: RailSeat[] = pub.order.map((id) => {
    const p = pub.players.find((x) => x.playerId === id);
    return {
      id,
      countLabel: String(p?.handCount ?? 0),
      turn: pub.currentTurnPlayerId === id,
      accent: p?.hasDoneInitialMeld ? "lead" : null,
      badge: !p?.connected ? t("rummikub.offline") : p && p.handCount === 1 ? t("rummikub.lastTile") : null,
      dim: !p?.connected,
    };
  });

  const currentName = pub.currentTurnPlayerId ? nameOf(pub.currentTurnPlayerId) : "—";
  const boardTileCount = stage.board.reduce((s, m) => s + m.tiles.length, 0);
  const zoom = boardTileCount > 66 ? 0.6 : boardTileCount > 46 ? 0.72 : boardTileCount > 28 ? 0.85 : 1;
  const currentDisconnected =
    pub.currentTurnPlayerId != null && !pub.players.find((p) => p.playerId === pub.currentTurnPlayerId)?.connected;

  return (
    <main className={`scr scr--rummikub ${isMyTurn ? "is-myturn" : ""}`}>
      <Backdrop />

      <header className="topbar rk-topbar">
        <GameRail seats={railSeats} players={roomState.players} nameOf={nameOf} />
        <div className="rk-turn">
          <span className="rk-turn__label">{isMyTurn ? t("rummikub.yourTurn") : fill(t("rummikub.turnOf"), { name: currentName })}</span>
          {pub.turnDeadline != null && isMyTurn ? <span className="rk-turn__timer">{timeLeft}s</span> : null}
          <span className="rk-turn__pool">{fill(t("rummikub.poolLeft"), { n: pub.poolCount })}</span>
        </div>
        <div className="rk-toolbar">
          {isHost && currentDisconnected ? (
            <button type="button" className="btn btn--sm" onClick={() => sendAction(RUMMIKUB_ACTIONS.skipTurn)}>
              <span>{t("rummikub.skip")}</span>
            </button>
          ) : null}
          <button type="button" className="btn btn--sm" aria-label={t("rules.help")} onClick={() => setRulesOpen(true)}>
            <span>?</span>
          </button>
          <button type="button" className="btn btn--sm" aria-label={t("settings.title")} onClick={() => setSettingsOpen(true)}>
            <span>⚙</span>
          </button>
        </div>
      </header>

      {/* board */}
      <section className="rk-board" style={{ ["--rk-zoom" as string]: String(zoom) }}>
        <div className="rk-board__inner">
          {stage.board.map((m) => (
            <div
              key={m.id}
              data-drop="meld"
              data-meld-id={m.id}
              className={[
                "rk-meld",
                invalidIds.has(m.id) ? "is-invalid" : "",
                glowMelds.includes(m.id) ? "is-glow" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {m.tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className="rk-tilebtn"
                  onPointerDown={(e) => onTilePointerDown(e, tile.id, "board")}
                  onPointerMove={onTilePointerMove}
                  onPointerUp={(e) => onTilePointerUp(e, tile.id, "board")}
                >
                  <TileFace tile={tile} cls={sel.includes(tile.id) ? "is-sel" : ""} />
                </button>
              ))}
            </div>
          ))}
          {isMyTurn ? (
            <div data-drop="new" className="rk-meld rk-meld--new">
              <span className="rk-meld--new__hint">＋</span>
            </div>
          ) : null}
          {stage.board.length === 0 && !isMyTurn ? <div className="rk-board__empty">{t("rummikub.emptyBoard")}</div> : null}
        </div>
      </section>

      {/* my area */}
      <section className="rk-me">
        <div className="rk-me__bar">
          <span className="rk-me__who">
            <span className="rk-me__tag">{t("rummikub.you")}</span>
            {didInitial ? null : <span className="rk-me__need">{t("rummikub.needInitial")}</span>}
          </span>
          <div className="rk-sorts">
            <button
              type="button"
              className={`btn btn--sm ${sortMode === "777" ? "btn--primary" : ""}`}
              onClick={() => setSortMode("777")}
            >
              <span>777</span>
            </button>
            <button
              type="button"
              className={`btn btn--sm ${sortMode === "789" ? "btn--primary" : ""}`}
              onClick={() => setSortMode("789")}
            >
              <span>789</span>
            </button>
          </div>
        </div>

        <div data-drop="hand" className="rk-rack">
          {sortedHand.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className="rk-tilebtn rk-tilebtn--hand"
              onPointerDown={(e) => onTilePointerDown(e, tile.id, "hand")}
              onPointerMove={onTilePointerMove}
              onPointerUp={(e) => onTilePointerUp(e, tile.id, "hand")}
            >
              <TileFace tile={tile} cls={sel.includes(tile.id) ? "is-sel" : ""} />
            </button>
          ))}
          {sortedHand.length === 0 ? <span className="rk-rack__empty">—</span> : null}
        </div>

        {/* action bar */}
        <div className="rk-actions">
          <button
            type="button"
            className="btn btn--sm"
            disabled={!isMyTurn || sel.length === 0}
            onClick={() => applyPlace(sel, { zone: "new" })}
          >
            <span>{t("rummikub.placeNew")}</span>
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={!isMyTurn || played.length === 0}
            onClick={() => {
              setStage(stageFromServer(pub.board, me?.hand ?? []));
              setSel([]);
            }}
          >
            <span>{t("rummikub.reset")}</span>
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={!isMyTurn || played.length > 0}
            onClick={() => sendAction(RUMMIKUB_ACTIONS.draw)}
          >
            <span>{t("rummikub.draw")}</span>
          </button>
          <button
            type="button"
            className="btn btn--primary rk-actions__end"
            disabled={!isMyTurn || !commit.ok}
            onClick={() => sendAction(RUMMIKUB_ACTIONS.commit, toCommitPayload(stage))}
          >
            <span>
              {t("rummikub.endTurn")}
              {!didInitial && commit.ok === false && commit.reason === "initialLow"
                ? ` (${commit.points ?? 0}/30)`
                : ""}
            </span>
          </button>
        </div>
      </section>

      {ghost ? (
        <div className="rk-ghost" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.tiles.slice(0, 6).map((tile, i) => (
            <TileFace key={tile.id + i} tile={tile} />
          ))}
        </div>
      ) : null}

      {portrait ? (
        <div className="rk-rotate" role="alert">
          <span className="rk-rotate__icon">⟳</span>
          <p>{t("rummikub.rotate")}</p>
        </div>
      ) : null}

      <RummikubModals
        rulesOpen={rulesOpen}
        settingsOpen={settingsOpen}
        onRules={() => setRulesOpen(false)}
        onSettings={() => setSettingsOpen(false)}
        t={t}
      />
    </main>
  );
};

// insertion index in a meld from the pointer x position
const computeInsertIndex = (meldEl: HTMLElement, clientX: number): number => {
  const tiles = Array.from(meldEl.querySelectorAll(".rk-tilebtn"));
  for (let i = 0; i < tiles.length; i += 1) {
    const rect = tiles[i]!.getBoundingClientRect();
    if (clientX < rect.left + rect.width / 2) return i;
  }
  return tiles.length;
};

const RummikubModals = ({
  rulesOpen,
  settingsOpen,
  onRules,
  onSettings,
  t,
}: {
  rulesOpen: boolean;
  settingsOpen: boolean;
  onRules: () => void;
  onSettings: () => void;
  t: ReturnType<typeof useT>;
}) => (
  <>
    <SettingsModal open={settingsOpen} onClose={onSettings} />
    <RulesModal
      open={rulesOpen}
      onClose={onRules}
      title={t("rummikub.rules.title")}
      paragraphs={[
        t("rummikub.rules.p1"),
        t("rummikub.rules.p2"),
        t("rummikub.rules.p3"),
        t("rummikub.rules.p4"),
        t("rummikub.rules.p5"),
        t("rummikub.rules.p6"),
      ]}
    />
  </>
);
