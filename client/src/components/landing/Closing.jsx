import React, { useEffect, useRef } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Brand } from '../ui/BrandMark';
import { RAG } from './data';
import { EASE, inView, reveal, stagger } from './motion';
import { Knot } from './Thread';

/* Facts you can check in the repo, as numbers rather than paragraphs. */
const STATS = [
  { value: 479, decimals: 0, label: 'passages indexed', note: 'across the six demo courses', big: true },
  { value: RAG.maxDistance, decimals: 2, label: 'relevance cut-off', note: 'past it, the assistant declines' },
  { value: 16, decimals: 0, label: 'permission tests', note: 'roles enforced by the API' },
  { value: 0, decimals: 0, label: 'outside AI services', note: 'model and embeddings run locally' },
];
const STACK = ['llama3.2 via Ollama', 'bge-small embeddings', 'Streaming answers', 'Passages shown if the model is down'];

function CountUp({ value, decimals }) {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!seen || reduce || value === 0) { el.textContent = value.toFixed(decimals); return undefined; }
    const c = animate(0, value, { duration: 1.6, ease: EASE, onUpdate: (v) => { el.textContent = v.toFixed(decimals); } });
    return () => c.stop();
  }, [seen, reduce, value, decimals]);
  return <span ref={ref} className="tabular-nums">{(0).toFixed(decimals)}</span>;
}

/* One cell per indexed passage; they light up in sequence when the tile scrolls in. */
function PassageField({ count }) {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  return (
    <div ref={ref} aria-hidden className={`passage-field mt-6 ${seen ? 'is-lit' : ''}`}>
      {Array.from({ length: count }, (_, i) => <span key={i} style={{ '--i': i }} />)}
    </div>
  );
}

export function UnderTheHood() {
  return (
    <section aria-labelledby="hood-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">Under the hood</p>
        <h2 id="hood-title" className="hero-title mt-4 text-[2.4rem] sm:text-[3.25rem]">Built to be checked.</h2>
        <motion.ul {...inView} variants={stagger(0.08)} className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-[auto_auto]">
          {STATS.map((st) => (
            <motion.li
              key={st.label}
              variants={reveal}
              className={`stat-tile relative flex flex-col justify-between overflow-hidden p-5 sm:p-6 ${st.big ? 'col-span-2 lg:row-span-2 lg:min-h-[340px]' : 'min-h-[150px]'}`}
            >
              <span aria-hidden className="stat-thread" />
              <p className={`font-serif leading-none text-fg ${st.big ? 'text-[5rem] sm:text-[7.5rem]' : 'text-[3rem] sm:text-[3.6rem]'}`}>
                <CountUp value={st.value} decimals={st.decimals} />
              </p>
              {st.big && <PassageField count={st.value} />}
              <div className="mt-6">
                <p className="text-[14.5px] font-semibold text-fg">{st.label}</p>
                <p className="mt-0.5 text-[12.5px] text-fg-3">{st.note}</p>
              </div>
            </motion.li>
          ))}
          <motion.li variants={reveal} className="flex flex-wrap content-center gap-2">
            {STACK.map((t) => (
              <span key={t} className="rounded-full border border-border px-3.5 py-1.5 text-[12.5px] text-fg-2">{t}</span>
            ))}
          </motion.li>
        </motion.ul>
      </div>
    </section>
  );
}

export function Closing({ onStart }) {
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby="close-title" className="relative overflow-hidden pb-28 pt-16 sm:pb-36">
      <div aria-hidden className="close-glow pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[70%]" />
      <div className="mx-auto flex max-w-[900px] flex-col items-center px-4 text-center sm:px-8">
        <motion.h2
          id="close-title"
          className="hero-title text-[2.75rem] leading-[1.04] sm:text-[4.25rem] lg:text-[5rem]"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -15% 0px' }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          Bring the syllabus.
          <br />
          <em className="text-accent">We&rsquo;ll bring the sources.</em>
        </motion.h2>

        {/* The thread comes down and ties off on the button. */}
        <div aria-hidden className="relative mt-10 flex h-24 w-px flex-col items-center">
          <motion.span
            className="block w-px flex-1 origin-top bg-[var(--thread)]"
            initial={reduce ? false : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
          />
          <Knot pulse className="-mb-[3px]" />
        </div>

        <Button size="xl" iconRight={ArrowRight} onClick={() => onStart('register')}>Create account</Button>
        <p className="mt-5 text-[14px] text-fg-3">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onStart('login')}
            className="rounded-sm font-medium text-fg-2 underline decoration-border-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-fg"
          >
            Sign in
          </button>
        </p>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-4">
          <Brand />
          <span className="text-[12.5px] text-fg-3">© {new Date().getFullYear()} AuraStudy</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-fg-3">
          <a href="#method" className="transition-colors hover:text-fg">How it works</a>
          <a href="#lab" className="transition-colors hover:text-fg">Try it</a>
          <a href="#roles" className="transition-colors hover:text-fg">Who it&rsquo;s for</a>
          <a href="#top" className="transition-colors hover:text-fg">Back to top</a>
        </nav>
      </div>
    </footer>
  );
}
