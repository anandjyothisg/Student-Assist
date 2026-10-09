import { animate } from 'framer-motion';
import { EASE } from './motion';

/*
 * In-page navigation with the page's own easing. Native smooth scrolling gets
 * cancelled when content above changes height mid-flight (pinned scenes do),
 * so the position is animated directly and re-aimed at the element each frame.
 */
let current = null;

export function scrollToElement(el, offset = parseFloat(getComputedStyle(el).scrollMarginTop) || 0) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targetY = () => el.getBoundingClientRect().top + window.scrollY - offset;
  current?.stop();
  if (reduce) { window.scrollTo({ top: targetY(), behavior: 'instant' }); return; }
  const from = window.scrollY;
  const distance = Math.abs(targetY() - from);
  current = animate(0, 1, {
    duration: Math.min(1.6, 0.6 + distance / 6000),
    ease: EASE,
    onUpdate: (t) => window.scrollTo({ top: from + (targetY() - from) * t, behavior: 'instant' }),
    onComplete: () => { current = null; },
  });
}
