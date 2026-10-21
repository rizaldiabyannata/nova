import { useId } from 'react';
import type { LumiExpression } from '../../hooks/useNotchController';
import { LUMI_FACES } from './LumiExpressions';

const FACE_INK = '#1f2a6b';
// Soft lavender edge so white parts stay readable where they overlap.
const LINE = '#d6cff5';

/** Lumi, the white headphone cat (head only). Layered body > head > ears so app.css can move each part; the face comes from LUMI_FACES. */
export function Lumi({ accent, expression, size = 36 }: { accent: string; expression: LumiExpression; size?: number }) {
  const face = LUMI_FACES[expression];
  // Gradient ids must be unique per instance on the page.
  const id = useId();
  const fur = `url(#${id}fur)`;
  return (
    <svg className="lumi" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        {/* Top-lit fur: white fading to lavender underneath, like the sheet (mascot artwork). taste-skill-ignore */}
        <linearGradient id={`${id}fur`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor="#e6e0ff" />
        </linearGradient>
        <linearGradient id={`${id}iris`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={FACE_INK} />
          <stop offset="1" stopColor="#4d6cf2" />
        </linearGradient>
      </defs>
      {/* key re-mounts the body so each new expression plays the react animation once */}
      <g className="lumi-body" data-expression={expression} key={expression}>
        <g className="lumi-head">
          <g className="lumi-ear lumi-ear-l">
            <path d="M9 22L11 5l11 7z" fill={fur} stroke={LINE} strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M12.5 15l1-6.5 5 4z" fill="#ffc2dc" />
          </g>
          <g className="lumi-ear lumi-ear-r">
            <path d="M39 22L37 5l-11 7z" fill={fur} stroke={LINE} strokeWidth="0.8" strokeLinejoin="round" />
            <path d="M35.5 15l-1-6.5-5 4z" fill="#ffc2dc" />
          </g>
          <ellipse cx="24" cy="26" rx="16" ry="14" fill={fur} stroke={LINE} strokeWidth="0.8" />
          <path d="M8 25a16 15 0 0 1 32 0" fill="none" stroke={accent} strokeWidth="2.5" />
          {/* Cups hug the head and stop above the chin so they don't read as arms. */}
          <rect x="3.5" y="19" width="7.5" height="10.5" rx="3.75" fill={accent} />
          <rect x="37" y="19" width="7.5" height="10.5" rx="3.75" fill={accent} />
          <rect x="5.5" y="21.5" width="3.5" height="5.5" rx="1.75" fill="#fff" opacity="0.45" />
          <rect x="39" y="21.5" width="3.5" height="5.5" rx="1.75" fill="#fff" opacity="0.45" />
          <path d="M24 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill={accent} />
          <ellipse cx="14.5" cy="31" rx="2.6" ry="1.5" fill="#ffb0cf" opacity="0.7" />
          <ellipse cx="33.5" cy="31" rx="2.6" ry="1.5" fill="#ffb0cf" opacity="0.7" />
          {face.eyesOpen ? (
            <g className="lumi-eyes">
              <path d={face.eyes} fill={`url(#${id}iris)`} />
              <path d={face.shine} fill="#fff" />
            </g>
          ) : (
            <path d={face.eyes} fill="none" stroke={FACE_INK} strokeWidth="1.6" strokeLinecap="round" />
          )}
          <path d={face.mouth} fill="none" stroke={FACE_INK} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
