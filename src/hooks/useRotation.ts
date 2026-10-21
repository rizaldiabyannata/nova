import { useEffect, useState } from 'react';

/**
 * Cycles an index through `length` items every `intervalSeconds` while `active`.
 * A single interval exists at a time and is cleared on pause, change, and unmount (FR-004, NFR-001).
 */
export function useRotation(length: number, intervalSeconds: number, active: boolean, start = 0) {
  const [index, setIndex] = useState(start);

  useEffect(() => {
    if (!active || length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % length), intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [active, length, intervalSeconds]);

  return [length ? index % length : 0, setIndex] as const;
}
