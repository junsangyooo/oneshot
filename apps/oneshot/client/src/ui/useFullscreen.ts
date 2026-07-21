import { useEffect, useState } from "react";
import { create } from "zustand";

// Fullscreen, so a game isn't framed by browser chrome (address bar, tab strip,
// OS status bar) on a phone held sideways.
//
// Two hard browser facts shape this:
//  1. requestFullscreen() only resolves inside a user gesture. "Auto fullscreen
//     on entering the game" therefore cannot fire on mount — we try anyway (it
//     works when the phase change itself came from a click) and, if the promise
//     rejects, arm a ONE-SHOT pointerdown listener so the player's very next
//     touch takes us fullscreen.
//  2. iOS Safari on iPhone has no element fullscreen API at all. `supported`
//     is false there and callers hide the control instead of offering a dead
//     button (CLAUDE.md §3-12).

const doc = (): Document | null => (typeof document === "undefined" ? null : document);

export const fullscreenSupported = (): boolean => {
  const d = doc();
  return !!d?.documentElement.requestFullscreen && !!d.exitFullscreen;
};

export const isFullscreen = (): boolean => doc()?.fullscreenElement != null;

export const enterFullscreen = async (): Promise<boolean> => {
  const d = doc();
  if (!d || !fullscreenSupported() || d.fullscreenElement) return false;
  try {
    await d.documentElement.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false; // no user gesture yet, or the user/OS refused
  }
};

export const exitFullscreen = async (): Promise<void> => {
  const d = doc();
  if (!d || !d.fullscreenElement) return;
  try {
    await d.exitFullscreen();
  } catch {
    /* already gone */
  }
};

/* Player preference: "go fullscreen when a game starts". On by default, and
   persisted so turning it off sticks across sessions. */
const PREF_KEY = "oneshot.fullscreen";

type FullscreenPrefStore = { auto: boolean; setAuto: (auto: boolean) => void };

export const useFullscreenPref = create<FullscreenPrefStore>((set) => ({
  auto: globalThis.localStorage?.getItem(PREF_KEY) !== "off",
  setAuto: (auto) => {
    globalThis.localStorage?.setItem(PREF_KEY, auto ? "on" : "off");
    if (!auto) void exitFullscreen();
    set({ auto });
  },
}));

/** Live fullscreen flag + whether the API exists at all on this browser. */
export const useFullscreen = (): { supported: boolean; active: boolean } => {
  const [active, setActive] = useState(isFullscreen);
  const supported = fullscreenSupported();
  useEffect(() => {
    const onChange = () => setActive(isFullscreen());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return { supported, active };
};

/**
 * Ask for fullscreen while `want` is true. Tries immediately; if the browser
 * refuses for lack of a gesture, the next pointerdown anywhere retries once.
 * Leaving the screen (or `want` going false) does NOT force an exit — the user
 * may have chosen fullscreen deliberately; only the settings toggle exits.
 *
 * Only fires on TOUCH devices. That is where the problem actually is (a phone
 * held sideways loses a third of the board to browser chrome); on a desktop,
 * silently swallowing the whole screen when a game starts is startling and
 * leaves people hunting for the way out. Desktop keeps the settings toggle.
 */
export const useAutoFullscreen = (want: boolean): void => {
  useEffect(() => {
    const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (!want || !touch || !fullscreenSupported()) return undefined;
    let armed = true;
    const onGesture = () => {
      if (!armed) return;
      armed = false;
      window.removeEventListener("pointerdown", onGesture);
      void enterFullscreen();
    };
    void enterFullscreen().then((got) => {
      if (got || !armed) return;
      window.addEventListener("pointerdown", onGesture);
    });
    return () => {
      armed = false;
      window.removeEventListener("pointerdown", onGesture);
    };
  }, [want]);
};
