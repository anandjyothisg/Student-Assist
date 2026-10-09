import { useSyncExternalStore } from 'react';

/** Subscribe to a CSS media query. SSR-safe default is `false`. */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below Tailwind's `md` breakpoint (768px). */
export const useIsMobile = () => useMediaQuery('(max-width: 767.98px)');
