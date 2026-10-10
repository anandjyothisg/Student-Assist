// End-to-end acceptance run against the live stack. Usage: node acceptance.js <outDir> [width] [theme]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP = (process.env.E2E_APP || 'http://localhost:5173/');
const API = (process.env.E2E_API_ROOT || 'http://localhost:8000');
const out = process.argv[2] || 'acceptance';
const W = Number(process.argv[3] || 1440);
const THEME = process.argv[4] || 'light';
const H = W < 500 ? 844 : 900;
const MOBILE = W < 768;
fs.mkdirSync(out, { recursive: true });

const ACC = {
  admin: ['admin@aurastudy.demo', 'AuraAdmin#2026'],
  teacher: ['teacher@aurastudy.demo', 'AuraTeach#2026'],
  student: ['student@aurastudy.demo', 'AuraStudy#2026'],
};
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: MOBILE });
  await ctx.addInitScript((theme) => { if (!sessionStorage.__t) { sessionStorage.__t = 1; localStorage.setItem('theme', theme); } }, THEME);
  const page = await ctx.newPage();
  const errors = [];
  let expect4xx = false;
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(`console: ${m.text().slice(0, 180)}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    const s = r.status();
    if (s >= 500) errors.push(`${s} ${r.request().method()} ${r.url()}`);
    if (s >= 400 && s < 500 && !expect4xx && !r.url().includes('/auth/me/')) errors.push(`${s} ${r.request().method()} ${r.url()}`);
  });
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}-${THEME}-${W}.png`) });
  const wait = (ms) => page.waitForTimeout(ms);

  async function login(role) {
    await page.goto(APP + '#/signin'); await wait(900);
    await page.getByLabel('Email').fill(ACC[role][0]);
    await page.getByLabel('Password', { exact: true }).fill(ACC[role][1]);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForSelector('main#main', { timeout: 20000 });
    await wait(1500);
  }
  async function logout() {
    if (MOBILE) await page.getByRole('button', { name: 'Account' }).click();
    else await page.locator('aside[aria-label="Primary"] button[aria-haspopup="dialog"]').click();
    await wait(400);
    await page.getByRole('button', { name: 'Sign out' }).last().click();
    await page.waitForSelector('h1:has-text("Ask your course")', { timeout: 10000 });
    await wait(500);
  }
  async function go(tab, params = '') { await page.goto(`${APP}#/${tab}${params}`); await wait(1600); }
  async function apiAs(role) {
    const r = await fetch(`${API}/api/v1/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ACC[role][0], password: ACC[role][1] }) });
    return (await r.json()).access;
  }
  async function askAndWait(question) {
    await page.getByLabel('Your question', { exact: true }).fill(question);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 180000 });
    await wait(600);
  }

  // ── Launch screen & invalid credentials ───────────────────────────────
  await page.goto(APP + '#/signin'); await wait(1200);
  await shot('00-login');
  expect4xx = true;
  await page.getByLabel('Email').fill('student@aurastudy.demo');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click(); await wait(1500);
  check('Invalid credentials show an error', await page.getByText('Sign-in failed').isVisible());
  expect4xx = false;

  // ── Admin ─────────────────────────────────────────────────────────────
  await login('admin');
  check('Admin lands on System Status', page.url().includes('#/dashboard'));
  await page.waitForSelector('text=Operational', { timeout: 20000 });
  check('System Status shows AI health in plain words', await page.getByText('AI answers', { exact: true }).isVisible());
  check('Technical details are tucked away by default', !(await page.getByText('Embedding model').isVisible()));
  await shot('10-admin-status');
  await go('accounts');
  check('Admin sees 29 users', await page.getByText('Showing').innerText().then((t) => /of 29/.test(t)));
  await page.getByText('Maya Okafor').first().click(); await wait(600);
  await shot('11-admin-user-sheet');
  await page.keyboard.press('Escape'); await wait(300);
  await go('academic');
  check('Catalog lists 6 courses', (await page.locator('ul li:has-text("students ·")').count()) === 6);
  await shot('12-admin-catalog');
  await go('analytics');
  await page.waitForSelector('text=Questions asked', { timeout: 20000 });
  await shot('13-admin-insights');
  expect4xx = true;
  await go('documents');
  check('Admin is redirected away from a student-only page', !page.url().includes('#/documents'));
  expect4xx = false;
  await logout();
  check('Logout returns to the landing page', await page.getByRole('heading', { level: 1, name: /Ask your course/ }).isVisible());

  // ── Teacher ───────────────────────────────────────────────────────────
  await login('teacher');
  check('Teacher lands on My Courses', page.url().includes('#/academic'));
  await page.waitForSelector('text=Units & topics', { timeout: 20000 });
  await shot('20-teacher-content');
  // create a topic + upload into it, then wait for indexing
  const unitName = 'Unit 1 · Supervised Learning';
  const addTopic = page.getByRole('button', { name: new RegExp(`Add topic to ${unitName.split(' · ')[0]}`) }).first();
  if (await addTopic.count()) {
    await addTopic.click(); await wait(400);
    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Support Vector Machines');
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click(); await wait(1500);
  }
  const svm = path.join(out, 'svm-notes.txt');
  fs.writeFileSync(svm, 'Support Vector Machines\n\nA support vector machine finds the maximum-margin hyperplane separating two classes. The training points that lie on the margin are called support vectors. The soft-margin SVM introduces slack variables and a penalty parameter C: a large C penalises misclassification heavily (narrow margin, risk of overfitting), while a small C allows more violations (wider margin). The kernel trick replaces dot products with a kernel function such as the RBF kernel so that non-linear boundaries can be learned without computing the feature map explicitly.');
  await page.locator('input[type=file]').setInputFiles(svm); await wait(500);
  const topicSelect = page.getByLabel('Topic', { exact: true });
  const svmOption = topicSelect.locator('option', { hasText: 'Support Vector Machines' });
  if (await svmOption.count()) await topicSelect.selectOption({ label: 'Support Vector Machines' });
  await page.getByRole('button', { name: 'Upload file' }).click();
  await page.waitForSelector('text=svm notes', { timeout: 15000 }).catch(() => {});
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) { await wait(2000); ready = await page.locator('li:has-text("svm notes") >> text=Ready to use').count() > 0; }
  check('Teacher upload is indexed without Redis/Celery', ready);
  await shot('21-teacher-uploaded');
  await page.getByRole('tab', { name: 'Students' }).click(); await wait(1200);
  check('Teacher sees course roster', (await page.locator('tbody tr').count()) > 3);
  await shot('22-teacher-roster');
  await go('analytics');
  await page.waitForSelector('text=Questions asked', { timeout: 20000 });
  await shot('23-teacher-insights');
  await go('assistant');
  await askAndWait('What does the C parameter do in a soft-margin SVM?');
  const teacherAnswer = await page.locator('article').last().innerText();
  check('Teacher can ask about freshly uploaded material', /svm notes|support vector/i.test(teacherAnswer) && !/couldn.t find/i.test(teacherAnswer), teacherAnswer.slice(0, 120).replace(/\n/g, ' '));
  await shot('24-teacher-ask');
  // Clean up the uploaded demo file so the environment stays as seeded.
  const tTok = await apiAs('teacher');
  const docs = await (await fetch(`${API}/api/v1/documents/?search=svm%20notes`, { headers: { Authorization: `Bearer ${tTok}` } })).json();
  for (const d of docs.results || []) await fetch(`${API}/api/v1/documents/${d.id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${tTok}` } });
  const topics = await (await fetch(`${API}/api/v1/academic/topics/`, { headers: { Authorization: `Bearer ${tTok}` } })).json();
  for (const t of topics.filter?.((x) => x.title === 'Support Vector Machines') || []) await fetch(`${API}/api/v1/academic/topics/${t.id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${tTok}` } });
  await logout();

  // ── Student ───────────────────────────────────────────────────────────
  await login('student');
  check('Student lands on Home', page.url().includes('#/home'));
  await page.waitForSelector('text=Quick actions', { timeout: 15000 });
  await shot('30-student-home');
  // Ask straight from Home: one step to an answer.
  await page.getByLabel('What do you want to learn?').fill('How does gradient descent update the weights in linear regression?');
  await page.getByLabel('What do you want to learn?').press('Enter');
  await page.waitForURL(/#\/assistant\?session=/, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('article') && !document.querySelector('[aria-busy="true"]'), null, { timeout: 180000 });
  await wait(600);
  let ans = await page.locator('article').last().innerText();
  check('Home ask box opens AI Assistant with an answer', /source/i.test(ans), ans.slice(0, 80).replace(/\n/g, ' '));
  check('Grounded answer with sources', /source/i.test(ans) && /ML-302/.test(ans), ans.slice(0, 100).replace(/\n/g, ' '));
  await askAndWait('What happens if the learning rate is too large?');
  ans = await page.locator('article').last().innerText();
  check('Follow-up answered in the same conversation', !/couldn.t find/i.test(ans));
  await shot('31-student-conversation');
  const sessionUrl = page.url();
  await page.reload(); await wait(2500);
  check('Conversation survives a refresh', page.url() === sessionUrl && (await page.locator('article').count()) >= 2);
  await page.locator('ol button').first().click(); await wait(700);
  await shot('32-student-citation');
  await page.getByRole('button', { name: /Open in Study Materials/ }).click(); await wait(2500);
  check('Citation opens the document at the cited page', page.url().includes('#/documents?doc=') && /page=/.test(page.url()));
  await shot('33-student-reader');
  await go('assistant');
  await askAndWait('Who won the 2018 FIFA World Cup?');
  ans = await page.locator('article').last().innerText();
  check('Out-of-scope question is refused, not hallucinated', /couldn.t find this in your course materials/i.test(ans));
  // Stop: the send button becomes a working Stop while an answer streams.
  await go('assistant');
  await page.getByLabel('Your question', { exact: true }).fill('Explain the bias-variance trade-off in detail with examples.');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[aria-busy="true"]', { timeout: 15000 });
  await wait(1200);
  await page.getByRole('button', { name: 'Stop answering' }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 10000 }).catch(() => {});
  check('Stop ends a streaming answer', (await page.locator('[aria-busy="true"]').count()) === 0 && /stopped/i.test(await page.locator('article').last().innerText()));
  // Home lists recent chats; one click continues the conversation.
  await go('home');
  const recent = page.locator('section:has(h2:has-text("Continue a chat")) li button').first();
  await recent.waitFor({ timeout: 15000 });
  await recent.click(); await wait(2500);
  check('Recent chat on Home reopens that conversation', /#\/assistant\?session=/.test(page.url()) && (await page.locator('article').count()) >= 1);
  // My Courses → Ask AI keeps the course.
  await go('courses');
  await page.locator('section[aria-labelledby="mine-h"] li:has-text("ML-302")').getByRole('button', { name: 'Ask AI' }).click(); await wait(2000);
  const scopeText = await page.getByLabel('Ask about').evaluate((el) => el.options[el.selectedIndex].text).catch(() => '');
  check('My Courses "Ask AI" opens the assistant for that course', page.url().includes('#/assistant') && /ML-302/.test(scopeText), scopeText);
  await go('documents');
  check('Study Materials uses plain naming', await page.getByRole('heading', { level: 1, name: 'Study Materials' }).isVisible());
  await shot('34-student-sources');
  await go('courses');
  await shot('35-student-courses');
  const enrollOS = page.locator('li:has-text("CS-304") button:has-text("Enroll")');
  if (await enrollOS.count()) { await enrollOS.click(); await wait(1800); }
  check('Student can enroll in Operating Systems', await page.locator('section[aria-labelledby="mine-h"] li:has-text("CS-304")').count() > 0);
  await go('documents');
  await page.getByRole('tab', { name: /Operating Systems/ }).click(); await wait(1500);
  check('Empty folder state for File Systems', await page.getByText(/will be published later/).isVisible());
  await shot('36-student-sources-os');
  // leave OS again to restore the seeded state
  const sTok = await apiAs('student');
  const enr = await (await fetch(`${API}/api/v1/academic/enrollments/`, { headers: { Authorization: `Bearer ${sTok}` } })).json();
  for (const e of (enr.results || []).filter((x) => x.course.code === 'CS-304')) await fetch(`${API}/api/v1/academic/enrollments/${e.id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${sTok}` } });
  await go('notebook');
  check('Notebook shows saved answers', (await page.locator('article').count()) > 0);
  await shot('37-student-notebook');
  await page.getByRole('tab', { name: /Flashcards/ }).click(); await wait(800);
  const card = page.locator('.flip-card').first();
  if (await card.count()) { await card.click(); await wait(700); }
  check('Flashcards available and flip', (await page.locator('.flip-card[data-flipped="true"]').count()) === 1);
  await shot('38-student-flashcards');
  // First-time student: with no courses, Home shows a short guide instead.
  const cors = { 'access-control-allow-origin': new URL(APP).origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, OPTIONS' };
  await page.route('**/api/v1/ai/scope/', (r) => r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: r.request().method() === 'OPTIONS' ? '' : '[]' }));
  await go('home');
  check('First-time student sees the getting-started guide', await page.getByRole('heading', { name: 'Get started in three steps' }).isVisible());
  await shot('39-student-first-time');
  await page.unroute('**/api/v1/ai/scope/');
  expect4xx = true;
  await go('accounts');
  check('Student is redirected away from admin page', !page.url().includes('#/accounts'));
  const r1 = await fetch(`${API}/api/v1/accounts/users/`, { headers: { Authorization: `Bearer ${sTok}` } });
  const r2 = await fetch(`${API}/api/v1/ai/insights/`, { headers: { Authorization: `Bearer ${sTok}` } });
  check('Student API calls to admin/teacher endpoints are forbidden', r1.status === 403 && r2.status === 403, `${r1.status}/${r2.status}`);
  expect4xx = false;
  await logout();

  await browser.close();
  console.log('\nUnexpected errors:', errors.length ? JSON.stringify(errors, null, 1) : 'none');
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(out, `results-${THEME}-${W}.json`), JSON.stringify({ results, errors }, null, 1));
})().catch((e) => { console.error('ACCEPTANCE CRASHED', e.message); process.exit(1); });
