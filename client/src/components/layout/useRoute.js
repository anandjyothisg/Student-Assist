import { useEffect, useState } from 'react';
import { readRoute } from './navConfig';

/** Current hash route `{ tab, params }`, kept in sync with navigation. */
export function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    window.addEventListener('routechange', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
      window.removeEventListener('routechange', update);
    };
  }, []);
  return route;
}
