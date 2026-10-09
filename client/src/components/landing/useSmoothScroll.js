import { useEffect } from 'react';

/*
 * Gentle inertia for mouse-wheel scrolling on the landing page only.
 * It eases the wheel delta toward a target with requestAnimationFrame and
 * writes window scroll, so native scrolling, the scrollbar, keyboard, touch,
 * anchors and find-in-page keep working. Off for touch, coarse pointers and
 * prefers-reduced-motion.
 */
export function useSmoothScroll() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return undefined;

    let target = window.scrollY;
    let current = target;
    let raf = 0;
    const max = () => document.documentElement.scrollHeight - window.innerHeight;

    const tick = () => {
      current += (target - current) * 0.11;
      if (Math.abs(target - current) < 0.4) current = target;
      window.scrollTo({ top: current, behavior: 'instant' });
      raf = current === target ? 0 : requestAnimationFrame(tick);
    };

    const scrollsInside = (el, dy) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) {
          if ((dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight) || (dy < 0 && n.scrollTop > 0)) return true;
        }
      }
      return false;
    };

    const onWheel = (e) => {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const dy = e.deltaY * unit;
      if (scrollsInside(e.target, dy)) return;
      e.preventDefault();
      if (!raf) current = window.scrollY;
      target = Math.max(0, Math.min(max(), (raf ? target : window.scrollY) + dy));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    /* Anything else that scrolls (keys, scrollbar, anchors) resets the target. */
    const onScroll = () => { if (!raf) { target = window.scrollY; current = target; } };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
}
