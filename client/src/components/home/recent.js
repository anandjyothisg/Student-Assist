/*
 * Recently opened study materials, remembered on this device only (the
 * server doesn't record reading history). Used by the student Home page.
 */
const KEY = 'recent_materials';
const MAX = 6;

export function rememberOpened(doc) {
  if (!doc?.id) return;
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]').filter((d) => d.id !== doc.id);
    list.unshift({ id: doc.id, title: doc.title, course_code: doc.course_code || '', at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch { /* storage unavailable: nothing to remember */ }
}

export function recentMaterials() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((d) => d && d.id && d.title) : [];
  } catch {
    return [];
  }
}

export function forgetMaterial(id) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]').filter((d) => d.id !== id);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}
