// Landing page performance on a throttled CPU (default 4x) with a scripted scroll.
// Reports FCP, LCP, CLS, long tasks and frame rate. Usage: node e2e/landing-perf.cjs [cpuRate]
const { chromium } = require('playwright');
const APP = process.env.E2E_APP || 'http://localhost:5173/';
const RATE = Number(process.argv[2] || 4);

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => {
      localStorage.removeItem('accessToken');
      window.__perf = { lcp: 0, cls: 0, long: [], frames: [] };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push(e.duration); }).observe({ type: 'longtask', buffered: true });
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    await page.goto(APP, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const load = await page.evaluate(() => ({
      fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
      lcp: Math.round(window.__perf.lcp),
      longBeforeScroll: window.__perf.long.length,
    }));
    // Scroll the whole page with the mouse wheel while sampling frames.
    await page.evaluate(() => {
      window.__perf.frames = [];
      let last = performance.now();
      const tick = (t) => { window.__perf.frames.push(t - last); last = t; if (window.__perf.sampling) requestAnimationFrame(tick); };
      window.__perf.sampling = true;
      requestAnimationFrame(tick);
    });
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 120) { await page.mouse.wheel(0, 120); await page.waitForTimeout(16); }
    await page.waitForTimeout(800);
    const scroll = await page.evaluate(() => {
      window.__perf.sampling = false;
      const f = window.__perf.frames.slice(5);
      const fps = f.length ? 1000 / (f.reduce((a, b) => a + b, 0) / f.length) : 0;
      const janky = f.filter((d) => d > 50).length;
      return { fps: Math.round(fps), janky, frames: f.length, cls: Number(window.__perf.cls.toFixed(3)), longTasks: window.__perf.long.length, longMs: Math.round(window.__perf.long.reduce((a, b) => a + b, 0)), reached: Math.round(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 4 };
    });
    console.log(`${w}px  CPU ${RATE}x  FCP ${load.fcp}ms  LCP ${load.lcp}ms  CLS ${scroll.cls}  long tasks ${scroll.longTasks} (${scroll.longMs}ms)  scroll ${scroll.fps} fps avg, ${scroll.janky}/${scroll.frames} frames >50ms  reached end: ${scroll.reached}`);
    await ctx.close();
  }
  await browser.close();
})();
