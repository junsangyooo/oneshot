import { useEffect, useRef, useState } from "react";
import type { PartyRoomState, RummikubPrivateState, RummikubPublicState, Tile, TileColor } from "@oneshot/shared";
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
  jokerInfo,
  place,
  playedTileIds,
  stageFromServer,
  toCommitPayload,
  type DropTarget,
  type JokerInfo,
  type Stage,
} from "./staging";
import { grabChain, sort777, sort789 } from "./tileSort";

type Props = { roomState: PartyRoomState; privateState: unknown; currentPlayerId: string | null };

const fill = (s: string, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

const turnLabel = (secs: number, t: ReturnType<typeof useT>): string =>
  secs === 0 ? t("rummikub.setup.unlimited") : `${secs}${t("rummikub.setup.sec")}`;

// ---------------------------- tile face ----------------------------

const TileFace = ({ tile, cls, joker }: { tile: Tile; cls?: string; joker?: JokerInfo }) => {
  if (tile.kind === "joker") {
    return (
      <span className={`rk-tile rk-tile--joker ${cls ?? ""}`}>
        <span className="rk-tile__joker">☺</span>
        {joker ? (
          <b className={`rk-tile__jokerval ${joker.color ? `rk-tile--${joker.color}` : ""}`}>{joker.num}</b>
        ) : null}
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

// The grab is progressive: hold this long and the tile next to the pressed one
// joins it, then one more every GRAB_STEP_MS. Start dragging and it stops
// where it is — how long you hold is how much you pick up.
const GRAB_FIRST_MS = 1000;
const GRAB_STEP_MS = 500;

// ---------------------------- orientation ----------------------------

// The rotate prompt is for phones held upright — never for a desktop window that
// simply happens to be taller than it is wide (there is nothing to rotate there,
// and the old orientation-only check walled those users out of the game).
// Requires a coarse pointer AND portrait AND a phone-sized width.
const ROTATE_MAX_WIDTH = 720;
const useNeedsRotate = (): boolean => {
  const query = `(orientation: portrait) and (pointer: coarse) and (max-width: ${ROTATE_MAX_WIDTH}px)`;
  const [needs, setNeeds] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setNeeds(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return needs;
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
  const needsRotate = useNeedsRotate();
  const [rotateDismissed, setRotateDismissed] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"none" | "777" | "789">("none");
  const [sel, setSel] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>(() => stageFromServer(pub?.board ?? [], me?.hand ?? []));
  const [glowMelds, setGlowMelds] = useState<string[]>([]);
  // Tiles currently being dragged — kept in state (not just a ref) so their
  // origin slot can render a translucent placeholder while they travel.
  const [dragIds, setDragIds] = useState<string[]>([]);
  // The drop zone under the pointer, and whether dropping there is legal.
  const [hover, setHover] = useState<{ key: string; ok: boolean } | null>(null);
  // The tile under the finger right now. Purely visual, and set on pointerdown
  // so a press reacts instantly instead of looking dead until the grab fires.
  const [pressedId, setPressedId] = useState<string | null>(null);
  // Transient "that move isn't allowed" flash on a meld.
  const [denyMeld, setDenyMeld] = useState<string | null>(null);
  // Why the player can't touch the board yet (shown once they try).
  const [lockHint, setLockHint] = useState(false);

  const sendAction = (type: string, payload?: unknown) =>
    send({ type: "game:action", action: { type, payload, clientActionId: crypto.randomUUID() } });

  const isMyTurn = pub?.phase === "play" && pub.currentTurnPlayerId === currentPlayerId;
  const meState = pub?.players.find((p) => p.playerId === currentPlayerId);
  const didInitial = meState?.hasDoneInitialMeld ?? false;

  // Resync the working copy whenever the server's authoritative view for THIS
  // player changes — deal, my commit's turn-advance, an opponent's commit, a
  // draw, AND the private hand arriving a beat after the public state on game
  // start (it lands via a separate game:privateState event). Keyed on a
  // signature of my hand + the board + the turn so a late hand still populates.
  // We never clobber in-progress staged plays on my own turn.
  const turnNumber = pub?.turnNumber ?? 0;
  const serverSig =
    `${turnNumber}|${pub?.phase}|${(me?.hand ?? []).map((t) => t.id).join(",")}` +
    `|${(pub?.board ?? []).map((m) => m.tiles.map((t) => t.id).join("-")).join("_")}`;
  useEffect(() => {
    setStage((prev) => {
      const midEdit = playedTileIds(prev).length > 0 && pub?.currentTurnPlayerId === currentPlayerId;
      return midEdit ? prev : stageFromServer(pub?.board ?? [], me?.hand ?? []);
    });
    setSel([]);
    setDragIds([]);
    setHover(null);
    setLockHint(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSig]);

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

  // Ticks for every seat, not just the active one — spectators need to feel the
  // clock too, and it makes a stalled turn obvious.
  const timeLeft = useCountdown(pub?.turnDeadline);
  // Fire a validated timeout when the deadline passes. ANY seated client arms it
  // (not just the current player) so a backgrounded/closed active tab can't stall
  // the game — the server re-checks the clock and dedupes by turnNumber, so
  // simultaneous fires are harmless. Non-current tabs wait a beat longer to let
  // the current player's own tab win the race in the common case.
  const amSeatedNow = currentPlayerId != null && (pub?.players.some((p) => p.playerId === currentPlayerId) ?? false);
  useEffect(() => {
    if (!pub || pub.phase !== "play" || pub.turnDeadline == null || !amSeatedNow) return;
    const ms = pub.turnDeadline - Date.now();
    const grace = pub.currentTurnPlayerId === currentPlayerId ? 250 : 1500;
    const timer = setTimeout(
      () => sendAction(RUMMIKUB_ACTIONS.timeout, { turnNumber: pub.turnNumber }),
      Math.max(0, ms) + grace,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub?.turnDeadline, pub?.currentTurnPlayerId, pub?.turnNumber, amSeatedNow]);

  // ---- drag state ----
  // `origin` is where the drag started, so a cancelled or illegal drop can send
  // the tiles visibly back to the slot they came from instead of just vanishing.
  const dragRef = useRef<{ ids: string[]; origin: { x: number; y: number } } | null>(null);
  const pressRef = useRef<{
    id: string;
    x: number;
    y: number;
    timer: number | null;
    from: "hand" | "board";
    autoSelected: boolean; // the long-press already picked a set — don't toggle on release
  } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; tiles: Tile[]; snapping?: boolean } | null>(null);

  // Escape (or the browser stealing the pointer, e.g. the rack scrolling under a
  // swipe) cancels the drag and flies the tiles home. Refs, so no stale closure.
  useEffect(() => {
    const cancel = () => {
      // Always kill a pending grab step, or it fires after the gesture is gone.
      if (pressRef.current?.timer) window.clearTimeout(pressRef.current.timer);
      const drag = dragRef.current;
      if (!drag) {
        pressRef.current = null;
        setPressedId(null);
        return;
      }
      dragRef.current = null;
      pressRef.current = null;
      setDragIds([]);
      setHover(null);
      setPressedId(null);
      setGhost((g) => (g ? { ...g, x: drag.origin.x, y: drag.origin.y, snapping: true } : null));
      window.setTimeout(() => setGhost(null), 220);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

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

  const canDrop = (ids: string[], target: DropTarget): boolean =>
    place(stage, ids, target, canManip) !== null;

  const applyPlace = (ids: string[], target: DropTarget): boolean => {
    const next = place(stage, ids, target, canManip);
    if (!next) return false;
    setStage(next);
    setSel([]);
    return true;
  };

  const flashDeny = (meldId?: string) => {
    setDenyMeld(meldId ?? null);
    window.setTimeout(() => setDenyMeld(null), 400);
  };

  // Trying to touch the board before your initial meld used to be a silent
  // no-op; surface the reason instead.
  const refuseBoard = (): boolean => {
    if (canManip) return false;
    setLockHint(true);
    window.setTimeout(() => setLockHint(false), 2200);
    return true;
  };

  const toggleSel = (id: string, from: "hand" | "board") => {
    if (from === "board" && refuseBoard()) return;
    setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  // Single refresh: throw away everything staged this turn and start over.
  const resetAll = () => {
    setStage(stageFromServer(pub.board, me?.hand ?? []));
    setSel([]);
  };

  // Fly the ghost back to where the drag started, then clear it.
  const snapBack = (origin: { x: number; y: number }) => {
    setGhost((g) => (g ? { ...g, x: origin.x, y: origin.y, snapping: true } : null));
    window.setTimeout(() => setGhost(null), 220);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragIds([]);
    setHover(null);
    setPressedId(null);
  };

  // Resolve the drop zone under a point into a target + a stable hover key.
  const zoneAt = (x: number, y: number): { target: DropTarget; key: string } | null => {
    const el = document.elementFromPoint(x, y);
    const zone = el?.closest("[data-drop]") as HTMLElement | null;
    if (!zone) return null;
    const kind = zone.dataset.drop;
    if (kind === "new") return { target: { zone: "new" }, key: "new" };
    if (kind === "hand") return { target: { zone: "hand" }, key: "hand" };
    if (kind === "meld") {
      const meldId = zone.dataset.meldId!;
      return { target: { zone: "meld", meldId, index: computeInsertIndex(zone, x) }, key: `meld:${meldId}` };
    }
    return null;
  };

  // ---- pointer handlers (tap-select + long-press + drag) ----
  const onTilePointerDown = (e: React.PointerEvent, id: string, from: "hand" | "board") => {
    if (!isMyTurn) return;
    if (from === "board" && refuseBoard()) return;
    setPressedId(id); // instant feedback, before the grab timer even starts
    // Walk the chain rightwards from the pressed tile, one tile per step, until
    // the player drags (which freezes it) or lets go (which drops it all).
    const chain = from === "hand" ? grabChain(sortedHand, id) : [id];
    let take = Math.min(2, chain.length); // first step picks up the neighbour
    const step = () => {
      setSel(chain.slice(0, take));
      // Mark it instead of dropping the press: pointerup must know the grab
      // already ran, or it would toggle this very tile back off.
      if (pressRef.current) {
        pressRef.current.autoSelected = true;
        pressRef.current.timer =
          take < chain.length ? window.setTimeout(step, GRAB_STEP_MS) : null;
      }
      take += 1;
    };
    const timer = from === "hand" ? window.setTimeout(step, GRAB_FIRST_MS) : null;
    pressRef.current = { id, x: e.clientX, y: e.clientY, timer, from, autoSelected: false };
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
      dragRef.current = { ids, origin: { x: press.x, y: press.y } };
      setDragIds(ids);
    }
    const drag = dragRef.current;
    if (drag) {
      const tiles = drag.ids.map(tileById).filter(Boolean) as Tile[];
      setGhost({ x: e.clientX, y: e.clientY, tiles });
      const zone = zoneAt(e.clientX, e.clientY);
      setHover(zone ? { key: zone.key, ok: canDrop(drag.ids, zone.target) } : null);
    }
  };

  const onTilePointerUp = (e: React.PointerEvent, id: string, from: "hand" | "board") => {
    const press = pressRef.current;
    if (press?.timer) window.clearTimeout(press.timer);
    pressRef.current = null;
    setPressedId(null);
    const drag = dragRef.current;
    endDrag();

    if (!drag) {
      setGhost(null);
      // Long-press is a GRAB: it lights up the whole set so you can drag it to
      // the field. Letting go without dragging drops the set entirely — you end
      // up holding nothing, not a stray tile or a half-selection.
      if (press?.autoSelected) {
        setSel([]);
        return;
      }
      // Tap-to-place: with tiles picked, tapping another set drops them there,
      // so a touch-only player never has to drag.
      if (from === "board" && sel.length > 0 && !sel.includes(id)) {
        if (refuseBoard()) return;
        const zone = zoneAt(e.clientX, e.clientY);
        if (zone && applyPlace(sel, zone.target)) return;
        flashDeny((e.target as HTMLElement).closest("[data-meld-id]")?.getAttribute("data-meld-id") ?? undefined);
        return;
      }
      toggleSel(id, from);
      return;
    }

    // Drop: anything that isn't a legal landing sends the tiles home.
    const zone = zoneAt(e.clientX, e.clientY);
    if (!zone || !applyPlace(drag.ids, zone.target)) {
      if (zone) flashDeny(zone.key.startsWith("meld:") ? zone.key.slice(5) : undefined);
      snapBack(drag.origin);
      return;
    }
    setGhost(null);
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
  const currentPlayer = pub.currentTurnPlayerId ? roomState.players[pub.currentTurnPlayerId] : undefined;
  // Fraction of the turn clock still left, for the draining bar.
  const turnFraction = pub.turnSeconds > 0 ? Math.min(1, timeLeft / pub.turnSeconds) : 1;
  const timePressure = pub.turnDeadline != null && timeLeft <= 10;
  const boardTileCount = stage.board.reduce((s, m) => s + m.tiles.length, 0);
  const zoom = boardTileCount > 66 ? 0.6 : boardTileCount > 46 ? 0.72 : boardTileCount > 28 ? 0.85 : 1;
  const currentDisconnected =
    pub.currentTurnPlayerId != null && !pub.players.find((p) => p.playerId === pub.currentTurnPlayerId)?.connected;

  return (
    <main className={`scr scr--rummikub ${isMyTurn ? "is-myturn" : ""}`}>
      <Backdrop />

      <header className="topbar rk-topbar">
        <GameRail seats={railSeats} players={roomState.players} nameOf={nameOf} />
        {/* whose turn it is, at a glance: their face, their name, and the clock
            ticking down for EVERYONE (not just the active player) */}
        <div className={`rk-turn ${isMyTurn ? "is-mine" : ""} ${timePressure ? "is-urgent" : ""}`} aria-live="polite">
          <AvatarImg
            avatarKey={currentPlayer?.avatarKey}
            themeId={currentPlayer?.themeId}
          />
          <span className="rk-turn__who">
            <span className="rk-turn__name">{isMyTurn ? t("rummikub.turnMine") : currentName}</span>
            <span className="rk-turn__sub">
              {isMyTurn ? t("rummikub.turnMineSub") : t("rummikub.turnTheirs")}
            </span>
          </span>
          {pub.turnDeadline != null ? (
            <span className="rk-turn__clock">
              <b className="rk-turn__timer">{timeLeft}</b>
              <i
                className="rk-turn__bar"
                style={{ ["--rk-left" as string]: `${turnFraction * 100}%` }}
              />
            </span>
          ) : null}
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

      {/* board (the "field"), with the staging tools floating over its lower edge */}
      <section className="rk-field">
      <div className="rk-board" style={{ ["--rk-zoom" as string]: String(zoom) }}>
        <div className="rk-board__inner">
          {stage.board.map((m) => {
            const jokers = jokerInfo(m.tiles);
            return (
              <div
                key={m.id}
                data-drop="meld"
                data-meld-id={m.id}
                className={[
                  "rk-meld",
                  invalidIds.has(m.id) ? "is-invalid" : "",
                  glowMelds.includes(m.id) ? "is-glow" : "",
                  hover?.key === `meld:${m.id}` ? (hover.ok ? "is-dropover" : "is-dropdeny") : "",
                  denyMeld === m.id ? "is-deny" : "",
                  // With tiles picked up, every set is a tap target.
                  sel.length > 0 && dragIds.length === 0 && canManip ? "is-droppable" : "",
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
                    <TileFace
                      tile={tile}
                      joker={jokers[tile.id]}
                      cls={[
                        sel.includes(tile.id) ? "is-sel" : "",
                        dragIds.includes(tile.id) ? "is-dragging" : "",
                        pressedId === tile.id ? "is-press" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  </button>
                ))}
              </div>
            );
          })}
          {isMyTurn ? (
            // Drop target for dragging, and also tappable: with tiles picked it
            // lays them down as a new set, so a touch-only player is never stuck.
            <button
              type="button"
              data-drop="new"
              aria-label={t("rummikub.dropHere")}
              className={[
                "rk-meld rk-meld--new",
                hover?.key === "new" ? (hover.ok ? "is-dropover" : "is-dropdeny") : "",
                sel.length > 0 ? "is-droppable" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                if (sel.length > 0) applyPlace(sel, { zone: "new" });
              }}
            >
              <span className="rk-meld--new__hint">＋</span>
              <span className="rk-meld--new__label">{t("rummikub.dropHere")}</span>
            </button>
          ) : null}
          {stage.board.length === 0 ? (
            <div className="rk-board__empty">
              {isMyTurn ? t("rummikub.emptyBoardMine") : t("rummikub.emptyBoard")}
            </div>
          ) : null}
        </div>
      </div>

        <div className="rk-fieldtools">
          <button
            type="button"
            className="btn btn--sm rk-fieldtools__reset"
            aria-label={t("rummikub.reset")}
            title={t("rummikub.reset")}
            disabled={!isMyTurn || played.length === 0}
            onClick={resetAll}
          >
            <span aria-hidden>↺</span>
          </button>
        </div>
      </section>

      {/* my area */}
      <section className="rk-me">
        <div className="rk-me__bar">
          <span className="rk-me__who">
            {didInitial ? null : <span className="rk-me__need">{t("rummikub.needInitial")}</span>}
          </span>
          <div className="rk-sorts">
            <button
              type="button"
              aria-pressed={sortMode === "777"}
              className={`btn btn--sm ${sortMode === "777" ? "btn--primary" : ""}`}
              onClick={() => setSortMode((m) => (m === "777" ? "none" : "777"))}
            >
              <span>777</span>
            </button>
            <button
              type="button"
              aria-pressed={sortMode === "789"}
              className={`btn btn--sm ${sortMode === "789" ? "btn--primary" : ""}`}
              onClick={() => setSortMode((m) => (m === "789" ? "none" : "789"))}
            >
              <span>789</span>
            </button>
          </div>
        </div>

        <div
          data-drop="hand"
          className={[
            "rk-rack",
            hover?.key === "hand" ? (hover.ok ? "is-dropover" : "is-dropdeny") : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {sortedHand.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className="rk-tilebtn rk-tilebtn--hand"
              onPointerDown={(e) => onTilePointerDown(e, tile.id, "hand")}
              onPointerMove={onTilePointerMove}
              onPointerUp={(e) => onTilePointerUp(e, tile.id, "hand")}
            >
              <TileFace
                tile={tile}
                cls={[
                  sel.includes(tile.id) ? "is-sel" : "",
                  dragIds.includes(tile.id) ? "is-dragging" : "",
                  pressedId === tile.id ? "is-press" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </button>
          ))}
          {sortedHand.length === 0 ? <span className="rk-rack__empty">—</span> : null}
        </div>

        {/* why you can (or can't) end the turn — the old UI just greyed the
            button out, which reads as "broken" to anyone new */}
        <p className={`rk-coach ${lockHint ? "is-warn" : ""}`} role="status">
          {lockHint
            ? t("rummikub.lockedBoard")
            : !isMyTurn
              ? t("rummikub.waitTurn")
              : commit.ok
                ? t("rummikub.readyEnd")
                : commit.reason === "invalidMeld"
                  ? t("rummikub.whyInvalid")
                  : commit.reason === "initialLow"
                    ? fill(t("rummikub.whyInitialLow"), { n: commit.points ?? 0 })
                    : t("rummikub.whyEmpty")}
        </p>

        {/* action bar */}
        <div className="rk-actions">
          {/* draw = take one from the deck; drawn as a card stack with a +, so it
              reads as an action on the pile rather than a word to parse */}
          <button
            type="button"
            className="rk-draw"
            aria-label={`${t("rummikub.draw")} — ${t("rummikub.drawSub")}`}
            title={t("rummikub.drawSub")}
            disabled={!isMyTurn}
            onClick={() => {
              // Drawing means "I'm playing nothing this turn": throw away whatever
              // was staged, take one tile, turn over.
              resetAll();
              sendAction(RUMMIKUB_ACTIONS.draw);
            }}
          >
            <span className="rk-deck" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="rk-draw__plus" aria-hidden>
              ＋
            </span>
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
        <div
          className={`rk-ghost ${ghost.snapping ? "is-snap" : ""} ${hover && !hover.ok ? "is-deny" : ""}`}
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.tiles.slice(0, 6).map((tile, i) => (
            <TileFace key={tile.id + i} tile={tile} />
          ))}
        </div>
      ) : null}

      {needsRotate && !rotateDismissed ? (
        <div className="rk-rotate" role="alert">
          <span className="rk-rotate__icon">⟳</span>
          <p>{t("rummikub.rotate")}</p>
          <button type="button" className="btn btn--sm" onClick={() => setRotateDismissed(true)}>
            <span>{t("rummikub.rotateContinue")}</span>
          </button>
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

// Rules examples drawn with the real tile faces — "same number, different
// colours" is far easier to see than to read, especially for a first-timer.
const ex = (color: TileColor, num: number, i: number): Tile => ({
  id: `ex-${color}-${num}-${i}`,
  kind: "num",
  color,
  num,
});

const RulesExample = ({ label, tiles }: { label: string; tiles: Tile[] }) => (
  <div className="rk-ex">
    <span className="rk-ex__label">{label}</span>
    <span className="rk-ex__tiles">
      {tiles.map((tile) => (
        <TileFace key={tile.id} tile={tile} />
      ))}
    </span>
  </div>
);

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
        <RulesExample
          key="ex-group"
          label={t("rummikub.rules.exGroup")}
          tiles={[ex("red", 7, 0), ex("blue", 7, 1), ex("black", 7, 2)]}
        />,
        <RulesExample
          key="ex-run"
          label={t("rummikub.rules.exRun")}
          tiles={[ex("orange", 5, 0), ex("orange", 6, 1), ex("orange", 7, 2)]}
        />,
        t("rummikub.rules.p3"),
        t("rummikub.rules.p4"),
        t("rummikub.rules.p5"),
        t("rummikub.rules.p6"),
        t("rummikub.rules.p7"),
      ]}
    />
  </>
);
