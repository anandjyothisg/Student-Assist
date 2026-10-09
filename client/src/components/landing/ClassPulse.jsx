import React, { useEffect, useRef, useState } from 'react';
import {
  animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform,
} from 'framer-motion';
import { useMediaQuery } from '../ui/useMediaQuery';
import insights from './teacherInsights.json';
import { EASE, useRange } from './motion';

/*
 * What teachers see, told by the scroll. One dashboard canvas assembles in
 * four beats from a real snapshot of the demo teacher's Insights data:
 * questions per day (the trend line is the thread), when students study,
 * what they ask most, and where the materials fall short.
 */
const BEATS = [
  { at: 0, title: 'When they ask', body: 'Questions per day, across your courses.' },
  { at: 0.27, title: 'When they study', body: 'Each course by weekday.' },
  { at: 0.5, title: 'What they ask most', body: 'The questions that keep coming back.' },
  { at: 0.74, title: 'Where notes fall short', body: 'Questions your materials could not answer.' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* Pinned: the shared scroll progress. Stacked (mobile / reduced motion): each block plays its own range once in view. */
function useBlockProgress(global, [from, to], pinned, ref, reduce) {
  const local = useMotionValue(reduce ? to : from);
  const seen = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  useEffect(() => {
    if (pinned || reduce || !seen) return undefined;
    const c = animate(local, to, { duration: 1.6, ease: EASE });
    return () => c.stop();
  }, [pinned, reduce, seen, local, to]);
  return pinned ? global : local;
}

function Panel({ label, children, className = '', panelRef }) {
  return (
    <div ref={panelRef} className={`pulse-panel relative p-4 sm:p-5 ${className}`}>
      <p className="mb-3 text-[12px] font-medium text-fg-3">{label}</p>
      {children}
    </div>
  );
}

function Bar({ v, max, i, n, p, range }) {
  const start = range[0] + (i / n) * (range[1] - range[0]) * 0.8;
  const s = useRange(p, [start, start + 0.03], [0, 1]);
  return (
    <div className="flex h-full flex-1 items-end">
      <motion.span className="pulse-bar block w-full origin-bottom rounded-t-[3px]" style={{ height: `${Math.max(4, (v / max) * 100)}%`, scaleY: s, opacity: v ? 1 : 0.35 }} />
    </div>
  );
}

function DailyChart({ p: global, pinned, reduce }) {
  const ref = useRef(null);
  const range = [0.02, 0.26];
  const p = useBlockProgress(global, range, pinned, ref, reduce);
  const data = insights.daily.map((d) => d.count);
  const max = Math.max(...data, 1);
  const avg = data.map((_, i) => { const w = data.slice(Math.max(0, i - 2), i + 1); return w.reduce((a, b) => a + b, 0) / w.length; });
  const pts = avg.map((a, i) => [((i + 0.5) / data.length) * 100, 100 - (a / max) * 100]);
  const d = pts.reduce((acc, [x, y], i) => {
    if (!i) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, '');
  const line = useRange(p, [0.1, 0.25], [0, 1]);
  const clip = useTransform(line, (v) => `inset(-10% ${100 - v * 100}% -10% 0)`);
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <Panel label="Questions per day · last 28 days" panelRef={ref} className="sm:col-span-2">
      <div className="mb-3 flex items-baseline gap-5">
        <p><span className="font-serif text-[2.6rem] leading-none text-fg">{total}</span> <span className="text-[12px] text-fg-3">questions</span></p>
        <p><span className="font-serif text-[2.6rem] leading-none text-fg">{insights.totals.active_students}</span> <span className="text-[12px] text-fg-3">active students</span></p>
      </div>
      <div className="relative h-[120px] sm:h-[150px]">
        <div className="flex h-full items-end gap-[3px]">
          {data.map((v, i) => <Bar key={i} v={v} max={max} i={i} n={data.length} p={p} range={range} />)}
        </div>
        <motion.svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" style={{ clipPath: clip }} aria-hidden>
          <path d={d} fill="none" stroke="var(--thread-glow)" strokeWidth="8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d={d} fill="none" stroke="var(--thread)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        </motion.svg>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-fg-3">
        <span>{insights.daily[0].date.slice(5)}</span><span className="flex items-center gap-1.5 text-accent"><span className="inline-block h-[2px] w-4 rounded-full bg-[var(--thread)]" />3-day average</span><span>{insights.daily.at(-1).date.slice(5)}</span>
      </div>
    </Panel>
  );
}

function Cell({ v, max, p, at }) {
  const s = useRange(p, [at, at + 0.04], [0, 1]);
  return (
    <motion.span
      className="pulse-cell block aspect-square rounded-[4px]"
      style={{ '--heat': `${v ? 18 + (v / max) * 82 : 0}%`, scale: s, opacity: s }}
      title={`${v} questions`}
    />
  );
}

function Heatmap({ p: global, pinned, reduce }) {
  const ref = useRef(null);
  const range = [0.28, 0.48];
  const p = useBlockProgress(global, range, pinned, ref, reduce);
  const max = Math.max(...insights.heatmap.flatMap((r) => r.counts), 1);
  const cells = insights.heatmap.length * 7;
  return (
    <Panel label="When students ask" panelRef={ref}>
      <div className="grid grid-cols-[46px_repeat(7,minmax(0,1fr))] items-center gap-1.5">
        <span />
        {DAYS.map((d) => <span key={d} className="text-center font-mono text-[9.5px] text-fg-3">{d[0]}</span>)}
        {insights.heatmap.map((row, r) => (
          <React.Fragment key={row.course_code}>
            <span className="font-mono text-[10.5px] text-fg-2">{row.course_code}</span>
            {row.counts.map((v, c) => (
              <Cell key={c} v={v} max={max} p={p} at={range[0] + ((r * 7 + c) / cells) * (range[1] - range[0] - 0.04)} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </Panel>
  );
}

function TopRow({ q, max, p, at, rank }) {
  const s = useRange(p, [at, at + 0.06], [0, 1]);
  const x = useRange(p, [at, at + 0.06], [24, 0]);
  return (
    <motion.li style={{ opacity: s, x }} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1">
      <span className="font-mono text-[10.5px] text-fg-3">{rank}</span>
      <span className="truncate text-[12.5px] text-fg">{q.question}</span>
      <span className="font-mono text-[11px] tabular-nums text-fg-2">{q.count}</span>
      <span />
      <span className="col-span-2 h-[3px] overflow-hidden rounded-full bg-[var(--border)]">
        <motion.span className="block h-full origin-left rounded-full bg-accent" style={{ width: `${(q.count / max) * 100}%`, scaleX: s }} />
      </span>
    </motion.li>
  );
}

function TopQuestions({ p: global, pinned, reduce }) {
  const ref = useRef(null);
  const range = [0.5, 0.72];
  const p = useBlockProgress(global, range, pinned, ref, reduce);
  const max = Math.max(...insights.top.map((q) => q.count));
  return (
    <Panel label="Most asked" panelRef={ref}>
      <ol className="space-y-3">
        {insights.top.map((q, i) => <TopRow key={q.question} q={q} max={max} p={p} at={range[0] + i * 0.04} rank={i + 1} />)}
      </ol>
    </Panel>
  );
}

function Gaps({ p: global, pinned, reduce }) {
  const ref = useRef(null);
  const range = [0.74, 0.92];
  const p = useBlockProgress(global, range, pinned, ref, reduce);
  const show = useRange(p, [0.74, 0.8], [0, 1]);
  const y = useRange(p, [0.74, 0.8], [40, 0]);
  const fray = useRange(p, [0.8, 0.9], [0, 1]);
  return (
    <motion.div ref={ref} style={{ opacity: show, y }} className={pinned ? 'pulse-gaps absolute right-[-20px] top-[calc(100%-10px)] z-[2] w-[62%] p-5' : 'pulse-gaps p-5 sm:col-span-2'}>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-fg-3">Gaps in the materials</p>
        <svg viewBox="0 0 70 16" className="h-4 w-[70px] overflow-visible" aria-hidden>
          <path d="M 0 8 L 46 8" stroke="var(--thread)" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
          <motion.g style={{ opacity: fray }} stroke="var(--thread)" strokeWidth="1" fill="none" strokeLinecap="round">
            <path d="M 46 8 q 8 -2 13 -7" /><path d="M 46 8 q 9 1 15 0" /><path d="M 46 8 q 7 4 11 8" />
          </motion.g>
        </svg>
      </div>
      <ul className="mt-3 space-y-2.5">
        {insights.gaps.map((g) => (
          <li key={g.question} className="flex items-start justify-between gap-3">
            <span className="text-[13px] leading-snug text-fg">{g.question}</span>
            <span className="shrink-0 rounded-xs bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-fg-3">{g.course}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-border pt-3 text-[12px] text-accent">Upload a note, and it can be answered next time.</p>
    </motion.div>
  );
}

export function ClassPulse() {
  const reduce = !!useReducedMotion();
  const wide = useMediaQuery('(min-width: 1024px)');
  const pinned = wide && !reduce;
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const [beat, setBeat] = useState(0);
  useMotionValueEvent(p, 'change', (v) => {
    const next = BEATS.reduce((acc, b, i) => (v >= b.at ? i : acc), 0);
    if (next !== beat) setBeat(next);
  });

  const heading = (
    <h2 id="pulse-title" className="hero-title text-[2.4rem] sm:text-[3.25rem] lg:text-[3.6rem]">
      See how your class is <em className="text-accent">studying.</em>
    </h2>
  );
  const canvas = (
    <div className="relative">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DailyChart p={p} pinned={pinned} reduce={reduce} />
        <Heatmap p={p} pinned={pinned} reduce={reduce} />
        <TopQuestions p={p} pinned={pinned} reduce={reduce} />
        {!pinned && <Gaps p={p} pinned={pinned} reduce={reduce} />}
      </div>
      {pinned && <Gaps p={p} pinned={pinned} reduce={reduce} />}
    </div>
  );
  const note = (
    <p className="mt-4 text-[12px] text-fg-3">
      Snapshot of {insights.teacher}&rsquo;s Insights, {insights.snapshot}. Gaps from across the demo library.
    </p>
  );

  if (!pinned) {
    return (
      <section id="teachers" aria-labelledby="pulse-title" className="scroll-mt-16 py-20 sm:py-28">
        <div className="mx-auto max-w-[760px] px-4 sm:px-8">
          {heading}
          <p className="mt-4 text-[15.5px] text-fg-2">What teachers see in Insights.</p>
          <div className="mt-10">{canvas}</div>
          {note}
        </div>
      </section>
    );
  }

  return (
    <section id="teachers" ref={ref} aria-labelledby="pulse-title" className="relative h-[380vh]">
      <div className="sticky top-0 flex h-[100dvh] items-center">
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] items-center gap-16 px-8">
          <div>
            {heading}
            <ol className="mt-10 space-y-5">
              {BEATS.map((b, i) => (
                <li key={b.title} className="flex gap-4">
                  <span className={`mt-[9px] h-px shrink-0 transition-all duration-500 ${i === beat ? 'w-10 bg-[var(--thread)]' : 'w-4 bg-border-strong'}`} aria-hidden />
                  <div>
                    <p className={`text-[17px] font-semibold tracking-[-0.015em] transition-colors duration-500 ${i === beat ? 'text-fg' : 'text-fg-3'}`}>{b.title}</p>
                    <motion.p initial={false} animate={{ opacity: i === beat ? 1 : 0, height: i === beat ? 'auto' : 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden text-[14px] text-fg-2">
                      <span className="block pt-1">{b.body}</span>
                    </motion.p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10">{note}</div>
          </div>
          <div className="pb-24">{canvas}</div>
        </div>
      </div>
    </section>
  );
}
