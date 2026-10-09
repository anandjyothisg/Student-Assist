import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { useMediaQuery } from '../ui/useMediaQuery';
import { EASE, useRange } from './motion';

/*
 * Act two: the thread is cut. A fluent answer with nothing tied to it. As the
 * visitor scrolls, each sentence is flagged "no source"; at the end one of
 * them turns out to be wrong. Illustrative copy written for this page, and
 * labelled as such.
 */
const QUESTION = 'When is quicksort slowest, and how do I avoid it?';
const SENTENCES = [
  'Quicksort slows to O(n²) when its pivots keep splitting the array unevenly.',
  'With a first-element pivot, input that is already sorted triggers this every time.',
  'Choosing the middle element as the pivot removes the worst case entirely.',
  'In practice it is still one of the fastest general-purpose sorts.',
];
const WRONG = 2;

function Sentence({ text, index, progress, pinned, reduce }) {
  const start = 0.14 + index * 0.13;
  const range = [start, start + 0.08];
  const dim = useRange(progress, range, [1, 0.42]);
  const line = useRange(progress, range, [0, 1]);
  const tag = useRange(progress, range, [0, 1]);
  const wrong = index === WRONG;
  const wrongOn = useRange(progress, [0.7, 0.78], [0, 1]);
  const wrongDim = useRange(progress, [0.7, 0.78], [0.42, 1]);
  const flagged = reduce || !pinned;

  return (
    <motion.span
      className="relative block py-1"
      style={pinned && !reduce ? { opacity: wrong ? wrongDim : dim } : undefined}
      initial={flagged && !reduce ? { opacity: 1 } : false}
      whileInView={flagged && !reduce ? { opacity: wrong ? 1 : 0.5 } : undefined}
      viewport={{ once: true, margin: '0px 0px -30% 0px' }}
      transition={{ duration: 0.6, delay: index * 0.25, ease: EASE }}
    >
      <span className={`problem-sentence ${wrong ? 'problem-sentence--wrong' : ''}`}>
        {text}
        <motion.span
          aria-hidden
          className="problem-underline"
          style={pinned && !reduce ? { scaleX: wrong ? wrongOn : line } : { scaleX: 1 }}
        />
      </span>
      <motion.span
        className={`ml-1.5 inline-flex translate-y-[-1px] items-center rounded-xs px-1.5 py-px align-middle font-mono text-[10px] font-medium uppercase tracking-[0.06em] ${wrong ? 'bg-error-dim text-error' : 'bg-subtle text-fg-3'}`}
        style={pinned && !reduce ? { opacity: wrong ? wrongOn : tag } : undefined}
      >
        {wrong ? 'Wrong' : 'No source'}
      </motion.span>
    </motion.span>
  );
}

function FrayedThread({ progress, pinned, reduce }) {
  const draw = useRange(progress, [0, 0.3], [0.15, 1]);
  const fray = useRange(progress, [0.25, 0.4], [0, 1]);
  const static_ = reduce || !pinned;
  return (
    <svg viewBox="0 0 120 400" className="pointer-events-none absolute -left-24 top-[-120px] hidden h-[400px] w-[120px] overflow-visible lg:block" aria-hidden>
      <motion.path
        d="M 20 0 C 20 120, 30 190, 70 230"
        fill="none"
        stroke="var(--thread)"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ pathLength: static_ ? 1 : draw }}
      />
      <motion.g style={{ opacity: static_ ? 1 : fray }} stroke="var(--thread)" strokeWidth="1" strokeLinecap="round" fill="none">
        <path d="M 70 230 q 8 6 13 16" />
        <path d="M 70 230 q 11 1 18 8" />
        <path d="M 70 230 q 4 9 4 19" />
      </motion.g>
    </svg>
  );
}

export function ProblemScene() {
  const reduce = !!useReducedMotion();
  const wide = useMediaQuery('(min-width: 1024px)');
  const pinned = wide && !reduce;
  const ref = useRef(null);
  const { scrollYProgress: raw } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const scrollYProgress = useSpring(raw, { stiffness: 140, damping: 30, mass: 0.4 });
  const turn = useRange(scrollYProgress, [0.8, 0.9], [0, 1]);
  const turnY = useRange(scrollYProgress, [0.8, 0.9], [16, 0]);
  const intro = useRange(scrollYProgress, [0.8, 0.9], [1, 0.35]);

  return (
    <section ref={ref} aria-labelledby="problem-title" className={pinned ? 'relative h-[260vh]' : 'relative'}>
      <div className={pinned ? 'sticky top-0 flex h-[100dvh] items-center' : 'py-24 sm:py-32'}>
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 px-4 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div>
            <motion.div style={pinned ? { opacity: intro } : undefined}>
              <h2 id="problem-title" className="hero-title text-[2.4rem] sm:text-[3.25rem] lg:text-[3.6rem]">
                Fluent isn&rsquo;t the same as <em className="text-accent">correct.</em>
              </h2>
              <p className="mt-5 max-w-[34ch] text-[16px] leading-relaxed text-fg-2">One of these sentences is wrong. Can you tell which?</p>
            </motion.div>
            <motion.p
              className="mt-10 hidden max-w-[22ch] font-serif text-[1.9rem] leading-[1.15] text-fg sm:text-[2.2rem] lg:block"
              style={pinned ? { opacity: turn, y: turnY } : undefined}
              initial={pinned || reduce ? false : { opacity: 0, y: 14 }}
              whileInView={pinned || reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
            >
              So every sentence must show its source.
            </motion.p>
          </div>

          <div className="relative">
            <FrayedThread progress={scrollYProgress} pinned={pinned} reduce={reduce} />
            <figure className="problem-card relative p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[12px] font-medium text-fg-3">A typical chatbot answer</p>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-3">
                  Sources <span className="ml-1 text-fg">0</span>
                </p>
              </div>
              <p className="mt-2 text-[16px] font-semibold tracking-[-0.01em] text-fg">{QUESTION}</p>
              <div className="my-5 h-px bg-border" />
              <p className="text-[15px] leading-[1.7] text-fg-2 sm:text-[16px]">
                {SENTENCES.map((s, i) => (
                  <Sentence key={i} text={s} index={i} progress={scrollYProgress} pinned={pinned} reduce={reduce} />
                ))}
              </p>
              <figcaption className="mt-6 border-t border-border pt-4 text-[12px] leading-relaxed text-fg-3">
                Illustration. A middle pivot doesn&rsquo;t remove quicksort&rsquo;s O(n²) worst case.
              </figcaption>
            </figure>
            <motion.p
              className="mt-10 max-w-[22ch] font-serif text-[1.9rem] leading-[1.15] text-fg sm:text-[2.2rem] lg:hidden"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
            >
              So every sentence must show its source.
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}
