import { transform, useTransform } from 'framer-motion';

/* Shared motion tokens for the landing page. One easing curve and one spring keep every scene feeling related. */

export const EASE = [0.16, 1, 0.3, 1];
export const SPRING = { stiffness: 120, damping: 24, mass: 0.6 };
export const SOFT_SPRING = { stiffness: 70, damping: 20, mass: 0.8 };

export const reveal = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

export const stagger = (gap = 0.08, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

export const inView = { initial: 'hidden', whileInView: 'show', viewport: { once: true, margin: '0px 0px -12% 0px' } };

/** Real document titles use an em dash ("Notes — Lecture Notes"); the page typesets them with a middot instead. */
export const tidyTitle = (t = '') => t.replace(/\s+[—–]\s+/g, ' · ');

/** Strip the running footer ("Ravi Menon · CS-305 … Page 1 of 4") that PDF extraction leaves inside passages. */
export const tidyExcerpt = (t = '') => t.replace(/\s*[A-Z][a-z]+ [A-Z][a-z]+ · [A-Z]{2}-\d{3} [^·]*?Page \d+ of \d+\s*/g, ' ').trim();

/*
 * Scroll-linked ranges always go through the function form of useTransform.
 * The array form can be promoted to a hardware-accelerated scroll timeline,
 * which does not clamp sub-ranges like [0.3, 0.4] (opacity drifted back up
 * past the end of its range). The function form keeps values clamped.
 */
export function useRange(value, input, output) {
  return useTransform(value, (v) => transform(v, input, output));
}
