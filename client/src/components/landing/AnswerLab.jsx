import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { CircleSlash, RotateCcw, X } from 'lucide-react';
import { Markdown } from '../ui/Markdown';
import { ANSWERS, LAB_ORDER, RAG, RECORDED } from './data';
import { EASE, tidyExcerpt, tidyTitle } from './motion';
import { Knot, ThreadPath } from './Thread';

/*
 * Act four: the visitor pulls the thread. Pick a question, watch retrieval rank
 * real passages, read the recorded answer as it streams, then click a citation
 * to tie it to its source. The off-topic question shows the refusal path.
 */

const STREAM_WPS = 55; // replay speed, close to llama3.2 on the demo laptop once warm

function useStream(text, run, reduce) {
  const words = text.split(/(\s+)/);
  const [n, setN] = useState(reduce ? words.length : 0);
  useEffect(() => {
    if (!run) return undefined;
    if (reduce) { setN(words.length); return undefined; }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      setN(Math.min(words.length, i));
      if (i >= words.length) clearInterval(id);
    }, (1000 / STREAM_WPS) * 1.5);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, run, reduce]);
  return { shown: words.slice(0, n).join(''), done: n >= words.length };
}

/** Measures a thread from a citation chip (inside the answer) to the source panel, in lab coordinates. */
function useLabThread(rootRef, chipIndex, panel, key) {
  const d = useMotionValue('');
  const [pts, setPts] = useState(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || chipIndex == null) { d.set(''); setPts(null); return undefined; }
    const measure = () => {
      const chip = root.querySelector(`.lab-answer button.cite-chip[aria-label="Source ${chipIndex}"]`)
        || root.querySelector(`[data-cite-row="${chipIndex}"]`);
      if (!chip || !panel) { d.set(''); return; }
      const r = root.getBoundingClientRect();
      const a = chip.getBoundingClientRect();
      const b = panel.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - r.left;
      const y1 = a.top + a.height / 2 - r.top;
      const sideBySide = b.left >= a.right - 4;
      const x2 = sideBySide ? b.left - r.left : b.left + 28 - r.left;
      const y2 = sideBySide ? b.top + 30 - r.top : b.top - r.top;
      // Side by side, the thread runs like a seam: out of the chip, along the
      // gutter in front of the source panel, then in. It never crosses text.
      const xd = x2 - 12;
      const rad = Math.min(10, Math.abs(y2 - y1) / 2);
      const s = y2 < y1 ? -1 : 1;
      const path = sideBySide
        ? `M ${x1 + a.width / 2} ${y1} H ${xd - rad} Q ${xd} ${y1} ${xd} ${y1 + s * rad} V ${y2 - s * rad} Q ${xd} ${y2} ${xd + rad} ${y2} H ${x2}`
        : `M ${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 - 60}, ${x2} ${y2}`;
      d.set(path);
      setPts({ x1, y1, x2, y2 });
    };
    const id = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, [rootRef, panel, chipIndex, key, d]);
  return { d, pts };
}

export function AnswerLab() {
  const reduce = !!useReducedMotion();
  const [id, setId] = useState(null);
  const [stage, setStage] = useState('idle'); // idle → retrieving → answering
  const [cite, setCite] = useState(null);
  const rootRef = useRef(null);
  const [panelEl, setPanelEl] = useState(null);
  const progress = useMotionValue(0);

  const a = id ? ANSWERS[id] : null;
  const refused = a?.status === 'not_found';
  const { shown, done } = useStream(a?.answer ?? '', stage === 'answering', reduce);

  useEffect(() => {
    if (stage !== 'retrieving') return undefined;
    const t = setTimeout(() => setStage('answering'), reduce ? 0 : refused ? 1500 : 1300);
    return () => clearTimeout(t);
  }, [stage, refused, reduce]);

  const ask = (next) => {
    setCite(null);
    setId(next);
    setStage('retrieving');
  };

  const source = a && cite != null ? a.citations.find((c) => c.index === cite) : null;
  const { d, pts } = useLabThread(rootRef, source ? cite : null, panelEl, `${id}-${done}`);
  useEffect(() => {
    if (!source) { progress.set(0); return undefined; }
    progress.set(0);
    const c = animate(progress, 1, { duration: reduce ? 0 : 0.8, ease: EASE, delay: reduce ? 0 : 0.15 });
    return () => c.stop();
  }, [source, progress, reduce]);

  return (
    <section id="lab" aria-labelledby="lab-title" className="scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 id="lab-title" className="hero-title text-[2.4rem] sm:text-[3.25rem] lg:text-[3.6rem]">
            Pull the <em className="text-accent">thread</em> yourself.
          </h2>
          <p className="max-w-[38ch] text-[15.5px] leading-relaxed text-fg-2 lg:justify-self-end">
            Real answers from {RECORDED.model.split(' (')[0]}, replayed word for word. Click a citation.
          </p>
        </div>

        <div ref={rootRef} className="lab-shell relative mt-12 grid grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Questions */}
          <div className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <p className="mb-3 text-[12px] font-medium text-fg-3">Ask the demo student&rsquo;s library</p>
            <LayoutGroup id="lab-q">
              <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" role="list">
                {LAB_ORDER.map((key) => {
                  const q = ANSWERS[key];
                  const on = key === id;
                  return (
                    <li key={key} className="shrink-0 lg:shrink">
                      <button
                        type="button"
                        onClick={() => ask(key)}
                        aria-pressed={on}
                        className={`relative w-full rounded-md px-3.5 py-2.5 text-left text-[13.5px] leading-snug transition-colors ${on ? 'text-fg' : 'text-fg-2 hover:bg-subtle hover:text-fg'} max-lg:max-w-[240px] max-lg:whitespace-nowrap`}
                      >
                        {on && <motion.span layoutId="lab-q-active" className="absolute inset-0 rounded-md border border-[var(--thread)] bg-accent-dim" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                        <span className="relative flex items-center gap-2">
                          {q.status === 'not_found' && <CircleSlash className="size-3.5 shrink-0 text-fg-3" aria-hidden />}
                          {q.question}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </LayoutGroup>
          </div>

          {/* Conversation */}
          <div className="relative grid min-h-[520px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="lab-answer min-w-0 p-5 sm:p-7" aria-live="polite" aria-busy={stage === 'retrieving'}>
              {!a && (
                <div className="flex h-full min-h-[440px] flex-col items-start justify-center">
                  <p className="font-serif text-[1.75rem] leading-tight text-fg">Pick a question.</p>
                  <p className="mt-2 text-[14px] text-fg-3">One of them is off-syllabus.</p>
                </div>
              )}
              {a && (
                <div key={id}>
                  <p className="text-[12px] font-medium text-fg-3">Question</p>
                  <p className="mt-1 text-[17px] font-semibold tracking-[-0.01em] text-fg">{a.question}</p>

                  <div className="mt-5">
                    <p className="mb-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
                      <span>{refused ? 'Retrieval' : `Retrieved · top ${a.citations.length}`}</span>
                      {stage === 'retrieving' && <span className="flex items-center gap-1"><span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" /></span>}
                    </p>
                    {refused ? (
                      <motion.div
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-md border border-dashed border-border-strong p-3.5"
                      >
                        <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                          <motion.span
                            className="absolute inset-y-0 left-0 rounded-full bg-fg-3"
                            initial={reduce ? false : { width: '0%' }}
                            animate={{ width: `${(1 - a.nearestDistance) * 100}%` }}
                            transition={{ duration: 1, ease: EASE }}
                          />
                          <span className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${(1 - RAG.maxDistance) * 100}%` }} />
                        </div>
                        <p className="mt-2.5 text-[12.5px] leading-relaxed text-fg-3">
                          Closest passage in the enrolled courses: distance <span className="font-mono text-fg">{a.nearestDistance}</span>.
                          The cut-off is <span className="font-mono text-fg">{RAG.maxDistance}</span>, so nothing qualifies and no answer is generated.
                        </p>
                      </motion.div>
                    ) : (
                      <ol className="space-y-1.5">
                        {a.citations.map((c, i) => (
                          <motion.li
                            key={c.index}
                            initial={reduce ? false : { opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: reduce ? 0 : 0.15 + i * 0.12, duration: 0.45, ease: EASE }}
                          >
                            <button
                              type="button"
                              onClick={() => setCite(c.index)}
                              data-cite-row={c.index}
                              className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-2 py-1 text-left text-[12.5px] transition-colors hover:bg-subtle ${cite === c.index ? 'bg-subtle' : ''}`}
                            >
                              <span className="font-mono text-[11px] text-accent">[{c.index}]</span>
                              <span className="truncate text-fg-2">{tidyTitle(c.document_title)} · p. {c.page_number}</span>
                              <span className="font-mono text-[11px] tabular-nums text-fg-3">{c.score.toFixed(3)}</span>
                            </button>
                          </motion.li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {stage === 'answering' && (
                    <div className="mt-6 border-t border-border pt-5">
                      <p className="mb-2 flex items-center gap-2 text-[12px] font-medium text-fg-3">
                        Answer
                        {done && !refused && <span className="font-mono text-[10.5px] text-fg-3">· written in {a.seconds}s on a laptop</span>}
                      </p>
                      {refused ? (
                        <motion.p
                          initial={reduce ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[14.5px] leading-relaxed text-fg"
                        >
                          {a.answer}
                        </motion.p>
                      ) : (
                        <div className="text-[14.5px]">
                          <Markdown onCite={done ? setCite : undefined}>{shown}</Markdown>
                          {!done && <span className="ml-0.5 inline-block h-4 w-px animate-[cursor-blink_1s_steps(1)_infinite] bg-fg align-middle" aria-hidden />}
                        </div>
                      )}
                      {done && (
                        <button
                          type="button"
                          onClick={() => ask(id)}
                          className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-3 transition-colors hover:text-fg"
                        >
                          <RotateCcw className="size-3.5" aria-hidden /> Replay
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Source panel */}
            <div className="border-t border-border p-5 sm:p-6 xl:border-l xl:border-t-0">
              <AnimatePresence mode="wait" initial={false}>
                {source ? (
                  <motion.aside
                    key={`${id}-${cite}`}
                    ref={setPanelEl}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="lab-source relative p-4"
                    aria-label={`Source ${cite}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-accent">[{source.index}] {source.course_code} · p. {source.page_number}</p>
                      <button type="button" onClick={() => setCite(null)} aria-label="Close source" className="-m-1 rounded-sm p-1 text-fg-3 hover:text-fg"><X className="size-3.5" /></button>
                    </div>
                    <p className="mt-1.5 text-[13px] font-semibold leading-snug text-fg">{tidyTitle(source.document_title)}</p>
                    {source.topic && <p className="mt-0.5 text-[11.5px] text-fg-3">{source.topic}</p>}
                    <p className="mt-3 text-[12.5px] leading-[1.7] text-fg-2">&ldquo;{tidyExcerpt(source.excerpt)}&rdquo;</p>
                    <p className="mt-3 font-mono text-[10.5px] text-fg-3">relevance {source.score.toFixed(3)}</p>
                  </motion.aside>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-[120px] flex-col justify-center text-[12.5px] leading-relaxed text-fg-3">
                    {!(a && refused && stage === 'answering') && <span className="mb-2 block h-px w-10 bg-[var(--thread)]" aria-hidden />}
                    {a && refused && stage === 'answering' ? (
                      <span className="flex flex-col gap-3">
                        <svg viewBox="0 0 120 24" className="h-6 w-[120px] overflow-visible" aria-hidden>
                          <motion.path d="M 0 12 L 86 12" fill="none" stroke="var(--thread)" strokeWidth="1.5" strokeDasharray="3 5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: EASE }} />
                          <motion.g stroke="var(--thread)" strokeWidth="1" fill="none" strokeLinecap="round" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                            <path d="M 86 12 q 8 -2 14 -8" /><path d="M 86 12 q 9 1 16 0" /><path d="M 86 12 q 7 4 12 10" />
                          </motion.g>
                        </svg>
                        Nothing in the enrolled courses to tie this answer to, so there is no answer.
                      </span>
                    ) : a && !refused && done ? 'Click a numbered citation in the answer, or a retrieved passage, to open its source.' : 'Sources open here.'}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Thread from the clicked citation to its source. */}
          {source && pts && (
            <div className="pointer-events-none absolute inset-0 z-[2] hidden xl:block">
              <ThreadPath d={d} progress={progress} />
              <span className="absolute" style={{ left: pts.x1, top: pts.y1 }}><Knot className="-translate-x-1/2 -translate-y-1/2" /></span>
            </div>
          )}
        </div>
        <p className="mt-4 text-[12px] text-fg-3">Recorded {RECORDED.recordedOn} from the demo library, unedited.</p>
      </div>
    </section>
  );
}
