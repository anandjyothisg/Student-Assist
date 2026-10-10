// Usage: node shoot.js <outDir> [--roles=student,teacher] [--widths=1440,390] [--themes=dark,light] [--auth]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP = (process.env.E2E_APP || 'http://localhost:5173/');
const API = (process.env.E2E_API || 'http://localhost:8000/api/v1');
const NAV = {
  student: [['Home','home'], ['AI Assistant','assistant'], ['Study Materials','documents'], ['My Courses','courses'], ['Notebook','notebook']],
  teacher: [['My Courses','academic'], ['Class Insights','analytics'], ['AI Assistant','assistant']],
  admin: [['System Status','dashboard'], ['Users','accounts'], ['Courses','academic'], ['Class Insights','analytics'], ['AI Assistant','assistant']],
};
const ACC = { student: ['student@aurastudy.demo','AuraStudy#2026'], teacher: ['teacher@aurastudy.demo','AuraTeach#2026'], admin: ['admin@aurastudy.demo','AuraAdmin#2026'] };
const HEIGHTS = { 1440: 900, 1280: 800, 1024: 768, 768: 1024, 390: 844, 360: 740 };

const args = Object.fromEntries(process.argv.slice(3).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const out = process.argv[2] || 'shots';
const roles = (args.roles || 'student,teacher,admin').split(',').filter(Boolean);
const widths = (args.widths || '1440,1280,1024,768,390,360').split(',').map(Number);
const themes = (args.themes || 'dark,light').split(',');
fs.mkdirSync(out, { recursive: true });

const report = [];

async function overflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const res = { docScroll: document.documentElement.scrollWidth - vw, offenders: [] };
    document.querySelectorAll('main, main *').forEach((m) => {
      const st = getComputedStyle(m);
      if (!/(auto|scroll)/.test(st.overflowX) && m.tagName !== 'MAIN') return;
      if (m.closest('pre, .table-wrap, [class*="overflow-x-auto"], table') && m.tagName !== 'MAIN') return;
      if (m.scrollWidth - m.clientWidth > 1 && m.matches('main, main > div, main > div > div')) res.offenders.push(`SCROLL ${m.tagName.toLowerCase()} +${m.scrollWidth - m.clientWidth}px`);
    });
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.position === 'fixed' && r.right <= vw + 1) continue;
      if (r.right > vw + 1 || r.left < -1) {
        // skip if an ancestor clips it
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) {
          const ps = getComputedStyle(p);
          if (/(auto|hidden|scroll|clip)/.test(ps.overflowX)) {
            const pr = p.getBoundingClientRect();
            if (pr.right <= vw + 1 && pr.left >= -1) { clipped = true; break; }
          }
          p = p.parentElement;
        }
        if (!clipped) res.offenders.push(`${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 60)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
      if (res.offenders.length > 6) break;
    }
    return res;
  });
}

async function tokens(role) {
  const r = await fetch(`${API}/auth/login/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ACC[role][0], password: ACC[role][1] }),
  });
  const j = await r.json();
  if (!j.access) throw new Error('login failed ' + JSON.stringify(j));
  return j;
}

async function makePage(browser, w, theme, tok) {
  const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHTS[w] || 900 }, deviceScaleFactor: 1, hasTouch: w < 768, isMobile: false });
  await ctx.addInitScript(([theme, tok]) => {
    if (!sessionStorage.getItem('__init')) {
      sessionStorage.setItem('__init', '1');
      localStorage.setItem('theme', theme);
      if (tok) { localStorage.setItem('accessToken', tok.access); localStorage.setItem('refreshToken', tok.refresh); }
      else { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); }
    }
  }, [theme, tok]);
  const page = await ctx.newPage();
  const log = { console: [], failed: [] };
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', e => log.console.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('response', r => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(/https?:\/\/localhost:\d+/, '')}`); });
  page.on('requestfailed', r => log.failed.push(`FAILED ${r.url()}`));
  return { ctx, page, log };
}

async function snap(page, log, name) {
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  const ov = await overflow(page);
  report.push({ name, console: [...log.console], failed: [...log.failed], overflow: ov });
  log.console.length = 0; log.failed.length = 0;
}

(async () => {
  const browser = await chromium.launch();
  if (args.auth) {
    for (const theme of themes) for (const w of widths) {
      const { ctx, page, log } = await makePage(browser, w, theme, null);
      await page.goto(APP); await page.waitForTimeout(1200);
      await snap(page, log, `auth-login-${theme}-${w}`);
      for (const [label, key] of [['Create an account', 'register'], ['Forgot password', 'forgot']]) {
        await page.goto(APP); await page.waitForTimeout(900);
        const l = page.getByText(new RegExp(label, 'i')).first();
        if (await l.count()) { await l.click(); await page.waitForTimeout(700); await snap(page, log, `auth-${key}-${theme}-${w}`); }
      }
      await ctx.close();
    }
  }
  for (const role of roles) {
    const tok = await tokens(role);
    for (const theme of themes) for (const w of widths) {
      const { ctx, page, log } = await makePage(browser, w, theme, tok);
      for (const [label, tab] of NAV[role]) {
        await page.goto(APP + '#/' + tab); await page.waitForTimeout(2200);
        await snap(page, log, `${role}-${label.toLowerCase()}-${theme}-${w}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.filter(r => r.error || r.console?.length || r.failed?.length || r.overflow?.docScroll > 0 || r.overflow?.offenders?.length);
  for (const b of bad) console.log(b.name, JSON.stringify({ e: b.error, c: b.console, f: b.failed, o: b.overflow }));
  console.log(`done: ${report.length} shots, ${bad.length} with issues`);
})();
