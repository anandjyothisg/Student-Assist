// Live document lifecycle against the running API (teacher account, ML-302).
// Upload → Ready → answerable → new version replaces it → old content no longer
// answerable → delete live version → previous version revived → delete all → refused.
// Also: empty / disguised / oversized uploads are rejected. Cleans up after itself.
// Usage: node e2e/document-lifecycle.cjs
const API = process.env.E2E_API || 'http://localhost:8000/api/v1';
const ROOT = process.env.E2E_API_ROOT || 'http://localhost:8000';
const results = [];
const check = (name, ok, note = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? '  · ' + note : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(email, password) {
  const r = await fetch(`${API}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).access;
}
const H = (t) => ({ Authorization: `Bearer ${t}` });

async function upload(t, course, name, text, extra = {}) {
  const fd = new FormData();
  fd.append('file', new Blob([text], { type: 'text/plain' }), name);
  fd.append('title', 'Lifecycle test notes');
  fd.append('course', course);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const r = await fetch(`${API}/documents/upload/`, { method: 'POST', headers: H(t), body: fd });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function waitStatus(t, id, want, ms = 120000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await fetch(`${API}/documents/${id}/?all_versions=true`, { headers: H(t) });
    if (r.status === 200) {
      const d = await r.json();
      if (want.includes(d.processing_status)) return d;
    }
    await sleep(1500);
  }
  return null;
}
const sessions = [];
async function ask(t, course, question) {
  const r = await fetch(`${ROOT}/api/chat/ask/`, { method: 'POST', headers: { ...H(t), 'Content-Type': 'application/json' }, body: JSON.stringify({ question, course_id: course }) });
  const d = await r.json();
  if (d.session_id) sessions.push(d.session_id);
  return d;
}

(async () => {
  const t = await login('teacher@aurastudy.demo', 'AuraTeach#2026');
  const courses = await (await fetch(`${API}/academic/courses/?scope=mine&page_size=100`, { headers: H(t) })).json();
  const course = (courses.results || courses).find((c) => c.code === 'ML-302').id;
  const created = [];

  // --- rejected uploads
  check('Empty file is rejected', (await upload(t, course, 'empty.txt', '')).status === 400);
  const fakePdf = await upload(t, course, 'fake.pdf', '<html><script>alert(1)</script></html>');
  check('HTML disguised as PDF is rejected', fakePdf.status === 400, JSON.stringify(fakePdf.data).slice(0, 90));
  const big = await upload(t, course, 'big.txt', 'x'.repeat(51 * 1024 * 1024));
  check('51 MB upload is rejected', big.status === 400 || big.status === 413, `status ${big.status}`);

  // --- v1
  const v1 = await upload(t, course, 'zorblax-v1.txt', 'The Zorblax coefficient measures how quickly a learner forgets: it equals 0.37 per week in the lifecycle study.');
  created.push(v1.data.id);
  check('Valid upload accepted', v1.status === 201 || v1.status === 202, `status ${v1.status}`);
  const v1Ready = await waitStatus(t, v1.data.id, ['completed', 'failed']);
  check('v1 becomes Ready', v1Ready?.processing_status === 'completed');
  let a = await ask(t, course, 'What is the Zorblax coefficient per week?');
  check('v1 content is answerable with a citation', a.status === 'answered' && /0\.37/.test(a.answer) && a.citations.some((c) => c.document_id === v1.data.id), a.answer?.slice(0, 80));

  // --- v2 replaces v1 only once indexed
  const v2 = await upload(t, course, 'zorblax-v2.txt', 'Revised notes: the Quillian index is 12 for sparse graphs. The Zorblax coefficient was retired.', { parent: v1.data.id });
  created.push(v2.data.id);
  const v2Ready = await waitStatus(t, v2.data.id, ['completed', 'failed']);
  check('v2 becomes Ready', v2Ready?.processing_status === 'completed');
  const v1After = await (await fetch(`${API}/documents/${v1.data.id}/?all_versions=true`, { headers: H(t) })).json();
  check('v2 is now the live version', v2Ready?.is_latest === true && v1After.is_latest === false);
  a = await ask(t, course, 'What is the Zorblax coefficient per week?');
  check('Superseded v1 content is no longer answered from', !/0\.37/.test(a.answer || ''), `${a.status}: ${a.answer?.slice(0, 70)}`);
  a = await ask(t, course, 'What is the Quillian index for sparse graphs?');
  check('v2 content is answerable', a.status === 'answered' && /12/.test(a.answer), a.answer?.slice(0, 70));

  // --- delete live v2 → v1 is re-indexed and live again
  let r = await fetch(`${API}/documents/${v2.data.id}/`, { method: 'DELETE', headers: H(t) });
  check('Deleting v2 succeeds', r.status === 204, `status ${r.status}`);
  const revived = await waitStatus(t, v1.data.id, ['completed', 'failed']);
  check('v1 is revived and re-indexed', revived?.is_latest === true && revived.processing_status === 'completed');
  a = await ask(t, course, 'What is the Quillian index for sparse graphs?');
  check('Deleted v2 content is no longer answerable', a.status === 'not_found' || !/\b12\b/.test(a.answer || ''), `${a.status}`);

  // --- delete v1 → nothing left
  r = await fetch(`${API}/documents/${v1.data.id}/`, { method: 'DELETE', headers: H(t) });
  check('Deleting v1 succeeds', r.status === 204);
  a = await ask(t, course, 'What is the Zorblax coefficient per week?');
  check('After deletion the assistant refuses', a.status === 'not_found', a.status);

  // --- cleanup chat sessions created by this test
  for (const id of sessions) await fetch(`${ROOT}/api/chat/${id}/`, { method: 'DELETE', headers: H(t) });
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
