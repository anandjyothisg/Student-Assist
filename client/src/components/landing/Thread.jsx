import React from 'react';
import { motion } from 'framer-motion';

/*
 * The citation thread: the page's one visual signature. A gold line that ties a
 * sentence in an answer back to the line in the document it came from.
 *
 * Geometry lives in useThreadPath.js.
 */

/**
 * Renders the thread for a measured path. `progress` (0..1, number or MotionValue)
 * draws it; `state` switches between the drawn line, a severed/frayed line and a
 * dashed "searching" line.
 */
export function ThreadPath({ d, progress = 1, state = 'tied', className = '', glow = true, width = 1.5 }) {
  const dashed = state === 'searching';
  return (
    <svg className={`pointer-events-none absolute inset-0 size-full overflow-visible ${className}`} aria-hidden>
      {glow && (
        <motion.path
          d={d}
          fill="none"
          stroke="var(--thread-glow)"
          strokeWidth={width * 5}
          strokeLinecap="round"
          style={{ pathLength: progress, opacity: dashed ? 0 : 1 }}
        />
      )}
      <motion.path
        d={d}
        fill="none"
        stroke="var(--thread)"
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? '3 6' : undefined}
        style={{ pathLength: dashed ? undefined : progress }}
      />
    </svg>
  );
}

/** The small knot that marks each end of a thread. */
export function Knot({ className = '', pulse = false, style }) {
  return (
    <span aria-hidden className={`thread-knot ${pulse ? 'thread-knot--pulse' : ''} ${className}`} style={style} />
  );
}

/**
 * A short vertical thread segment that stitches one section to the next. Draws
 * itself when it scrolls into view, so the whole page reads as one line.
 */
export function Stitch({ className = '', height = 96 }) {
  return (
    <div aria-hidden className={`relative mx-auto flex w-px flex-col items-center ${className}`} style={{ height }}>
      <motion.span
        className="block w-px flex-1 origin-top bg-[var(--thread)]"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, margin: '0px 0px -10% 0px' }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
      <Knot className="-mb-1" />
    </div>
  );
}
