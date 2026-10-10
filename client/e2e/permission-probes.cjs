// Live authorization probes against the running API. Read-only except where noted
// (attempted writes are expected to be refused). Usage: node e2e/permission-probes.cjs
const API = process.env.E2E_API || 'http://localhost:8000/api/v1';
const ROOT = process.env.E2E_API_ROOT || 'http://localhost:8000';
const rows = [];

async function login(email, password) {
  const r = await fetch(`${API}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).access;
}
async function call(token, method, url, body, raw = false) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  let text = '';
  try { text = await r.text(); } catch { /* ignore */ }
  return { status: r.status, text };
}
function probe(name, res, expected) {
  const ok = expected.includes(res.status);
  const leaked = /Traceback|File "|django\.|SECRET|password/i.test(res.text) && res.status >= 500;
  rows.push({ name, status: res.status, expected: expected.join('/'), ok: ok && !leaked });
  console.log(`${ok && !leaked ? 'PASS' : 'FAIL'}  ${String(res.status).padEnd(4)} ${name}${leaked ? '  (leaked internals!)' : ''}`);
}

(async () => {
  const student = await login('student@aurastudy.demo', 'AuraStudy#2026');
  const teacher = await login('teacher@aurastudy.demo', 'AuraTeach#2026');      // Daniel Reyes: AI-301, ML-302
  const other = await login('ravi.menon@aurastudy.demo', 'AuraFaculty#2026');    // Ravi Menon: CS-304, CS-305
  const admin = await login('admin@aurastudy.demo', 'AuraAdmin#2026');

  const courses = JSON.parse((await call(admin, 'GET', `${API}/academic/courses/?page_size=100`)).text).results;
  const byCode = Object.fromEntries(courses.map((c) => [c.code, c.id]));
  const docsOf = async (code) => JSON.parse((await call(admin, 'GET', `${API}/documents/?course=${byCode[code]}&page_size=5`)).text).results;
  const osDoc = (await docsOf('CS-304'))[0];   // student is not enrolled in CS-304
  const dbDoc = (await docsOf('CS-305'))[0];   // owned by Ravi, not Daniel
  const studentSessions = JSON.parse((await call(student, 'GET', `${ROOT}/api/chat/`)).text);
  const aSession = studentSessions[0]?.id;

  probe('No token: list documents', await call(null, 'GET', `${API}/documents/`), [401]);
  probe('Garbage token: list documents', await call('not.a.jwt', 'GET', `${API}/documents/`), [401]);
  const forged = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjo0MTAyNDQ0ODAwLCJ1c2VyX2lkIjoiMSIsInJvbGUiOiJhZG1pbiJ9.c2lnbmF0dXJl';
  probe('Forged admin token (bad signature)', await call(forged, 'GET', `${API}/accounts/users/`), [401]);
  probe('No token: ask the assistant', await call(null, 'POST', `${ROOT}/api/chat/ask/`, { question: 'hi' }), [401]);

  probe('Student: list all users', await call(student, 'GET', `${API}/accounts/users/`), [403]);
  probe('Student: read non-enrolled course document', await call(student, 'GET', `${API}/documents/${osDoc.id}/`), [403, 404]);
  probe('Student: download non-enrolled course document', await call(student, 'GET', `${API}/documents/${osDoc.id}/download/`), [403, 404]);
  probe('Student: ask scoped to non-enrolled course', await call(student, 'POST', `${ROOT}/api/chat/ask/`, { question: 'deadlock', course_id: byCode['CS-304'] }), [403]);
  probe('Student: upload a document', await call(student, 'POST', `${API}/documents/upload/`, {}), [403]);
  probe('Student: delete a document', await call(student, 'DELETE', `${API}/documents/${dbDoc.id}/`), [403, 404]);
  probe('Student: change own role via profile', await call(student, 'PATCH', `${API}/auth/me/`, { role: 'admin' }), [200, 400]);
  const me = JSON.parse((await call(student, 'GET', `${API}/auth/me/`)).text);
  rows.push({ name: 'Student role unchanged after PATCH', status: me.role, expected: 'student', ok: me.role === 'student' });
  console.log(`${me.role === 'student' ? 'PASS' : 'FAIL'}  ----  Student role unchanged after PATCH (${me.role})`);
  probe('Student: insights', await call(student, 'GET', `${API}/ai/insights/`), [403]);

  if (aSession) {
    probe("Teacher: read a student's chat session by id", await call(teacher, 'GET', `${ROOT}/api/chat/${aSession}/`), [404]);
    probe("Other student/teacher: delete student's session", await call(other, 'DELETE', `${ROOT}/api/chat/${aSession}/`), [404]);
  }
  probe("Teacher: edit another teacher's course", await call(teacher, 'PATCH', `${API}/academic/courses/${byCode['CS-305']}/`, { title: 'pwned' }), [403, 404]);
  probe("Teacher: delete another teacher's document", await call(teacher, 'DELETE', `${API}/documents/${dbDoc.id}/`), [403, 404]);
  probe("Teacher: reprocess another teacher's document", await call(teacher, 'POST', `${API}/documents/${dbDoc.id}/reprocess/`), [403, 404]);
  probe("Teacher: roster of another teacher's course", await call(teacher, 'GET', `${API}/academic/courses/${byCode['CS-305']}/students/`), [403, 404]);
  probe("Teacher: insights for another teacher's course", await call(teacher, 'GET', `${API}/ai/insights/?course=${byCode['CS-305']}`), [403]);
  probe('Teacher: user administration', await call(teacher, 'GET', `${API}/accounts/users/`), [403]);
  probe('Teacher: create a subject (admin only)', await call(teacher, 'POST', `${API}/academic/subjects/`, { name: 'X', code: 'X' }), [403]);

  probe('Wrong method: PUT on chat session list', await call(student, 'PUT', `${ROOT}/api/chat/`, {}), [405]);
  probe('Malformed JSON body', await call(student, 'POST', `${ROOT}/api/chat/ask/`, '{"question": ', true), [400]);
  probe('Malformed id in URL', await call(student, 'GET', `${API}/documents/not-a-uuid/`), [404]);
  probe('Malformed id in query', await call(teacher, 'GET', `${API}/documents/?course=1%27%20OR%201=1`), [400]);
  probe('Oversized question', await call(student, 'POST', `${ROOT}/api/chat/ask/`, { question: 'x'.repeat(20000) }), [400]);
  probe('Path traversal via public media', await call(null, 'GET', `${ROOT}/media/avatars/..%2f..%2fsrc%2fdb.sqlite3`), [404]);
  probe('Legacy analytics endpoint not mounted', await call(teacher, 'GET', `${ROOT}/api/assistant/analytics/`), [404]);
  probe('API docs not public in production config (dev: 200 expected)', await call(null, 'GET', `${ROOT}/api/schema/`), [200, 404]);

  const passed = rows.filter((r) => r.ok).length;
  console.log(`\n${passed}/${rows.length} probes behaved as expected`);
  process.exit(passed === rows.length ? 0 : 1);
})();
