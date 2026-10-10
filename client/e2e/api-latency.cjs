// Median / worst latency of key API endpoints on the running stack (7 calls each).
// Usage: node e2e/api-latency.cjs
const API = process.env.E2E_API || 'http://localhost:8000/api/v1';
const ROOT = process.env.E2E_API_ROOT || 'http://localhost:8000';

async function login(email, password) {
  const r = await fetch(`${API}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).access;
}
async function time(token, url, n = 7) {
  const out = [];
  let status;
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    await r.arrayBuffer();
    status = r.status;
    out.push(performance.now() - t);
  }
  out.sort((a, b) => a - b);
  return { p50: Math.round(out[Math.floor(n / 2)]), max: Math.round(out[n - 1]), status };
}

(async () => {
  const s = await login('student@aurastudy.demo', 'AuraStudy#2026');
  const t = await login('teacher@aurastudy.demo', 'AuraTeach#2026');
  const a = await login('admin@aurastudy.demo', 'AuraAdmin#2026');
  const rows = [
    ['student', 'GET /auth/me/', s, `${API}/auth/me/`],
    ['student', 'GET /academic/courses/', s, `${API}/academic/courses/?page_size=100`],
    ['student', 'GET /documents/ (library)', s, `${API}/documents/?page_size=100`],
    ['student', 'GET /api/chat/ (history)', s, `${ROOT}/api/chat/`],
    ['student', 'GET /ai/scope/', s, `${API}/ai/scope/`],
    ['teacher', 'GET /documents/?course=…', t, null],
    ['teacher', 'GET /ai/insights/', t, `${API}/ai/insights/?days=28`],
    ['admin', 'GET /accounts/users/', a, `${API}/accounts/users/?page_size=20`],
    ['admin', 'GET /ai/health/ (status page)', a, `${API}/ai/health/`],
  ];
  const courses = await (await fetch(`${API}/academic/courses/?scope=mine&page_size=100`, { headers: { Authorization: `Bearer ${t}` } })).json();
  rows[5][3] = `${API}/documents/?course=${(courses.results || courses)[0].id}&page_size=100`;
  console.log('role     endpoint                          p50ms  max  status');
  for (const [role, name, tok, url] of rows) {
    const r = await time(tok, url);
    console.log(`${role.padEnd(8)} ${name.padEnd(34)} ${String(r.p50).padStart(5)} ${String(r.max).padStart(5)}  ${r.status}`);
  }
  // One full answer, timed end to end (model warm).
  const q = performance.now();
  const r = await fetch(`${ROOT}/api/chat/ask/`, { method: 'POST', headers: { Authorization: `Bearer ${s}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'What is a primary key?' }) });
  const d = await r.json();
  console.log(`student  POST /api/chat/ask/ (full answer)   ${Math.round(performance.now() - q)} ms  status ${r.status} (${d.status})`);
  if (d.session_id) await fetch(`${ROOT}/api/chat/${d.session_id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${s}` } });
})();
