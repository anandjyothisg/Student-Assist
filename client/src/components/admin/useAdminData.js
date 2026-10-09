import { useCallback, useEffect, useState } from 'react';
import api from '../auth/api';

/** Fetch every page of a paginated list endpoint (page_size 100, max 10 pages). */
export async function fetchAll(path, params = {}) {
  const out = [];
  let page = 1;
  for (; page <= 10; page++) {
    const res = await api.get(path, { params: { ...params, page, page_size: 100 } });
    const data = res.data;
    const items = data.results ?? data;
    out.push(...items);
    if (!data.next || !Array.isArray(data.results)) break;
  }
  return out;
}

/** Small async-state helper: { data, state: 'loading'|'ready'|'error', reload }. */
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    setState('loading');
    try {
      setData(await run());
      setState('ready');
    } catch {
      setState('error');
    }
  }, [run]);

  useEffect(() => { reload(); }, [reload]);
  return { data, state, reload };
}
