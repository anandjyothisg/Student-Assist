import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform,
} from 'framer-motion';
import { ArrowDown, ArrowRight, Pause, Play } from 'lucide-react';
import { Button } from '../ui/Button';
import { useMediaQuery } from '../ui/useMediaQuery';
import { ANSWERS, HERO_SCENES, LIBRARY, RECORDED } from './data';
import { EASE, SPRING, tidyExcerpt, tidyTitle, useRange } from './motion';
import { Knot, ThreadPath } from './Thread';
import { useThreadPath } from './useThreadPath';

const PHASES = ['ask', 'search', 'answer', 'cite', 'rest'];
const DURATION = { ask: 1500, search: 1200, answer: 1300, cite: 1000, rest: 3400 };

/** A window of the passage around the supporting sentence, so the page reads like a real page. */
function passageWindow(excerpt, highlight) {
  const text = tidyExcerpt(excerpt);
  const at = text.indexOf(highlight);
  if (at < 0) return { before: text.slice(0, 220), mark: '', after: '' };
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, at - 150)) + 1);
  const end = at + highlight.length;
  return {
    before: (start > 0 ? '… ' : '') + text.slice(start, at),
    mark: highlight,
    after: text.slice(end, end + 170) + '…',
  };
}

function useTyped(text, active, reduce) {
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce || !active) { setN(text.length); return undefined; }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, Math.max(18, 1100 / text.length));
    return () => clearInterval(id);
  }, [text, active, reduce]);
  return text.slice(0, n);
}

/** Answer text with citation chips; the chip the thread ties to gets a ref. */
function LeadText({ text, cite, phase }) {
  const parts = text.split(/(\[\d\])/g).filter(Boolean);
  const sentences = [];
  let current = [];
  parts.forEach((p) => {
    current.push(p);
    if (/[.!?]\s*$/.test(p) && !/^\[\d\]$/.test(p)) { sentences.push(current); current = []; }
  });
  if (current.length) sentences.push(current);
  const shown = phase === 'answer' || phase === 'cite' || phase === 'rest';
  return (
    <p className="text-[13.5px] leading-[1.65] text-fg-2 sm:text-[14px]">
      {sentences.map((s, si) => (
        <motion.span
          key={si}
          initial={false}
          animate={shown ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.5, delay: shown && phase === 'answer' ? si * 0.32 : 0, ease: EASE }}
        >
          {s.map((p, pi) => {
            const m = p.match(/^\[(\d)\]$/);
            if (!m) return <React.Fragment key={pi}>{p}</React.Fragment>;
            const n = Number(m[1]);
            const tied = n === cite;
            return (
              <span
                key={pi}
                className={`lattice-chip ${tied && (phase === 'cite' || phase === 'rest') ? 'lattice-chip--tied' : ''}`}
              >
                {n}
              </span>
            );
          })}
        </motion.span>
      ))}
    </p>
  );
}

function SourceLattice({ reduce }) {
  const stageRef = useRef(null);
  const markEndRef = useRef(null);
  const chipRef = useRef(null);
  const cardRef = useRef(null);
  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState(reduce ? 'rest' : 'ask');
  const [paused, setPaused] = useState(false);
  const inView = useInView(stageRef, { margin: '-10% 0px' });
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');

  const config = HERO_SCENES[scene];
  const answer = ANSWERS[config.id];
  const source = answer.citations.find((c) => c.index === config.cite);
  const ghosts = answer.citations.filter((c) => c.index !== config.cite).slice(0, 2);
  const passage = useMemo(() => passageWindow(source.excerpt, config.highlight), [source, config]);
  const typed = useTyped(answer.question, phase === 'ask', reduce);

  /* Phase clock. Stops when off-screen, paused, or the visitor prefers reduced motion. */
  useEffect(() => {
    if (reduce || paused || !inView) return undefined;
    const t = setTimeout(() => {
      const next = PHASES[PHASES.indexOf(phase) + 1];
      if (next) setPhase(next);
      else { setScene((s) => (s + 1) % HERO_SCENES.length); setPhase('ask'); }
    }, DURATION[phase]);
    return () => clearTimeout(t);
  }, [phase, paused, inView, reduce]);

  /* Thread drawing. */
  const progress = useMotionValue(reduce ? 1 : 0);
  useEffect(() => {
    if (phase === 'cite') {
      const c = animate(progress, 1, { duration: 0.95, ease: EASE });
      return () => c.stop();
    }
    if (phase === 'rest') { progress.set(1); return undefined; }
    progress.set(0);
    return undefined;
  }, [phase, progress]);
  const { d, ends } = useThreadPath(stageRef, markEndRef, chipRef, [scene, phase === 'ask' || phase === 'search' ? 'pre' : 'post'], { bend: 0.65, aroundRef: cardRef });
  const knotA = useTransform(ends, (e) => (e ? `translate(${e.x1}px, ${e.y1}px)` : 'translate(-99px,-99px)'));
  const knotB = useTransform(ends, (e) => (e ? `translate(${e.x2}px, ${e.y2}px)` : 'translate(-99px,-99px)'));
  const knotOpacity = useRange(progress, [0, 0.05, 0.95, 1], [0, 1, 1, 1]);
  const knotBOpacity = useRange(progress, [0.9, 1], [0, 1]);

  /* Pointer tilt (fine pointers only). */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), SPRING);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), SPRING);
  const tilt = fine && !reduce;
  const onMove = (e) => {
    if (!tilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  const lit = phase === 'cite' || phase === 'rest' || (phase === 'search' && !reduce);
  const choose = (i) => { setScene(i); setPhase(reduce ? 'rest' : 'ask'); };

  return (
    <div className="relative" onPointerMove={onMove} onPointerLeave={onLeave} style={{ perspective: 1400 }}>
      <motion.div
        ref={stageRef}
        className="lattice-stage relative mx-auto h-[540px] w-full max-w-[620px] sm:h-[500px] lg:h-[540px]"
        style={tilt ? { rotateX, rotateY, transformStyle: 'preserve-3d' } : undefined}
      >
        {/* Two other retrieved pages, behind the cited one. */}
        {ghosts.map((g, i) => (
          <div
            key={`${config.id}-g${i}`}
            aria-hidden
            className="lattice-page absolute left-[8%] top-0 w-[84%] p-5 sm:left-[10%] sm:w-[76%]"
            style={{ transform: `translate(${(i + 1) * 22}px, ${(i + 1) * -18}px) rotate(${(i + 1) * 1.4}deg) translateZ(${-(i + 1) * 40}px)`, zIndex: 0, opacity: 0.75 - i * 0.25 }}
          >
            <div className="h-40" />
          </div>
        ))}

        {/* The cited page. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.article
            key={config.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: phase === 'ask' ? 0.55 : 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="lattice-page absolute left-0 top-0 z-[1] w-[88%] p-5 sm:w-[76%] sm:p-6"
            aria-label={`Source page: ${tidyTitle(source.document_title)}, page ${source.page_number}`}
          >
            <header className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
              <p className="min-w-0 truncate text-[12.5px] font-semibold text-fg">{tidyTitle(source.document_title)}</p>
              <p className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">{source.course_code} · p. {source.page_number}</p>
            </header>
            <div className="relative mt-4 overflow-hidden">
              {phase === 'search' && !reduce && (
                <motion.span
                  aria-hidden
                  className="lattice-scan pointer-events-none absolute inset-x-0 h-10"
                  initial={{ y: -40 }}
                  animate={{ y: 220 }}
                  transition={{ duration: 1.1, ease: 'easeInOut' }}
                />
              )}
              <p className="text-[12.5px] leading-[1.75] text-fg-3 sm:text-[13px]">
                {passage.before}
                <mark className={`lattice-mark ${lit ? 'lattice-mark--lit' : ''}`}>{passage.mark}</mark>
                <span ref={markEndRef} className="ml-1.5 inline-block h-[1em] w-0 align-middle" />
              </p>
            </div>
          </motion.article>
        </AnimatePresence>

        {/* The answer. */}
        <div ref={cardRef} className="lattice-answer absolute bottom-0 right-0 z-[3] w-[92%] p-5 sm:w-[72%] sm:p-6">
          <p className="text-[12px] font-medium text-fg-3">You asked</p>
          <p className="mt-1 min-h-[1.5em] text-[15px] font-semibold tracking-[-0.01em] text-fg" aria-live="off">
            {typed}
            {phase === 'ask' && !reduce && <span className="ml-0.5 inline-block h-[1.05em] w-px translate-y-[2px] animate-[cursor-blink_1s_steps(1)_infinite] bg-fg" aria-hidden />}
          </p>
          <div className="my-3.5 h-px bg-border" />
          <div className="relative min-h-[96px]">
            {phase === 'search' && !reduce && (
              <p className="absolute inset-0 flex items-center gap-2 text-[12.5px] text-fg-3">
                <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
                <span className="ml-1">Reading {answer.citations.length} passages</span>
              </p>
            )}
            <LeadText text={config.lead} cite={config.cite} phase={phase} />
          </div>
          <div className="mt-3.5 flex min-w-0 items-center gap-2 text-[11.5px] text-fg-3">
            <span ref={chipRef} className={`lattice-source inline-flex min-w-0 items-center gap-1.5 rounded-sm bg-accent-dim px-2 py-1 font-medium text-accent ${phase === 'cite' || phase === 'rest' ? 'lattice-source--tied' : ''}`}>
              <span className="font-mono">[{config.cite}]</span>
              <span className="truncate">{tidyTitle(source.document_title).replace(/ · Lecture Notes$/, '')} · p. {source.page_number}</span>
            </span>
          </div>
        </div>

        {/* The thread, over everything. */}
        <div className="pointer-events-none absolute inset-0 z-[4]">
          <ThreadPath d={d} progress={progress} />
          <motion.span className="absolute left-0 top-0" style={{ transform: knotA, opacity: knotOpacity }}><Knot className="-translate-x-1/2 -translate-y-1/2" /></motion.span>
          <motion.span className="absolute left-0 top-0" style={{ transform: knotB, opacity: knotBOpacity }}><Knot pulse className="-translate-x-1/2 -translate-y-1/2" /></motion.span>
        </div>
      </motion.div>

      {/* Scene controls: which recorded answer, and pause (auto-advancing content must be pausable). */}
      <div className="relative z-[5] mt-5 flex items-center justify-center gap-3 lg:justify-end lg:pr-2">
        <div className="flex items-center gap-1.5" role="group" aria-label="Recorded answers">
          {HERO_SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => choose(i)}
              aria-label={`Example ${i + 1} of ${HERO_SCENES.length}: ${ANSWERS[s.id].question}`}
              aria-pressed={i === scene}
              className="group flex h-6 items-center px-1"
            >
              <span className={`block h-[3px] rounded-full transition-all duration-300 ${i === scene ? 'w-7 bg-accent' : 'w-3 bg-border-strong group-hover:bg-fg-3'}`} />
            </button>
          ))}
        </div>
        {!reduce && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11.5px] font-medium text-fg-3 transition-colors hover:text-fg"
            aria-label={paused ? 'Play the answer loop' : 'Pause the answer loop'}
          >
            {paused ? <Play className="size-3" aria-hidden /> : <Pause className="size-3" aria-hidden />}
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
        <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3 sm:inline">Recorded · {RECORDED.model.split(' ')[0]}</span>
      </div>
    </div>
  );
}

export function Hero({ onStart, signedIn = false }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const stageY = useRange(scrollYProgress, [0, 1], [0, reduce ? 0 : 140]);
  const stageScale = useRange(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.9]);
  const stageOpacity = useRange(scrollYProgress, [0, 0.85], [1, reduce ? 1 : 0.15]);
  const copyY = useRange(scrollYProgress, [0, 1], [0, reduce ? 0 : -60]);
  const copyOpacity = useRange(scrollYProgress, [0, 0.6], [1, reduce ? 1 : 0]);

  const words = ['Ask', 'your', 'course,'];
  return (
    <section ref={ref} id="top" className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      <div aria-hidden className="hero-glow pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid min-h-[100dvh] max-w-[1320px] grid-cols-1 items-center gap-10 px-4 pb-14 pt-24 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-8 lg:pb-10 lg:pt-20">
        <motion.div style={{ y: copyY, opacity: copyOpacity }} className="relative z-[2] max-w-[600px]">
          <h1 id="hero-title" className="hero-title text-[2.9rem] leading-[1.02] sm:text-[4rem] lg:text-[4.4rem] xl:text-[5.1rem]">
            <span className="sr-only">Ask your course, not the internet.</span>
            <span aria-hidden>
              {words.map((w, i) => (
                <motion.span
                  key={w}
                  className="inline-block pr-[0.22em]"
                  initial={reduce ? false : { opacity: 0, y: '0.35em' }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.08 + i * 0.07, ease: EASE }}
                >
                  {w}
                </motion.span>
              ))}
              <br className="hidden sm:block" />
              <motion.em
                className="inline-block pb-1 text-accent"
                initial={reduce ? false : { opacity: 0, y: '0.35em' }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.32, ease: EASE }}
              >
                not the internet.
              </motion.em>
            </span>
          </h1>
          <motion.p
            className="mt-6 max-w-[44ch] text-[16px] leading-relaxed text-fg-2 sm:text-[17px]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
          >
            Answers from your teachers&rsquo; own notes, with the page behind every claim.
          </motion.p>
          <motion.div
            className="mt-9 flex flex-wrap items-center gap-3"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
          >
            <Button size="xl" iconRight={ArrowRight} onClick={() => onStart('register')}>{signedIn ? 'Open app' : 'Create account'}</Button>
            <a href="#lab" className="landing-ghost-link inline-flex h-12 items-center gap-2 rounded-lg px-4 text-[15px] font-medium text-fg-2 transition-colors hover:text-fg">
              See it answer <ArrowDown className="size-4" aria-hidden />
            </a>
          </motion.div>
          <motion.p
            className="mt-10 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-3"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.75 }}
          >
            <span className="max-sm:hidden">Demo library · </span>{LIBRARY.courses} courses · {LIBRARY.documents} documents · local model
          </motion.p>
        </motion.div>

        <motion.div style={{ y: stageY, scale: stageScale, opacity: stageOpacity }} className="relative z-[1]">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.2, ease: EASE }}
          >
            <SourceLattice reduce={!!reduce} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
