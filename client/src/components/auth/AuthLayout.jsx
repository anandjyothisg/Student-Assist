import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Quote } from 'lucide-react';
import { Brand } from '../ui/BrandMark';

/** Static product vignette for the brand panel — shows what the app does at a glance. */
function AnswerPreview() {
  return (
    <div className="w-full max-w-[400px] rounded-xl border border-border bg-surface p-5 shadow-lg">
      <p className="text-[13px] font-medium text-fg-3">You asked</p>
      <p className="mt-1 text-[15px] font-semibold text-fg">Why is quicksort O(n²) in the worst case?</p>
      <div className="my-4 h-px bg-border" />
      <p className="text-[13.5px] leading-relaxed text-fg-2">
        When the pivot is always the smallest or largest element, each partition removes only one item, so the
        recursion depth grows to <span className="font-mono text-[12.5px] text-fg">n</span> and the comparisons sum to
        roughly <span className="font-mono text-[12.5px] text-fg">n²/2</span>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-accent-dim px-2 py-1 text-[11.5px] font-medium text-accent">
          <BookOpen className="size-3" aria-hidden /> Lecture 7 · Sorting · p. 12
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-subtle px-2 py-1 text-[11.5px] font-medium text-fg-3">
          CS-301 notes · p. 48
        </span>
      </div>
    </div>
  );
}

export function AuthLayout({ children }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 sm:py-8">
        <Brand />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
        <p className="text-center text-xs text-fg-3 lg:text-left">© {new Date().getFullYear()} AuraStudy</p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-border bg-subtle lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: 'radial-gradient(var(--border-hover) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 60% 40%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 60% 40%, black, transparent)',
          }}
        />
        <div className="relative flex max-w-[480px] flex-col gap-10">
          <div>
            <Quote className="mb-4 size-6 text-accent" aria-hidden />
            <h2 className="hero-title text-[2.5rem] xl:text-[2.875rem]">
              Answers grounded in <em className="text-accent">your</em> course materials.
            </h2>
            <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-fg-2">
              Ask anything about your lectures and readings. Every answer cites the page it came from, and the good
              ones go straight into your notebook.
            </p>
          </div>
          <AnswerPreview />
        </div>
      </aside>
    </div>
  );
}

/** Heading block + entry animation shared by every auth step. */
export function AuthStep({ title, description, onBack, backLabel = 'Back', children, footer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[13px] font-medium text-fg-3 transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel}
        </button>
      )}
      <h1 className="hero-title text-[2.25rem] sm:text-[2.5rem]">{title}</h1>
      {description && <p className="mt-2 text-[14px] leading-relaxed text-fg-3">{description}</p>}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6 text-center text-[13.5px] text-fg-3">{footer}</div>}
    </motion.div>
  );
}

export function TextLink({ children, ...props }) {
  return (
    <button
      type="button"
      className="rounded-sm font-medium text-fg underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-fg"
      {...props}
    >
      {children}
    </button>
  );
}

export const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
