// Keyboard pass: tab through key screens and check every focused element has a
// visible focus indicator and an accessible name. Usage: node e2e/keyboard.cjs
const { chromium } = require('playwright');
const APP = process.env.E2E_APP || 'http://localhost:5173/';
const API = process.env.E2E_API || 'http://localhost:8000/api/v1';

async function pass(page, label, tabs) {
  const issues = [];
  const seen = [];
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const st = getComputedStyle(el);
      const visible = (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) || st.boxShadow !== 'none';
      const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value || el.getAttribute('placeholder') || '').trim();
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), name: name.slice(0, 40), visible, size: [Math.round(r.width), Math.round(r.height)] };
    });
    if (!info) continue;
    seen.push(info);
    if (!info.visible) issues.push(`no visible focus: <${info.tag}> "${info.name}"`);
    if (!info.name) issues.push(`no accessible name: <${info.tag}>`);
  }
  console.log(`${issues.length ? 'FAIL' : 'PASS'}  ${label}: ${seen.length} focus stops${issues.length ? '\n      ' + [...new Set(issues)].join('\n      ') : ''}`);
  return issues.length === 0;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const results = [];
  await page.goto(APP); await page.waitForTimeout(1500);
  results.push(await pass(page, 'Landing page', 25));
  await page.goto(`${APP}#/signin`); await page.waitForTimeout(1000);
  results.push(await pass(page, 'Sign in', 8));

  const tok = await (await fetch(`${API}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'student@aurastudy.demo', password: 'AuraStudy#2026' }) })).json();
  await page.evaluate((t) => { localStorage.setItem('accessToken', t.access); localStorage.setItem('refreshToken', t.refresh); }, tok);
  await page.goto(`${APP}#/assistant`); await page.reload(); await page.waitForTimeout(2500);
  results.push(await pass(page, 'Student: Ask', 20));
  await page.goto(`${APP}#/documents`); await page.waitForTimeout(2000);
  results.push(await pass(page, 'Student: Sources', 20));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} screens clean`);
})();
