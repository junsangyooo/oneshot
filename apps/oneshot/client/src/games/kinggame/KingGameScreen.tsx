import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  KingCustomEntry,
  KingGameMode,
  KingGamePrivateState,
  KingGamePublicState,
  KingMission,
  PartyRoomState,
  PublicPlayerState,
} from "@oneshot/shared";
import {
  KING_ACTIONS,
  KING_CUSTOM_POOL_MAX,
  KING_CUSTOM_TEXT_MAX,
  KING_CUSTOM_TEXT_MIN,
  KING_REVEAL_DELAY_MS,
  missionById,
  missionsBySpice,
  parseMissionTemplate,
  renderMission,
} from "@oneshot/shared";
import { useRoomStore } from "../../app/useRoomStore";
import { useT, useLangStore } from "../../i18n";
import type { Lang } from "../../i18n";
import { Backdrop, AvatarImg, SettingsModal, RulesModal, ConfirmModal } from "../../ui/terminal";

type KingGameScreenProps = {
  roomState: PartyRoomState;
  privateState: unknown;
  currentPlayerId: string | null;
};

const MODES: KingGameMode[] = ["free", "mild", "spicy", "custom"];

const numLabel = (n: number, lang: Lang): string => (lang === "ko" ? `${n}번` : `#${n}`);

const emptySlots = (count: number): (number | null)[] =>
  Array.from({ length: count }, () => null);

const missionTemplate = (
  lang: Lang,
  missionId: string | undefined,
  missionRaw: string | undefined,
): string => {
  if (missionRaw != null) return missionRaw;
  const preset = missionId != null ? missionById(missionId) : undefined;
  return preset ? preset[lang] : "";
};

export const KingGameScreen = ({ roomState, privateState, currentPlayerId }: KingGameScreenProps) => {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const send = useRoomStore((state) => state.send);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const pub = roomState.activeGame?.publicState as KingGamePublicState | undefined;
  const me = privateState as KingGamePrivateState | null;
  const myPlayer = currentPlayerId ? roomState.players[currentPlayerId] : null;
  const isHost = myPlayer?.isHost ?? false;
  const isKing = me?.role === "king";

  const sendAction = (type: string, payload?: unknown) =>
    send({ type: "game:action", action: { type, payload, clientActionId: crypto.randomUUID() } });

  if (!pub) {
    return (
      <main className="scr scr--king">
        <Backdrop />
        <div className="king-loading">{t("king.loading")}</div>
      </main>
    );
  }

  const king = pub.kingPlayerId ? (roomState.players[pub.kingPlayerId] ?? null) : null;

  return (
    <main className="scr scr--king">
      <Backdrop />

      <header className="topbar">
        <div className="readout">
          <div>BR-K/S/61X-081</div>
          <div>
            SECTOR_ID: <span className="hot">#{roomState.roomCode}</span>
          </div>
          <div>MODE: {(pub.mode ?? "—").toUpperCase()}</div>
        </div>
        <div className="king-round">
          <span className="lbl">{t("king.round")}</span>
          <span className="val">{String(pub.round).padStart(2, "0")}</span>
        </div>
        <div className="king-toolbar">
          <button className="btn btn--sm" type="button" aria-label={t("rules.help")} onClick={() => setRulesOpen(true)}>
            <span>?</span>
          </button>
          <button className="btn btn--sm" type="button" aria-label={t("settings.title")} onClick={() => setSettingsOpen(true)}>
            <span>⚙</span>
          </button>
          {isHost && pub.phase !== "setup" ? (
            <button
              className="btn btn--sm btn--danger"
              type="button"
              onClick={() => setEndOpen(true)}
            >
              <span>⏻ {t("king.endGame")}</span>
            </button>
          ) : null}
        </div>
      </header>

      <section className="king-stage">
        {pub.phase === "setup" ? (
          <SetupView isHost={isHost} lang={lang} onConfigure={(p) => sendAction(KING_ACTIONS.configure, p)} />
        ) : pub.phase === "command" ? (
          <CommandView
            pub={pub}
            me={me}
            king={king}
            isKing={isKing}
            lang={lang}
            onReveal={(targetNumbers) => sendAction(KING_ACTIONS.reveal, { targetNumbers })}
            onNextTurn={() => sendAction(KING_ACTIONS.nextTurn)}
          />
        ) : (
          <RevealView
            pub={pub}
            me={me}
            roomState={roomState}
            isKing={isKing}
            lang={lang}
            onNextTurn={() => sendAction(KING_ACTIONS.nextTurn)}
          />
        )}
      </section>

      <footer className="botbar">
        <div className="readout">PROTOCOL_KINGGAME // ROUND {String(pub.round).padStart(2, "0")}</div>
        <div className="mid">THE KING&apos;S WORD IS LAW</div>
        <div className="readout readout--r">{(pub.mode ?? "STANDBY").toString().toUpperCase()}</div>
      </footer>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title={t("king.rules.title")}
        paragraphs={[t("king.rules.p1"), t("king.rules.p2"), t("king.rules.p3"), t("king.rules.p4"), t("king.rules.p5")]}
      />
      <ConfirmModal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={() => sendAction(KING_ACTIONS.endGame)}
        title={t("endgame.title")}
        body={t("endgame.body")}
        confirmLabel={t("endgame.confirm")}
        cancelLabel={t("endgame.cancel")}
      />
    </main>
  );
};

/* ============================ SETUP ============================ */

const SetupView = ({
  isHost,
  lang,
  onConfigure,
}: {
  isHost: boolean;
  lang: Lang;
  onConfigure: (payload: { mode: KingGameMode; customMissions?: KingCustomEntry[] }) => void;
}) => {
  const t = useT();
  const [mode, setMode] = useState<KingGameMode | null>(null);
  const [pool, setPool] = useState<KingCustomEntry[]>([]);

  if (!isHost) {
    return (
      <div className="king-wait">
        <div className="king-wait__pulse">♚</div>
        <p>{t("king.setup.waitingHost")}</p>
      </div>
    );
  }

  const canStart = mode != null && (mode !== "custom" || pool.length > 0);
  const start = () => {
    if (mode == null) return;
    if (mode === "custom") onConfigure({ mode, customMissions: pool });
    else onConfigure({ mode });
  };

  return (
    <div className="king-setup">
      <div className="king-setup__head">
        <h2>{t("king.setup.title")}</h2>
        <span className="panel-label">{t("king.setup.chooseMode")}</span>
      </div>

      <div className="king-mode-grid">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={`king-mode ${mode === m ? "is-selected" : ""} ${m === "spicy" ? "is-spicy" : ""}`}
            onClick={() => setMode(m)}
          >
            <span className="king-mode__name">{t(`king.mode.${m}`)}</span>
            <span className="king-mode__desc">{t(`king.mode.${m}.desc`)}</span>
          </button>
        ))}
      </div>

      {mode === "custom" ? <CustomBuilder lang={lang} pool={pool} onChange={setPool} /> : null}

      <button className="btn btn--primary btn--init" type="button" disabled={!canStart} onClick={start}>
        <span>{t("king.setup.start")}</span>
        <span>→</span>
      </button>
    </div>
  );
};

const CustomBuilder = ({
  lang,
  pool,
  onChange,
}: {
  lang: Lang;
  pool: KingCustomEntry[];
  onChange: (next: KingCustomEntry[]) => void;
}) => {
  const t = useT();
  const [text, setText] = useState("");
  const [slots, setSlots] = useState<1 | 2>(1);

  const mild = useMemo(() => missionsBySpice("mild"), []);
  const spicy = useMemo(() => missionsBySpice("spicy"), []);

  const presetIds = new Set(
    pool.filter((e) => e.kind === "preset").map((e) => (e as { missionId: string }).missionId),
  );
  const atMax = pool.length >= KING_CUSTOM_POOL_MAX;

  const togglePreset = (mission: KingMission) => {
    if (presetIds.has(mission.id)) {
      onChange(pool.filter((e) => !(e.kind === "preset" && e.missionId === mission.id)));
    } else if (!atMax) {
      onChange([...pool, { kind: "preset", missionId: mission.id }]);
    }
  };

  const addOwn = () => {
    const trimmed = text.trim();
    if (trimmed.length < KING_CUSTOM_TEXT_MIN || trimmed.length > KING_CUSTOM_TEXT_MAX || atMax) return;
    onChange([...pool, { kind: "custom", text: trimmed, slots }]);
    setText("");
  };

  const removeAt = (index: number) => onChange(pool.filter((_, i) => i !== index));

  const presetChip = (mission: KingMission) => (
    <button
      key={mission.id}
      type="button"
      className={`king-chip ${presetIds.has(mission.id) ? "is-on" : ""}`}
      onClick={() => togglePreset(mission)}
    >
      <span className="king-chip__slots">{mission.slots === 2 ? "②" : "①"}</span>
      <span>{mission[lang]}</span>
    </button>
  );

  return (
    <div className="king-custom">
      <div className="king-custom__col">
        <span className="panel-label">{t("king.custom.presetsMild")}</span>
        <div className="king-chips">{mild.map(presetChip)}</div>
        <span className="panel-label">{t("king.custom.presetsSpicy")}</span>
        <div className="king-chips">{spicy.map(presetChip)}</div>
      </div>

      <div className="king-custom__col">
        <span className="panel-label">{t("king.custom.addOwn")}</span>
        <div className="king-custom__add">
          <input
            type="text"
            maxLength={KING_CUSTOM_TEXT_MAX}
            value={text}
            placeholder={t("king.custom.placeholder")}
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addOwn();
            }}
          />
          <div className="king-custom__row">
            <div className="king-seg">
              <button
                type="button"
                className={slots === 1 ? "on" : ""}
                onClick={() => setSlots(1)}
              >
                {t("king.custom.target1")}
              </button>
              <button
                type="button"
                className={slots === 2 ? "on" : ""}
                onClick={() => setSlots(2)}
              >
                {t("king.custom.target2")}
              </button>
            </div>
            <button className="btn btn--sm btn--primary" type="button" onClick={addOwn}>
              <span>+ {t("king.custom.add")}</span>
            </button>
          </div>
        </div>

        <span className="panel-label">
          {t("king.custom.pool")} ({pool.length})
        </span>
        <div className="king-pool">
          {pool.length === 0 ? (
            <p className="king-pool__empty">{t("king.custom.empty")}</p>
          ) : (
            pool.map((entry, index) => {
              const label =
                entry.kind === "preset"
                  ? (missionById(entry.missionId)?.[lang] ?? entry.missionId)
                  : entry.text;
              const slotMark =
                entry.kind === "preset"
                  ? (missionById(entry.missionId)?.slots ?? 1) === 2
                    ? "②"
                    : "①"
                  : entry.slots === 2
                    ? "②"
                    : "①";
              return (
                <div className="king-pool__item" key={`${entry.kind}-${index}`}>
                  <span className="king-chip__slots">{slotMark}</span>
                  <span className="king-pool__text">{label}</span>
                  <button
                    type="button"
                    className="king-pool__x"
                    title={t("king.custom.remove")}
                    onClick={() => removeAt(index)}
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================ COMMAND ============================ */

const CommandView = ({
  pub,
  me,
  king,
  isKing,
  lang,
  onReveal,
  onNextTurn,
}: {
  pub: KingGamePublicState;
  me: KingGamePrivateState | null;
  king: PublicPlayerState | null;
  isKing: boolean;
  lang: Lang;
  onReveal: (targetNumbers: number[]) => void;
  onNextTurn: () => void;
}) => {
  const t = useT();
  const isFree = pub.mode === "free";

  // King's view
  if (isKing) {
    if (isFree) {
      return (
        <div className="king-command king-command--free">
          <KingCard />
          <p className="king-hint">{t("king.command.freeKing")}</p>
          <button className="btn btn--primary btn--init" type="button" onClick={onNextTurn}>
            <span>{t("king.command.nextTurn")}</span>
            <span>↻</span>
          </button>
        </div>
      );
    }
    return (
      <KingComposer pub={pub} me={me} lang={lang} onReveal={onReveal} />
    );
  }

  // Subject's view: their own number card + waiting
  return (
    <div className="king-command king-command--subject">
      <NumberCard number={me?.number ?? null} />
      <p className="king-hint">
        {isFree ? null : t("king.command.waitingKing")}
        {isFree && king ? `${king.nickname}${t("king.command.kingSuffix")}` : null}
      </p>
    </div>
  );
};

const KingComposer = ({
  pub,
  me,
  lang,
  onReveal,
}: {
  pub: KingGamePublicState;
  me: KingGamePrivateState | null;
  lang: Lang;
  onReveal: (targetNumbers: number[]) => void;
}) => {
  const t = useT();
  const pending = me?.pendingMission ?? null;
  const slots = pending?.slots ?? 1;
  const numbers = pub.availableNumbers;

  const [assigned, setAssigned] = useState<(number | null)[]>(() => emptySlots(slots));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ number: number; x: number; y: number } | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const startRef = useRef<{ x: number; y: number; moved: boolean }>({ x: 0, y: 0, moved: false });

  // reset whenever the rolled mission / slot count changes (new turn)
  useEffect(() => {
    setAssigned(emptySlots(slots));
    setActiveSlot(null);
  }, [pending?.missionId, pending?.missionRaw, slots]);

  // If the browser steals the gesture (pointercancel) or the player hits
  // Escape, the drag ghost must not stay stranded on screen (§7-1).
  useEffect(() => {
    const cancel = () => {
      setDrag(null);
      setHoverSlot(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!pending) {
    return <div className="king-wait"><p>{t("king.loading")}</p></div>;
  }

  const usedNumbers = new Set(assigned.filter((n): n is number => n != null));
  const firstEmpty = () => {
    const idx = assigned.findIndex((a) => a == null);
    return idx === -1 ? 0 : idx;
  };
  const assignToSlot = (slot: number, number: number) => {
    setAssigned((prev) => prev.map((a, i) => (i === slot ? number : a === number ? null : a)));
    setActiveSlot(null);
  };
  const clearSlot = (slot: number) =>
    setAssigned((prev) => prev.map((a, i) => (i === slot ? null : a)));

  const onSlotClick = (i: number) => {
    if (assigned[i] != null) clearSlot(i);
    else setActiveSlot((cur) => (cur === i ? null : i));
  };

  const onCardDown = (e: ReactPointerEvent, number: number) => {
    if (usedNumbers.has(number)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY, moved: false };
    setDrag({ number, x: e.clientX, y: e.clientY });
  };
  const onCardMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y) > 6) {
      startRef.current.moved = true;
    }
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const slotEl = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-slot]");
    setHoverSlot(slotEl ? Number(slotEl.getAttribute("data-slot")) : null);
  };
  const onCardUp = (e: ReactPointerEvent, number: number) => {
    if (!drag) return;
    const slotEl = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-slot]");
    if (slotEl) assignToSlot(Number(slotEl.getAttribute("data-slot")), number);
    else if (!startRef.current.moved) assignToSlot(activeSlot ?? firstEmpty(), number);
    setDrag(null);
    setHoverSlot(null);
  };

  const canReveal = assigned.length === slots && assigned.every((a) => a != null);
  const reveal = () => {
    if (canReveal) onReveal(assigned.filter((a): a is number => a != null));
  };

  const template = missionTemplate(lang, pending.missionId, pending.missionRaw);
  const isPreset = pending.missionRaw == null;

  const slotNode = (slotIndex: number) => {
    const value = assigned[slotIndex] ?? null;
    return (
      <span
        key={`slot-${slotIndex}`}
        data-slot={slotIndex}
        className={`king-slot ${value != null ? "is-filled" : ""} ${activeSlot === slotIndex ? "is-active" : ""} ${hoverSlot === slotIndex ? "is-hover" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => onSlotClick(slotIndex)}
        // a span[role=button] gets no synthetic click from Enter/Space — wire it
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSlotClick(slotIndex);
          }
        }}
      >
        {value != null ? numLabel(value, lang) : "____"}
      </span>
    );
  };

  return (
    <div className="king-composer">
      <div className="king-composer__head">
        <span className="glyph glyph--gold">♛</span>
        <span className="panel-label">{t("king.card.kingTitle")}</span>
      </div>

      <div className="king-mission">
        {isPreset ? (
          parseMissionTemplate(template).map((part, i) =>
            part.type === "text" ? (
              <span key={`txt-${i}`}>{part.value}</span>
            ) : (
              slotNode(part.index)
            ),
          )
        ) : (
          <>
            <span className="king-mission__raw">{template}</span>
            <span className="king-mission__targets">
              {Array.from({ length: slots }, (_, i) => slotNode(i))}
            </span>
          </>
        )}
      </div>

      <p className="king-hint">{t("king.command.assign")}</p>
      <p className="king-hint king-hint--dim">{t("king.command.tapHint")}</p>

      <span className="panel-label">{t("king.command.numbers")}</span>
      <div className="king-numbers">
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className={`king-num ${usedNumbers.has(n) ? "is-used" : ""} ${drag?.number === n ? "is-dragging" : ""}`}
            onPointerDown={(e) => onCardDown(e, n)}
            onPointerMove={onCardMove}
            onPointerUp={(e) => onCardUp(e, n)}
            // keyboard path: Enter/Space arrives as a detail-0 click with no
            // pointer events, so mirror the tap-assign here (mouse taps are
            // already handled by pointerup and must not double-assign)
            onClick={(e) => {
              if (e.detail === 0 && !usedNumbers.has(n)) assignToSlot(activeSlot ?? firstEmpty(), n);
            }}
          >
            {numLabel(n, lang)}
          </button>
        ))}
      </div>

      <button className="btn btn--primary btn--init" type="button" disabled={!canReveal} onClick={reveal}>
        <span>{t("king.command.confirm")}</span>
        <span>↥</span>
      </button>

      {drag ? (
        <span className="king-drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {numLabel(drag.number, lang)}
        </span>
      ) : null}
    </div>
  );
};

const KingCard = () => {
  const t = useT();
  return (
    <div className="king-card king-card--king">
      <span className="king-card__crown">♛</span>
      <span className="king-card__title">{t("king.card.kingTitle")}</span>
      <span className="king-card__hint">{t("king.card.kingHint")}</span>
    </div>
  );
};

const NumberCard = ({ number }: { number: number | null }) => {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  return (
    <div className="king-card king-card--number">
      <span className="king-card__eyebrow">{t("king.card.numberTitle")}</span>
      <span className="king-card__num">{number != null ? numLabel(number, lang) : "—"}</span>
      <span className="king-card__hint">{t("king.card.numberHint")}</span>
    </div>
  );
};

/* ============================ REVEAL ============================ */

const RevealView = ({
  pub,
  me,
  roomState,
  isKing,
  lang,
  onNextTurn,
}: {
  pub: KingGamePublicState;
  me: KingGamePrivateState | null;
  roomState: PartyRoomState;
  isKing: boolean;
  lang: Lang;
  onNextTurn: () => void;
}) => {
  const t = useT();
  const command = pub.command;
  const revealAt = command?.revealAt ?? 0;

  // Anchor the 3s window to the client's own clock (skew-proof), keyed on revealAt.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (revealAt) setAnchor(Date.now());
    else setAnchor(null);
  }, [revealAt]);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 150);
    return () => clearInterval(id);
  }, [revealAt]);

  if (!command) {
    return <div className="king-wait"><p>{t("king.loading")}</p></div>;
  }

  // Before the anchor effect runs (first paint), treat the window as full so the
  // prelude shows immediately — never flash the mission for a frame.
  const remaining =
    anchor != null ? Math.max(0, KING_REVEAL_DELAY_MS - (Date.now() - anchor)) : KING_REVEAL_DELAY_MS;
  const missionShown = remaining <= 0;

  const myNumber = me?.number ?? null;
  const targetNumbers = command.targets.map((target) => target.number);
  const amTarget = myNumber != null && targetNumbers.includes(myNumber);

  if (!missionShown) {
    return (
      <div className={`king-prelude ${amTarget ? "is-target" : ""}`}>
        {amTarget ? (
          <>
            <span className="king-prelude__badge">{t("king.reveal.targeted")}</span>
            <span className="king-prelude__num">{myNumber != null ? numLabel(myNumber, lang) : ""}</span>
            <p className="king-prelude__prompt">{t("king.reveal.prompt")}</p>
          </>
        ) : (
          <>
            <span className="king-prelude__dots">···</span>
            <p className="king-prelude__prompt king-prelude__prompt--dim">{t("king.reveal.waiting")}</p>
          </>
        )}
      </div>
    );
  }

  const fills = command.targets.map((target) => numLabel(target.number, lang));
  const template = missionTemplate(lang, command.missionId, command.missionRaw);
  const isPreset = command.missionRaw == null;

  return (
    <div className="king-reveal">
      <span className="panel-label">{t("king.reveal.title")}</span>

      <div className="king-reveal__targets">
        {command.targets.map((target) => {
          const player = roomState.players[target.playerId] ?? null;
          return (
            <div className="king-reveal__target" key={target.number}>
              <AvatarImg avatarKey={player?.avatarKey} themeId={player?.themeId} />
              <span className="king-reveal__num">{numLabel(target.number, lang)}</span>
              <span className="king-reveal__name">{player?.nickname ?? "—"}</span>
            </div>
          );
        })}
      </div>

      <p className="king-reveal__mission">
        {isPreset ? renderMission(template, fills) : template}
      </p>

      {isKing ? (
        <button className="btn btn--primary btn--init" type="button" onClick={onNextTurn}>
          <span>{t("king.reveal.nextTurn")}</span>
          <span>↻</span>
        </button>
      ) : null}
    </div>
  );
};
