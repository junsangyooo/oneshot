import { useCallback, useLayoutEffect, useRef, useState } from "react";

// TILE must never scroll. A tile you have to scroll to is a tile you forget you
// own — and on a phone the scroll gesture fights the drag gesture that plays it.
// So instead of letting a region overflow, we shrink what is inside it until it
// fits, and only fall back to scrolling if even the smallest size overflows
// (clipping would hide game state, which is worse than a scrollbar).

/** Content width of an element, i.e. clientWidth minus its own padding. */
const innerWidth = (el: HTMLElement): number => {
  const cs = getComputedStyle(el);
  return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
};

/** How many wrapped rows the rack's tiles currently occupy. */
const rowCount = (el: HTMLElement): number =>
  new Set([...el.querySelectorAll<HTMLElement>(".rk-tilebtn")].map((tile) => tile.offsetTop)).size;

// 14px still reads as a numbered tile; below that we stop shrinking rather than
// render an unreadable smear (the rack scrolls instead, which never happens on
// a real device — a 106-tile hand is not reachable).
const MIN_HAND_W = 14;

const overflows = (el: HTMLElement): boolean =>
  el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;

/**
 * Step a CSS custom property down until `el` stops overflowing.
 * Returns true when it fit, false when even `min` was not enough.
 */
const fitByVar = (el: HTMLElement, name: string, from: number, min: number, step: number): boolean => {
  let value = from;
  el.style.setProperty(name, String(value));
  // Bounded so a pathological layout can never spin: (from-min)/step + slack.
  for (let guard = 0; guard < 48 && value > min && overflows(el); guard += 1) {
    value = Math.max(min, Number((value - step).toFixed(3)));
    el.style.setProperty(name, String(value));
  }
  return !overflows(el);
};

/**
 * A callback ref plus the node it resolved to. Using a *ref object* here would
 * be a trap: these regions mount late (the board only exists in the play phase,
 * while the seat count is already final during setup), so a `useLayoutEffect`
 * keyed on the data would run once with a null ref and never fire again. A node
 * in state re-runs the effect the moment the element actually appears.
 */
export const useFitTarget = <T extends HTMLElement>(): [T | null, (node: T | null) => void] => {
  const [node, setNode] = useState<T | null>(null);
  return [node, useCallback((next: T | null) => setNode(next), [])];
};

/** Re-run `fit` on mount, on every `deps` change, and whenever layout moves. */
const useFitEffect = (el: HTMLElement | null, fit: (target: HTMLElement) => void, deps: unknown[]): void => {
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useLayoutEffect(() => {
    if (!el) return undefined;
    let scheduled = 0;
    const schedule = () => {
      if (scheduled) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        fitRef.current(el);
      });
    };
    fitRef.current(el);
    // These containers have a FIXED box (the float is positioned, the rack has a
    // fixed height), so watching only the container misses the thing that
    // actually overflows: its content growing — a seat joining, avatar images
    // finishing their load, a meld landing. Watch the content box too.
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    // One post-layout pass catches anything that settled after this frame.
    schedule();
    return () => {
      ro.disconnect();
      if (scheduled) cancelAnimationFrame(scheduled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

/**
 * Size the hand so every tile fits in exactly two rows without scrolling.
 * Shrinks only as far as it has to: a small hand keeps full-size tiles, and a
 * hand that has grown from drawing gets progressively narrower ones.
 */
export const useFitHand = (el: HTMLElement | null, tileCount: number, gap = 4): void => {
  useFitEffect(
    el,
    (el) => {
      // The base (unshrunken) size comes from the responsive CSS var, so the
      // breakpoints stay the single source of truth for "full size".
      const base = parseFloat(getComputedStyle(el).getPropertyValue("--rk-hand-w")) || 46;
      if (tileCount === 0) {
        el.style.removeProperty("--rk-hand-fit");
        return;
      }
      const perRow = Math.ceil(tileCount / 2);
      const available = innerWidth(el) - gap * (perRow - 1);
      // Start from the arithmetic guess, then CORRECT IT AGAINST THE REAL BOX.
      // Borders, sub-pixel rounding and font metrics all nudge the true tile
      // width, and a guess that is one pixel too wide spills a third row.
      let width = Math.max(MIN_HAND_W, Math.min(base, Math.floor(available / perRow)));
      el.style.setProperty("--rk-hand-fit", `${width}px`);
      for (let guard = 0; guard < 64 && width > MIN_HAND_W && (rowCount(el) > 2 || overflows(el)); guard += 1) {
        width -= 1;
        el.style.setProperty("--rk-hand-fit", `${width}px`);
      }
    },
    [el, tileCount, gap],
  );
};

/** Shrink the board's tiles until the whole table fits with no scrolling. */
export const useFitBoard = (el: HTMLElement | null, signature: string): void => {
  useFitEffect(
    el,
    (el) => {
      const fitted = fitByVar(el, "--rk-zoom", 1, 0.36, 0.04);
      el.classList.toggle("is-scroll", !fitted);
    },
    [el, signature],
  );
};

/** Shrink the player rail (portraits, padding, text) until every seat fits. */
export const useFitRail = (el: HTMLElement | null, seatCount: number): void => {
  useFitEffect(
    el,
    (el) => {
      const fitted = fitByVar(el, "--rk-seat-scale", 1, 0.5, 0.05);
      el.classList.toggle("is-scroll", !fitted);
    },
    [el, seatCount],
  );
};
