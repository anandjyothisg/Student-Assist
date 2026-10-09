import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll } from 'framer-motion';
import { COURSES, LIBRARY } from './data';
import { EASE, useRange } from './motion';
import { Knot } from './Thread';

/*
 * The demo library as a shelf: one spine per real course, height by number of
 * documents. Spines rise in as the shelf scrolls into view and lift on hover.
 * CS-305 (the course every example on this page quotes) sits pulled out,
 * with the thread tied to it.
 */
const TINTS = [10, 20, 14, 24, 8, 17];

function Spine({ c, i, reduce }) {
  const featured = c.code === 'CS-305';
  const h = 220 + (c.docs - 8) * 34;
  return (
    <motion.li
      className="group relative shrink-0 snap-start"
      initial={reduce ? false : { opacity: 0, y: 70 }}
      whileInView={{ opacity: 1, y: featured ? -22 : 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ type: 'spring', stiffness: 90, damping: 16, delay: reduce ? 0 : i * 0.08 }}
    >
      <motion.div
        className="spine relative flex w-[64px] flex-col items-center justify-between overflow-hidden px-2 py-4 sm:w-[78px]"
        style={{ height: h, '--tint': `${TINTS[i]}%` }}
        whileHover={reduce ? undefined : { y: -16, rotate: i % 2 ? 2.5 : -2.5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        tabIndex={0}
        aria-label={`${c.code} ${c.title}, ${c.teacher}, ${c.docs} documents`}
      >
        <span className="spine-band" aria-hidden />
        <span className="spine-title text-[13px] font-semibold tracking-[-0.01em] text-fg sm:text-[14px]">{c.title}</span>
        <span className="font-mono text-[10px] text-fg-3">{c.code}</span>
      </motion.div>
      <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-fg px-2 py-1 text-[11px] font-medium text-canvas opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        {c.docs} docs · {c.teacher}
      </span>
      {featured && (
        <span aria-hidden className="absolute -top-14 left-1/2 flex h-14 -translate-x-1/2 flex-col items-center">
          <motion.span
            className="block w-px flex-1 origin-top bg-[var(--thread)]"
            initial={reduce ? false : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
          />
          <Knot pulse />
        </span>
      )}
    </motion.li>
  );
}

export function CourseShelf() {
  const reduce = !!useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useRange(scrollYProgress, [0, 1], reduce ? [0, 0] : [50, -50]);

  return (
    <section ref={ref} aria-labelledby="shelf-title" className="overflow-hidden py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-end gap-12 px-4 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h2 id="shelf-title" className="hero-title text-[2.4rem] sm:text-[3.25rem]">
            {LIBRARY.courses} courses. <em className="text-accent">{LIBRARY.documents} documents.</em>
          </h2>
          <p className="mt-4 text-[15.5px] text-fg-2">The demo library, ready to ask.</p>
        </div>
        <motion.div style={{ x }} className="relative">
          <ul className="-mx-4 flex snap-x items-end gap-3 overflow-x-auto px-4 pb-1 pt-20 sm:mx-0 sm:gap-4 sm:overflow-visible sm:px-0">
            {COURSES.map((c, i) => <Spine key={c.code} c={c} i={i} reduce={reduce} />)}
          </ul>
          <motion.div
            aria-hidden
            className="h-[3px] origin-left rounded-full bg-[var(--border-hover)]"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: EASE }}
          />
        </motion.div>
      </div>
    </section>
  );
}
