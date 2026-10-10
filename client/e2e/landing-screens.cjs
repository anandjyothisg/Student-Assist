// Usage: node landing-shoot.js <outDir> [--widths=1440] [--themes=dark] [--reduce] [--only=hero,problem]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP = (process.env.E2E_APP || 'http://localhost:5173/');
const HEIGHTS = { 1920: 1080, 1440: 900, 1280: 800, 1024: 768, 768: 1024, 390: 844, 360: 740 };
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const out = process.argv[2];
const widths = (args.widths || '1440').split(',').map(Number);
const themes = (args.themes || 'dark').split(',');
const only = args.only ? new Set(args.only.split(',')) : null;
fs.mkdirSync(out, { recursive: true });
const report = [];
const want = (k) => !only || only.has(k);

async function overflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right > vw + 1 || r.left < -1) {
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) {
          if (/(auto|hidden|scroll|clip)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; }
          p = p.parentElement;
        }
        if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 50)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
      if (offenders.length > 5) break;
    }
    return { docScroll: document.documentElement.scrollWidth - vw, offenders };
  });
}

(async () => {
  const browser = await chromium.launch();
  for (const theme of themes) for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHTS[w] || 900 }, deviceScaleFactor: 1, hasTouch: w < 768, reducedMotion: args.reduce ? 'reduce' : 'no-preference' });
    await ctx.addInitScript((t) => { localStorage.setItem('theme', t); localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); }, theme);
    const page = await ctx.newPage();
    const log = { console: [], failed: [] };
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 220)}`); });
    page.on('pageerror', (e) => log.console.push('pageerror: ' + e.message.slice(0, 220)));
    page.on('response', (r) => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.url().replace(/https?:\/\/localhost:\d+/, '')}`); });
    page.on('requestfailed', (r) => log.failed.push(`FAILED ${r.url()}`));
    const tag = `${theme}-${w}${args.reduce ? '-reduce' : ''}`;
    const snap = async (name) => {
      await page.screenshot({ path: path.join(out, `${name}-${tag}.png`) });
      report.push({ name: `${name}-${tag}`, console: [...log.console], failed: [...log.failed], overflow: await overflow(page) });
      log.console.length = 0; log.failed.length = 0;
    };
    const scrollTo = async (y, wait = 900) => { await page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y); await page.waitForTimeout(wait); };
    const top = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect().top + window.scrollY : null; }, sel);
    const pinned = async (sel, frac) => page.evaluate(([s, f]) => { const el = document.querySelector(s); const t = el.getBoundingClientRect().top + window.scrollY; return t + (el.offsetHeight - window.innerHeight) * f; }, [sel, frac]);

    await page.goto(APP); await page.waitForSelector('#top');
    await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
    if (want('hero')) {
      await page.waitForTimeout(1600); await snap('01-hero-early');
      await page.waitForTimeout(4600); await snap('02-hero-cited');
    }
    if (want('band')) {
      const bt = await top('[aria-labelledby="band-title"]');
      const vh = HEIGHTS[w] || 900;
      for (const [k, off] of [['a', 0.15], ['b', 0.55]]) { await scrollTo(bt - vh * 0.1 + vh * off, 1500); await snap(`02b-band-${k}`); }
    }
    if (want('problem')) {
      for (const f of [0.05, 0.45, 0.95]) { await scrollTo(await pinned('[aria-labelledby="problem-title"]', f), 1000); await snap(`03-problem-${Math.round(f * 100)}`); }
    }
    if (want('method')) {
      const isPinned = await page.evaluate(() => document.querySelector('#method').offsetHeight > window.innerHeight * 2);
      if (isPinned) for (const f of [0.1, 0.35, 0.6, 0.9]) { await scrollTo(await pinned('#method', f), 1100); await snap(`04-method-${Math.round(f * 100)}`); }
      else { const t = await top('#method'); for (let i = 0; i < 4; i++) { await scrollTo(t + i * (HEIGHTS[w] || 900) * 0.9, 1000); await snap(`04-method-m${i}`); } }
    }
    if (want('lab')) {
      await scrollTo((await top('#lab')) - 10, 900); await snap('05-lab-idle');
      const labTop = await top('.lab-shell');
      await page.locator('#lab').getByRole('button', { name: 'What is a primary key?' }).click();
      await page.waitForTimeout(5200);
      await scrollTo(labTop - 80, 400);
      const chip = page.locator('.lab-answer button.cite-chip').first();
      if (await chip.count()) await chip.click();
      await page.waitForTimeout(1400); await snap('06-lab-answer-cited');
      await page.locator('#lab').getByRole('button', { name: 'What is gradient descent?' }).click();
      await page.waitForTimeout(9000); await scrollTo(labTop - 80, 400); await snap('07-lab-gd');
      await page.locator('#lab').getByRole('button', { name: /World Cup/ }).click();
      await page.waitForTimeout(2600); await snap('08-lab-refusal');
    }
    if (want('pulse')) {
      const pin = await page.evaluate(() => document.querySelector('#teachers').offsetHeight > window.innerHeight * 2.5);
      if (pin) for (const f of [0.14, 0.4, 0.64, 0.96]) { await scrollTo(await pinned('#teachers', f), 1300); await snap(`08a-pulse-${Math.round(f * 100)}`); }
      else { const t = await top('#teachers'); for (let i = 0; i < 3; i++) { await scrollTo(t + i * (HEIGHTS[w] || 900) * 0.8, 2200); await snap(`08a-pulse-m${i}`); } }
    }
    if (want('shelf')) {
      await scrollTo((await top('[aria-labelledby="shelf-title"]')) - 160, 2200); await snap('08b-shelf');
    }
    if (want('roles')) {
      await scrollTo((await top('#roles')) - 10, 1000); await snap('09-roles-student');
      await page.getByRole('tab', { name: 'Teachers' }).click(); await page.waitForTimeout(900); await snap('10-roles-teacher');
    }
    if (want('close')) {
      await scrollTo((await top('#hood-title')) - 140, 1000); await snap('11-hood');
      await scrollTo(1e7, 1400); await snap('12-close');
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.filter((r) => r.console.length || r.failed.length || r.overflow.docScroll > 0 || r.overflow.offenders.length);
  for (const b of bad) console.log(b.name, JSON.stringify({ c: b.console, f: b.failed, o: b.overflow }));
  console.log(`done: ${report.length} shots, ${bad.length} with issues`);
})();
