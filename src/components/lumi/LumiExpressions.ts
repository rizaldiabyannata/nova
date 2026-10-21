import type { LumiExpression } from '../../hooks/useNotchController';

/** Face geometry only (48×48 viewBox); motion lives in app.css. Closed eyes are strokes, open eyes are fills. */
export interface LumiFace {
  eyes: string;
  eyesOpen: boolean;
  /** Catchlights for open eyes, drawn white on top so they blink with the eyes. */
  shine?: string;
  mouth: string;
}

const OPEN_EYES = 'M15.5 26a2.5 3.2 0 1 0 5 0a2.5 3.2 0 1 0-5 0ZM27.5 26a2.5 3.2 0 1 0 5 0a2.5 3.2 0 1 0-5 0Z';
// A big highlight up-right and a small one down-left, per eye centre (x, y); r shrinks it for smaller eyes.
const shine = (x: number, y: number, r = 1) =>
  [x, x + 12]
    .map(
      (cx) =>
        `M${cx + 0.2 * r} ${y - 1.3 * r}a${0.9 * r} ${0.9 * r} 0 1 0 ${1.8 * r} 0a${0.9 * r} ${0.9 * r} 0 1 0 ${-1.8 * r} 0Z` +
        `M${cx - 1.3 * r} ${y + 1.4 * r}a${0.45 * r} ${0.45 * r} 0 1 0 ${0.9 * r} 0a${0.45 * r} ${0.45 * r} 0 1 0 ${-0.9 * r} 0Z`,
    )
    .join('');

export const LUMI_FACES: Record<LumiExpression, LumiFace> = {
  idle: { eyes: OPEN_EYES, eyesOpen: true, shine: shine(18, 26), mouth: 'M21.5 31.5q1.25 1.5 2.5 0q1.25 1.5 2.5 0' },
  happy: { eyes: 'M15.5 27q2.5-3 5 0M27.5 27q2.5-3 5 0', eyesOpen: false, mouth: 'M21 31q3 3.5 6 0' },
  surprised: {
    eyes: 'M15 26a3 3.8 0 1 0 6 0a3 3.8 0 1 0-6 0ZM27 26a3 3.8 0 1 0 6 0a3 3.8 0 1 0-6 0Z',
    eyesOpen: true,
    shine: shine(18, 26),
    mouth: 'M22.6 32.5a1.4 1.6 0 1 0 2.8 0a1.4 1.6 0 1 0-2.8 0',
  },
  thinking: {
    eyes: 'M17 24.5a2 2.6 0 1 0 4 0a2 2.6 0 1 0-4 0ZM29 24.5a2 2.6 0 1 0 4 0a2 2.6 0 1 0-4 0Z',
    eyesOpen: true,
    shine: shine(19, 24.5, 0.7),
    mouth: 'M22 32.5h4',
  },
  sleepy: { eyes: 'M15.5 26q2.5 2 5 0M27.5 26q2.5 2 5 0', eyesOpen: false, mouth: 'M23 32.5q1 .8 2 0' },
};
