// Landing <-> auth <-> app routing checks. Usage: node landing-flow.js [width]
const { chromium } = require('playwright');
const APP = (process.env.E2E_APP || 'http://localhost:5173/');
const W = Number(process.argv[2] || 1440);
const results = [];
const check = (name, ok, note = '') => { results.push({ name, ok: !!ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  · ' + note : ''}`); };
const visible = (loc) => loc.isVisible().catch(() => false);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: W < 768 ? 844 : 900 }, hasTouch: W < 768 });
  await ctx.addInitScript(() => { if (!sessionStorage.__i) { sessionStorage.__i = 1; localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  const wait = (ms) => page.waitForTimeout(ms);
  const heroHeading = () => page.getByRole('heading', { level: 1, name: /Ask your course/ });

  await page.goto(APP); await wait(1200);
  check('Root shows the landing page', await visible(heroHeading()));
  check('Landing has a document title', /AuraStudy/.test(await page.title()), await page.title());

  // Nav anchors scroll without touching the hash router
  if (W >= 768) {
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Try it' }).click();
  } else {
    await page.getByRole('button', { name: 'Open menu' }).click(); await wait(300);
    check('Mobile menu opens', await visible(page.locator('#landing-menu')));
    await page.locator('#landing-menu').getByRole('link', { name: 'Try it' }).click();
  }
  await wait(1600);
  const labTop = await page.evaluate(() => document.getElementById('lab').getBoundingClientRect().top);
  check('"Try it" scrolls to the demo', Math.abs(labTop) < 120, `lab top ${Math.round(labTop)}px`);
  check('Anchor click keeps the URL clean', !page.url().includes('#lab'), page.url());

  // Theme toggle
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click(); await wait(300);
  const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  check('Theme toggle switches theme', before !== after);
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click(); await wait(200);

  // Hero controls
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await wait(500);
  await page.getByRole('button', { name: 'Pause the answer loop' }).click(); await wait(200);
  check('Hero loop can be paused', await visible(page.getByRole('button', { name: 'Play the answer loop' })));
  await page.getByRole('button', { name: /Example 2 of 3/ }).click(); await wait(400);
  check('Hero example selector works', (await page.getByRole('button', { name: /Example 2 of 3/ }).getAttribute('aria-pressed')) === 'true');

  // Role tabs (keyboard)
  await page.getByRole('tab', { name: 'Students' }).focus();
  await page.keyboard.press('ArrowRight'); await wait(500);
  check('Role tabs respond to arrow keys', (await page.getByRole('tab', { name: 'Teachers' }).getAttribute('aria-selected')) === 'true');

  // CTA -> register, back -> landing
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await wait(300);
  await page.locator('#top').getByRole('button', { name: 'Create account' }).click(); await wait(900);
  check('"Create account" opens registration', page.url().endsWith('#/register'), page.url());
  await page.goBack(); await wait(1000);
  check('Back returns to the landing page', await visible(heroHeading()), page.url());

  // Closing "Sign in" -> sign-in screen
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })); await wait(1200);
  await page.locator('section[aria-labelledby="close-title"]').getByRole('button', { name: 'Sign in' }).click(); await wait(900);
  check('Closing "Sign in" opens sign-in', page.url().endsWith('#/signin') && await visible(page.getByText('Welcome back')), page.url());
  check('Sign-in page starts at the top', (await page.evaluate(() => window.scrollY)) === 0);

  // Brand on the auth screen goes home
  await page.getByRole('link', { name: 'AuraStudy home' }).click(); await wait(900);
  check('Auth brand links back to landing', await visible(heroHeading()));

  // Signed-out deep link -> sign in -> lands on that tab
  await page.goto(APP + '#/notebook'); await wait(1000);
  check('Signed-out deep link shows sign-in', await visible(page.getByText('Welcome back')));
  await page.getByLabel('Email').fill('student@aurastudy.demo');
  await page.getByLabel('Password', { exact: true }).fill('AuraStudy#2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForSelector('main#main', { timeout: 20000 }); await wait(2000);
  check('After sign-in the deep-linked tab opens', page.url().includes('#/notebook'), page.url());
  check('No "no access" toast after sign-in', !(await visible(page.getByText("You don't have access"))));

  // Refresh keeps the signed-in app
  await page.reload(); await wait(2500);
  check('Refresh keeps the signed-in app', page.url().includes('#/notebook') && !(await visible(heroHeading())));

  // Sign out -> sign-in screen
  if (W < 768) await page.getByRole('button', { name: 'Account' }).click();
  else await page.locator('aside[aria-label="Primary"] button[aria-haspopup="dialog"]').click();
  await wait(400);
  await page.getByRole('button', { name: 'Sign out' }).last().click(); await wait(1200);
  check('Sign out returns to the landing page', !page.url().includes('#/') && await visible(heroHeading()), page.url());

  // Stored session on #/signin -> app, no error toast
  const tok = await (await fetch(`${process.env.E2E_API || 'http://localhost:8000/api/v1'}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'teacher@aurastudy.demo', password: 'AuraTeach#2026' }) })).json();
  await page.evaluate((t) => { localStorage.setItem('accessToken', t.access); localStorage.setItem('refreshToken', t.refresh); }, tok);
  await page.goto(APP + '#/signin'); await page.reload(); await wait(3000);
  check('Stored session on #/signin opens the app silently', page.url().includes('#/academic') && !(await visible(page.getByText("You don't have access"))), page.url());

  // Signed in + bare URL -> landing page with "Open app"
  await page.goto(APP); await page.reload(); await wait(2500);
  check('Signed-in visit to the bare URL shows the landing page', await visible(heroHeading()), page.url());
  check('Signed-in landing offers "Open app", not sign-in', await visible(page.getByRole('button', { name: 'Open app' }).first()) && !(await visible(page.locator('header').getByRole('button', { name: 'Sign in' }))));
  await page.getByRole('button', { name: 'Open app' }).first().click(); await wait(1500);
  check('"Open app" opens the role home', page.url().includes('#/academic'), page.url());
  await page.goBack(); await wait(1200);
  check('Back from the app returns to the landing page', await visible(heroHeading()), page.url());

  check('No console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
})();
