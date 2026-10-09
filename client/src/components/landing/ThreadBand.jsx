import React, { useRef } from 'react';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { useMediaQuery } from '../ui/useMediaQuery';
import { BAND_CARDS } from './data';
import { EASE, useRange } from './motion';

/*
 * Interlude between the hero and the problem: the thread, at full width,
 * drawn by the scroll. A bead rides its tip and each real source card
 * lights up as the thread reaches it.
 */
const LAYOUTS = {
  wide: {
    box: [1200, 500],
    d: 'M -20 70 C 120 70, 140 150, 230 150 S 420 380, 520 370 S 720 120, 820 120 S 980 360, 1060 360 S 1180 300, 1230 260',
    points: [[230, 150], [520, 370], [820, 120], [1060, 360]],
    at: [0.2, 0.44, 0.66, 0.86],
  },
  narrow: {
    box: [400, 820],
    d: 'M 40 -20 C 40 60, 110 100, 130 150 S 290 260, 270 340 S 90 460, 130 520 S 300 620, 270 690 S 200 800, 200 840',
    points: [[130, 150], [270, 340], [130, 520], [270, 690]],
    at: [0.18, 0.42, 0.64, 0.84],
  },
};

function BandCard({ card, point, at, box, draw, reduce }) {
  const show = useRange(draw, [at - 0.04, at + 0.03], [0, 1]);
  const lift = useRange(draw, [at - 0.04, at + 0.03], [14, 0]);
  return (
    <motion.div
      className="band-card absolute w-[min(210px,46vw)] -translate-x-1/2 -translate-y-1/2 p-3.5"
      style={{ left: `${(point[0] / box[0]) * 100}%`, top: `${(point[1] / box[1]) * 100}%`, opacity: reduce ? 1 : show, y: reduce ? 0 : lift }}
    >
      <div className="flex items-center gap-2">
        <span className="lattice-chip lattice-chip--tied !m-0 !animate-none">{card.n}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-3">{card.code} · p. {card.page}</span>
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-snug text-fg">{card.title}</p>
      <div className="mt-2.5 space-y-1.5" aria-hidden>
        <span className="block h-1 w-[92%] rounded-full bg-[var(--border-hover)]" />
        <span className="block h-1 w-[70%] rounded-full bg-[var(--mark)]" />
      </div>
    </motion.div>
  );
}

export function ThreadBand() {
  const reduce = !!useReducedMotion();
  const wide = useMediaQuery('(min-width: 768px)');
  const L = wide ? LAYOUTS.wide : LAYOUTS.narrow;
  const ref = useRef(null);
  const pathRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 45%'] });
  const draw = useSpring(useRange(scrollYProgress, [0, 1], [0, 1]), { stiffness: 90, damping: 26, mass: 0.5 });

  /* A bead rides the tip of the thread. */
  const bx = useMotionValue(-50);
  const by = useMotionValue(-50);
  useMotionValueEvent(draw, 'change', (v) => {
    const p = pathRef.current;
    if (!p) return;
    const pt = p.getPointAtLength(Math.max(0.001, v) * p.getTotalLength());
    bx.set(pt.x);
    by.set(pt.y);
  });

  return (
    <section ref={ref} aria-labelledby="band-title" className="relative overflow-hidden pb-6 pt-20 sm:pt-28">
      <motion.h2
        id="band-title"
        className="hero-title mx-auto max-w-[16ch] px-4 text-center text-[2.4rem] sm:text-[3.4rem] lg:text-[4rem]"
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '0px 0px -20% 0px' }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        Every answer, tied to a <em className="text-accent">page.</em>
      </motion.h2>

      <div className="relative mx-auto mt-10 w-full max-w-[1200px] px-2 sm:px-6" style={{ aspectRatio: `${L.box[0]} / ${L.box[1]}` }}>
        <svg viewBox={`0 0 ${L.box[0]} ${L.box[1]}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <path d={L.d} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 7" vectorEffect="non-scaling-stroke" />
          <motion.path d={L.d} fill="none" stroke="var(--thread-glow)" strokeWidth="9" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: reduce ? 1 : draw }} />
          <motion.path ref={pathRef} d={L.d} fill="none" stroke="var(--thread)" strokeWidth="1.75" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: reduce ? 1 : draw }} />
          {!reduce && <motion.circle r="5" fill="var(--thread)" style={{ cx: bx, cy: by }} />}
        </svg>
        <ul aria-label="Example sources" className="contents">
          {BAND_CARDS.map((c, i) => (
            <li key={c.n} className="contents">
              <BandCard card={c} point={L.points[i]} at={L.at[i]} box={L.box} draw={draw} reduce={reduce} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
