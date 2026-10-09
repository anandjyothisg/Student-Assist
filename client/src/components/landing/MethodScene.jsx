import React, { useRef, useState } from 'react';
import {
  AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring,
} from 'framer-motion';
import { FileText, Folder, Lock } from 'lucide-react';
import { useMediaQuery } from '../ui/useMediaQuery';
import { ANSWERS, COURSE_TREE, RAG } from './data';
import { EASE, SPRING, tidyExcerpt, tidyTitle, useRange } from './motion';
import { Knot, ThreadPath } from './Thread';
import { useThreadPath } from './useThreadPath';

/*
 * Act three: the thread runs through the pipeline. Four steps, each with a
 * visual built from real data: the demo course structure, real passages,
 * real retrieval scores and a recorded answer.
 */
const PK = ANSWERS.pk;
const WORLD = ANSWERS.worldcup;

const STEPS = [
  {
    title: 'Teachers upload notes',
    body: 'Filed by course, unit and topic.',
  },
  {
    title: 'Notes become passages',
    body: `About ${RAG.chunk.toLocaleString()} characters each, embedded locally.`,
  },
  {
    title: `Your question finds the best ${RAG.topK}`,
    body: 'Meaning plus keywords, only in your courses.',
  },
  {
    title: 'Cited answer, or none',
    body: 'Nothing relevant? It says so.',
  },
];

function Frame({ label, children }) {
  return (
    <div className="method-frame relative w-full p-5 sm:p-7">
      <p className="mb-5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">{label}</p>
      {children}
    </div>
  );
}

function TreeVisual() {
  return (
    <Frame label={`${COURSE_TREE.code} · ${COURSE_TREE.teacher}`}>
      <p className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{COURSE_TREE.title}</p>
      <ol className="mt-5 space-y-4">
        {COURSE_TREE.units.map((u, ui) => (
          <motion.li key={u.title} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + ui * 0.12, duration: 0.5, ease: EASE }}>
            <p className="flex items-center gap-2 text-[13px] font-medium text-fg-2"><Folder className="size-3.5 text-fg-3" aria-hidden />Unit {ui + 1} · {u.title}</p>
            <ul className="ml-[7px] mt-2 space-y-1.5 border-l border-border pl-4">
              {u.topics.map((t, ti) => {
                const on = ui === 0 && ti === 0;
                return (
                  <li key={t} className={`flex items-center gap-2 text-[12.5px] ${on ? 'text-fg' : 'text-fg-3'}`}>
                    <FileText className={`size-3.5 ${on ? 'text-accent' : ''}`} aria-hidden />
                    <span className="truncate">{t}</span>
                    {on && <span className="ml-auto shrink-0 rounded-xs bg-accent-dim px-1.5 py-px font-mono text-[10px] text-accent">4 pages</span>}
                  </li>
                );
              })}
            </ul>
          </motion.li>
        ))}
      </ol>
    </Frame>
  );
}

function PassagesVisual() {
  const parts = PK.citations.slice(0, 3);
  return (
    <Frame label={tidyTitle(parts[0].document_title)}>
      <div className="space-y-0">
        {parts.map((c, i) => (
          <React.Fragment key={i}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.55, ease: EASE }}
              className="rounded-md border border-border bg-[var(--bg-inset)] p-3.5"
            >
              <div className="mb-1.5 flex items-center justify-between font-mono text-[10.5px] text-fg-3">
                <span>passage {i + 1} · p. {c.page_number}</span>
                <span>384-d vector</span>
              </div>
              <p className="line-clamp-2 text-[12.5px] leading-relaxed text-fg-2">{tidyExcerpt(c.excerpt)}</p>
            </motion.div>
            {i < parts.length - 1 && (
              <div className="flex h-7 items-center gap-2 pl-4" aria-hidden>
                <span className="h-full w-px bg-[var(--thread)]" />
                <span className="font-mono text-[10px] text-accent">{RAG.overlap}-char overlap</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-fg-3">Embeddings: bge-small-en-v1.5, computed locally.</p>
    </Frame>
  );
}

function RankingVisual() {
  const rows = PK.citations;
  const cut = 1 - RAG.maxDistance;
  return (
    <Frame label="Retrieval · recorded">
      <p className="rounded-md bg-subtle px-3 py-2 text-[13.5px] font-medium text-fg">{PK.question}</p>
      <ol className="relative mt-4 space-y-2.5">
        {rows.map((c, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.09, duration: 0.5, ease: EASE }}
            className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1"
          >
            <span className="truncate text-[12.5px] text-fg-2">{tidyTitle(c.document_title)} · p. {c.page_number}</span>
            <span className="font-mono text-[11.5px] tabular-nums text-fg">{c.score.toFixed(3)}</span>
            <span className="relative col-span-2 h-1 overflow-hidden rounded-full bg-[var(--border)]">
              <motion.span
                className="absolute inset-y-0 left-0 origin-left rounded-full bg-accent"
                style={{ width: `${c.score * 100}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2 + i * 0.09, duration: 0.7, ease: EASE }}
              />
              <span className="absolute inset-y-[-3px] w-px bg-fg-3" style={{ left: `${cut * 100}%` }} />
            </span>
          </motion.li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-fg-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-px bg-fg-3" />cut-off: distance {RAG.maxDistance}</span>
        <span className="inline-flex items-center gap-1.5"><Lock className="size-3" aria-hidden />5 enrolled courses searched</span>
      </div>
    </Frame>
  );
}

function AnswerVisual() {
  const root = useRef(null);
  const from = useRef(null);
  const to = useRef(null);
  const { d } = useThreadPath(root, from, to, [], { fromSide: 'start', toSide: 'top', bend: 0.4 });
  const src = PK.citations[0];
  return (
    <Frame label="Answer · recorded verbatim">
      <div ref={root} className="relative">
        <div className="relative rounded-md border border-border bg-[var(--bg-inset)] p-3.5">
          <p className="mb-1 font-mono text-[10.5px] text-fg-3">[1] {src.course_code} · p. {src.page_number}</p>
          <p className="text-[12.5px] leading-relaxed text-fg-3">
            … <mark className="lattice-mark lattice-mark--lit">Primary key: the candidate key chosen by the designer to identify tuples.</mark>
          </p>
          <span ref={from} className="absolute bottom-0 left-[26px] h-0 w-0" />
        </div>
        <div className="h-9" />
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="mb-2 flex items-center gap-2 text-[11.5px] font-medium text-fg-3">
            <span ref={to} className="lattice-chip lattice-chip--tied !m-0">1</span> Answer, citing passage 1
          </p>
          <p className="text-[13.5px] leading-relaxed text-fg-2">
            A primary key is the candidate key chosen by the designer to identify tuples in a relation. Its attributes may not be NULL (entity integrity). <span className="lattice-chip">1</span>
          </p>
        </div>
        <ThreadPath d={d} progress={1} />
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-md border border-dashed border-border-strong p-3.5">
        <span className="mt-1 inline-block h-px w-5 shrink-0 border-t border-dashed border-fg-3" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-fg-3">
          <span className="font-medium text-fg-2">&ldquo;{WORLD.question}&rdquo;</span> Closest passage sits at distance{' '}
          <span className="font-mono text-fg">{WORLD.nearestDistance}</span>, past the {RAG.maxDistance} cut-off. Declined, no answer written.
        </p>
      </div>
    </Frame>
  );
}

const VISUALS = [TreeVisual, PassagesVisual, RankingVisual, AnswerVisual];

function StepList({ step, fill, pinned, onPick }) {
  return (
    <div className="relative pl-8">
      <span className="absolute bottom-2 left-[7px] top-2 w-px bg-border" aria-hidden />
      <motion.span
        className="absolute left-[7px] top-2 w-px origin-top bg-[var(--thread)]"
        style={{ scaleY: fill, height: 'calc(100% - 16px)' }}
        aria-hidden
      />
      <ol className="space-y-7">
        {STEPS.map((s, i) => {
          const on = i === step;
          return (
            <li key={s.title} className="relative">
              <span
                aria-hidden
                className={`absolute -left-8 top-[5px] grid size-[15px] place-items-center rounded-full border transition-colors duration-500 ${i <= step ? 'border-[var(--thread)] bg-canvas' : 'border-border-strong bg-canvas'}`}
              >
                <span className={`size-[5px] rounded-full transition-colors duration-500 ${i <= step ? 'bg-[var(--thread)]' : 'bg-transparent'}`} />
              </span>
              <button
                type="button"
                onClick={() => onPick(i)}
                disabled={!pinned}
                className="text-left disabled:cursor-default"
                aria-current={on ? 'step' : undefined}
              >
                <span className={`block font-mono text-[11px] tabular-nums transition-colors duration-500 ${on ? 'text-accent' : 'text-fg-3'}`}>0{i + 1}</span>
                <span className={`mt-1 block text-[18px] font-semibold tracking-[-0.015em] transition-colors duration-500 ${on ? 'text-fg' : 'text-fg-3'}`}>{s.title}</span>
              </button>
              <motion.p
                initial={false}
                animate={{ opacity: on ? 1 : 0, height: on ? 'auto' : 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="max-w-[42ch] overflow-hidden text-[14.5px] leading-relaxed text-fg-2"
              >
                <span className="block pt-2">{s.body}</span>
              </motion.p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function MethodScene() {
  const reduce = !!useReducedMotion();
  const wide = useMediaQuery('(min-width: 1024px)');
  const pinned = wide && !reduce;
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const fill = useSpring(useRange(scrollYProgress, [0.02, 0.92], [0, 1]), SPRING);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length * 0.999)));
    if (next !== step) setStep(next);
  });

  /* Clicking a step scrolls to its slice of the pinned scene. */
  const pick = (i) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((i + 0.5) / STEPS.length), behavior: reduce ? 'instant' : 'smooth' });
  };

  const heading = (
    <h2 id="method-title" className="hero-title text-[2.4rem] sm:text-[3.25rem] lg:text-[3.4rem]">
      Four steps to a <em className="text-accent">cited</em> answer.
    </h2>
  );

  if (!pinned) {
    return (
      <section id="method" aria-labelledby="method-title" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-[720px] px-4 sm:px-8">
          {heading}
          <ol className="relative mt-12 space-y-14 border-l border-[var(--thread)] pl-6 sm:pl-8">
            {STEPS.map((s, i) => {
              const Visual = VISUALS[i];
              return (
                <motion.li
                  key={s.title}
                  className="relative"
                  initial={reduce ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                  transition={{ duration: 0.7, ease: EASE }}
                >
                  <Knot className="absolute -left-6 top-2 -translate-x-1/2 sm:-left-8" />
                  <p className="font-mono text-[11px] text-accent">0{i + 1}</p>
                  <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.015em] text-fg">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{s.body}</p>
                  <div className="mt-6"><Visual /></div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </section>
    );
  }

  const Visual = VISUALS[step];
  return (
    <section id="method" ref={ref} aria-labelledby="method-title" className="relative h-[420vh]">
      <div className="sticky top-0 flex h-[100dvh] items-center">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-center gap-20 px-8">
          <div>
            {heading}
            <div className="mt-12"><StepList step={step} fill={fill} pinned={pinned} onPick={pick} /></div>
          </div>
          <div className="relative min-h-[520px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 24, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.985 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute inset-0 flex items-center"
              >
                <Visual />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
