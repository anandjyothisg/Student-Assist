import { useLayoutEffect } from 'react';
import { useMotionValue } from 'framer-motion';

/*
 * Geometry for the citation thread. Measured with the offsetParent chain rather
 * than getBoundingClientRect, so it stays correct while the stage is tilted or
 * scaled by scroll and pointer transforms. The path lives in a MotionValue, so
 * re-measuring never re-renders React.
 */

function offsetWithin(el, root) {
  let x = 0;
  let y = 0;
  let node = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return node === root ? { x, y } : null;
}

/** Builds a soft S-curve from `fromRef` (right/middle) to `toRef` (left/middle), in `rootRef` coordinates. */
export function useThreadPath(rootRef, fromRef, toRef, deps = [], { bend = 0.5, fromSide = 'end', toSide = 'start', aroundRef = null } = {}) {
  const d = useMotionValue('');
  const ends = useMotionValue(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => {
      const a = fromRef.current;
      const b = toRef.current;
      if (!a || !b) { d.set(''); return; }
      const pa = offsetWithin(a, root);
      const pb = offsetWithin(b, root);
      if (!pa || !pb) { d.set(''); return; }
      const x1 = pa.x + (fromSide === 'end' ? a.offsetWidth : fromSide === 'center' ? a.offsetWidth / 2 : 0);
      const y1 = pa.y + (fromSide === 'bottom' ? a.offsetHeight : a.offsetHeight / 2);
      const x2 = pb.x + (toSide === 'end' ? b.offsetWidth : toSide === 'center' || toSide === 'top' ? b.offsetWidth / 2 : 0);
      const y2 = pb.y + (toSide === 'top' ? 0 : b.offsetHeight / 2);
      /* Route around a card: leave the source, drop down the card's left margin, enter the target from the left. */
      const card = aroundRef?.current;
      const pc = card ? offsetWithin(card, root) : null;
      if (pc && y1 < pc.y && y2 > pc.y) {
        const xg = pc.x - 18;
        const r = 14;
        d.set(`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${xg} ${y1 + (pc.y - y1) * 0.35}, ${xg} ${pc.y} V ${y2 - r} Q ${xg} ${y2} ${xg + r} ${y2} H ${x2}`);
        ends.set({ x1, y1, x2, y2 });
        return;
      }
      const vertical = fromSide === 'bottom' || toSide === 'top';
      const k = vertical ? Math.max(40, Math.abs(y2 - y1) * bend) : Math.max(40, Math.abs(x2 - x1) * bend);
      d.set(vertical
        ? `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`);
      ends.set({ x1, y1, x2, y2 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    if (fromRef.current) ro.observe(fromRef.current);
    if (toRef.current) ro.observe(toRef.current);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { d, ends };
}

