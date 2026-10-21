import { useEffect, useState } from 'react';

/** The current time, re-rendered on each minute boundary while `enabled`. */
export function useMinute(enabled: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = new Date();
      setNow(next);
      // Re-arm for the next :00 so the clock never lags a minute behind.
      id = setTimeout(tick, 60_000 - (next.getSeconds() * 1000 + next.getMilliseconds()));
    };
    tick();
    return () => clearTimeout(id);
  }, [enabled]);
  return now;
}
