import { useEffect, useState } from "react";

// Seconds remaining until `until` (epoch ms), ticking twice a second while it
// runs. Returns 0 for null/past deadlines. Used for the end-vote cooldown.
export const useCountdown = (until: number | null | undefined): number => {
  const target = until ?? 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [target]);
  return Math.max(0, Math.ceil((target - now) / 1000));
};
