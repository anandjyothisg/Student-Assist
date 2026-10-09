import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, EyeOff, FileText, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2,
  UploadCloud, Users,
} from 'lucide-react';

import api, { extractErrorMessage } from '../auth/api';
import { useToast } from '../ui/Toast';
import { PageHeader } from '../ui/PageHeader';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, SearchInput, Field } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Modal, Sheet } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { Avatar } from '../ui/Avatar';

const ACCEPT = '.pdf,.docx,.pptx,.txt';
const MAX_MB = 50;

const STATUS = {
  completed: { tone: 'success', label: 'Ready' },
  processing: { tone: 'warning', label: 'Indexing' },
  pending: { tone: 'neutral', label: 'Queued' },
  failed: { tone: 'error', label: 'Failed' },
};

function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return ''; }
}
function sizeLabel(mb) {
  if (mb == null) return '';
  return mb < 1 ? `${Math.max(1, Math.round(mb * 1024))} KB` : `${mb.toFixed(1)} MB`;
}
const selectArrow = { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")' };
const selectCls = 'field-control appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat !pr-9';

/* ─── Small "name this" dialog used for units/topics ───────────────────── */
function NameDialog({ open, title, description, initial = { title: '', description: '' }, confirmLabel = 'Save', onClose, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setForm(initial); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Enter a name.'); return; }
    setSaving(true);
    try { await onSubmit({ title: form.title.trim(), description: form.description.trim() }); onClose(); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={title} description={description} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="name-dialog" loading={saving}>{confirmLabel}</Button></>}>
      <form id="name-dialog" onSubmit={submit} className="flex flex-col gap-4 pt-1" noValidate>
        <Input label="Name" value={form.title} onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setError(''); }} error={error || undefined} data-autofocus />
        <Textarea label="Description" hint="Optional — shown to students above the materials." rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </form>
    </Modal>
  );
}

/* ─── New course ───────────────────────────────────────────────────────── */
function NewCourseDialog({ open, onClose, onCreated }) {
  const toast = useToast();
  const [subjects, setSubjects] = useState(null);
  const [form, setForm] = useState({ code: '', title: '', subject: '', description: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || subjects) return;
    api.get('/academic/subjects/', { params: { page_size: 100 } })
      .then((r) => setSubjects((r.data.results ?? r.data).filter((s) => s.is_active !== false)))
      .catch(() => setSubjects([]));
  }, [open, subjects]);
  useEffect(() => { if (!open) { setForm({ code: '', title: '', subject: '', description: '' }); setErrors({}); } }, [open]);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.code.trim()) errs.code = 'Enter a course code.';
    if (!form.title.trim()) errs.title = 'Enter a course title.';
    if (!form.subject) errs.subject = 'Choose a subject.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await api.post('/academic/courses/', { code: form.code.trim(), title: form.title.trim(), subject: form.subject, description: form.description.trim() });
      toast.success(`${res.data.code} created as a draft.`);
      onCreated(res.data);
      onClose();
    } catch (err) {
      const data = err.response?.data?.error?.details || err.response?.data || {};
      const fieldErrs = {};
      ['code', 'title', 'subject'].forEach((k) => { if (data[k]) fieldErrs[k] = [].concat(data[k]).join(' '); });
      if (Object.keys(fieldErrs).length) setErrors(fieldErrs); else toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="New course" description="Courses start as drafts. Add units, topics and materials, then publish when students should see them."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="new-course-form" loading={saving}>Create course</Button></>}>
      <form id="new-course-form" onSubmit={submit} className="flex flex-col gap-4 pt-1" noValidate>
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <Input label="Code" placeholder="CS-410" value={form.code} onChange={set('code')} error={errors.code} data-autofocus className="font-mono uppercase" />
          <Input label="Title" placeholder="Natural Language Processing" value={form.title} onChange={set('title')} error={errors.title} />
        </div>
        <Field label="Subject" error={errors.subject}>
          {(p) => (
            <select {...p} value={form.subject} onChange={set('subject')} className={selectCls} style={selectArrow}>
              <option value="" disabled>{subjects === null ? 'Loading subjects…' : subjects.length ? 'Select a subject' : 'No subjects available'}</option>
              {(subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </Field>
        <Textarea label="Description" rows={2} value={form.description} onChange={set('description')} hint="One or two sentences students will see in the catalog." />
      </form>
    </Modal>
  );
}

/* ─── Upload into a topic ──────────────────────────────────────────────── */
function Uploader({ course, structure, topicId, setTopicId, onUploaded }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Lecture notes');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const pick = (f) => {
    if (!f) return;
    const ext = `.${f.name.split('.').pop().toLowerCase()}`;
    if (!ACCEPT.split(',').includes(ext)) { setError('Use a PDF, DOCX, PPTX or TXT file.'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`Files must be under ${MAX_MB} MB.`); return; }
    setError('');
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '));
  };
  const reset = () => { setFile(null); setTitle(''); setError(''); if (inputRef.current) inputRef.current.value = ''; };

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title.trim() || file.name);
    fd.append('course', course.id);
    fd.append('category', category);
    if (topicId) fd.append('topic', topicId);
    try {
      const res = await api.post('/documents/upload/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`“${res.data.title}” uploaded — indexing now.`);
      onUploaded(res.data);
      reset();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  if (file) {
    return (
      <form onSubmit={upload} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-dim text-accent"><FileText className="size-[18px]" aria-hidden /></span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-fg">{file.name}</p>
            <p className="text-xs text-fg-3">{sizeLabel(file.size / 1024 / 1024)}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
          <Input label="Title shown to students" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Field label="Topic">
            {(p) => (
              <select {...p} value={topicId || ''} onChange={(e) => setTopicId(e.target.value)} className={selectCls} style={selectArrow}>
                <option value="">Not filed under a topic</option>
                {structure.map((u) => (
                  <optgroup key={u.id} label={u.title}>
                    {u.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </optgroup>
                ))}
              </select>
            )}
          </Field>
          <Field label="Type">
            {(p) => (
              <select {...p} value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls} style={selectArrow}>
                {['Lecture notes', 'Worked examples', 'Study guide', 'Lab handout', 'Reference sheet'].map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
          </Field>
        </div>
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={reset} disabled={uploading}>Cancel</Button>
          <Button type="submit" iconLeft={UploadCloud} loading={uploading}>{uploading ? 'Uploading…' : 'Upload and index'}</Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        className={`flex w-full items-center gap-4 rounded-lg border border-dashed px-5 py-4 text-left transition-colors ${drag ? 'border-accent bg-accent-dim' : 'border-border-strong bg-surface/50 hover:border-fg-3 hover:bg-surface'}`}
      >
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md ${drag ? 'bg-accent text-accent-fg' : 'bg-subtle text-fg-2'}`}><UploadCloud className="size-5" aria-hidden /></span>
        <span className="min-w-0">
          <span className="block text-[14px] font-medium text-fg">{drag ? 'Drop to add this file' : 'Add course material'}</span>
          <span className="block text-[13px] text-fg-3">Drag a file here or browse · PDF, DOCX, PPTX or TXT up to {MAX_MB} MB · indexed automatically</span>
        </span>
      </button>
      <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p role="alert" className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}

/* ─── Document details ─────────────────────────────────────────────────── */
function DocumentSheet({ doc, onClose, onReprocess, onDelete }) {
  const [chunks, setChunks] = useState(null);
  useEffect(() => {
    if (!doc) return;
    setChunks(null);
    api.get(`/documents/${doc.id}/chunks/`, { params: { page_size: 4 } })
      .then((r) => setChunks(r.data.results ?? r.data))
      .catch(() => setChunks([]));
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = STATUS[doc?.processing_status] || STATUS.pending;

  return (
    <Sheet isOpen={!!doc} onClose={onClose} title="Document" label="Document details" width="md:w-[440px]">
      {doc && (
        <div className="flex flex-col gap-6 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge tone={st.tone} dot>{st.label}</Badge>{doc.category && <Badge>{doc.category}</Badge>}</div>
            <h3 className="mt-3 text-[17px] font-semibold leading-snug text-fg">{doc.title}</h3>
            <p className="mt-1 text-[12.5px] text-fg-3">{[doc.unit_title, doc.topic_title].filter(Boolean).join(' · ') || 'Not filed under a topic'}</p>
            {doc.processing_status === 'failed' && doc.error_message && (
              <p className="mt-3 rounded-md bg-error-dim px-3 py-2 text-[12.5px] text-error">{doc.error_message}</p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <div><dt className="text-fg-3">Type</dt><dd className="mt-0.5 font-medium uppercase text-fg">{doc.file_type || '—'}</dd></div>
              <div><dt className="text-fg-3">Size</dt><dd className="mt-0.5 font-medium text-fg">{sizeLabel(doc.file_size_mb) || '—'}</dd></div>
              <div><dt className="text-fg-3">Pages</dt><dd className="mt-0.5 font-medium tabular text-fg">{doc.page_count || '—'}</dd></div>
              <div><dt className="text-fg-3">Indexed passages</dt><dd className="mt-0.5 font-medium tabular text-fg">{doc.chunk_count || '—'}</dd></div>
            </dl>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-fg-3">Extracted text</p>
            {chunks === null ? (
              <div className="flex flex-col gap-2"><Skeleton className="h-3.5" /><Skeleton className="h-3.5" width="80%" /></div>
            ) : chunks.length === 0 ? (
              <p className="rounded-md border border-dashed border-border-strong px-4 py-5 text-center text-[13px] text-fg-3">
                {doc.processing_status === 'completed' ? 'No text was extracted from this file.' : 'Text appears here once indexing finishes.'}
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {chunks.map((c) => (
                  <li key={c.id} className="rounded-md bg-subtle px-3.5 py-3 text-[13px] leading-relaxed text-fg-2">
                    <span className="mb-1 block font-mono text-[11px] text-fg-3">Page {c.page_number || 1}</span>
                    {c.content.length > 260 ? `${c.content.slice(0, 260)}…` : c.content}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-5">
            <Button variant="secondary" iconLeft={RefreshCw} onClick={() => onReprocess(doc)} disabled={doc.processing_status === 'processing'}>Re-index</Button>
            <Button variant="danger-ghost" iconLeft={Trash2} onClick={() => onDelete(doc)}>Delete</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ─── Students tab ─────────────────────────────────────────────────────── */
function Roster({ course }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    setRows(null); setError(false);
    api.get(`/academic/courses/${course.id}/students/`).then((r) => setRows(r.data)).catch(() => setError(true));
  }, [course.id]);
  if (error) return <ErrorState title="Couldn’t load the roster" />;
  if (!rows) return <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  const visible = rows.filter((r) => !q || `${r.full_name} ${r.email} ${r.student_number}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-fg-3"><span className="font-medium tabular text-fg">{rows.length}</span> enrolled</p>
        {rows.length > 6 && <SearchInput icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student" aria-label="Find a student" className="w-full max-w-56" />}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong"><EmptyState compact icon={Users} title="No students yet" description="Students appear here when they enroll in this course." /></div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-[13.5px]">
            <thead className="border-b border-border bg-subtle/60 text-xs text-fg-3">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Student</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Student no.</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Year</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Questions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="max-w-0 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.full_name} size="sm" />
                      <div className="min-w-0"><p className="truncate font-medium text-fg">{r.full_name}</p><p className="truncate text-[12.5px] text-fg-3">{r.email}</p></div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-[12.5px] text-fg-2 md:table-cell">{r.student_number || '—'}</td>
                  <td className="hidden px-4 py-3 text-fg-2 sm:table-cell">{r.year_of_study ? `Year ${r.year_of_study}` : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium tabular text-fg">{r.questions_asked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────────── */
export function TeacherDashboard() {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [coursesState, setCoursesState] = useState('loading');
  const [selectedId, setSelectedId] = useState(null);
  const [structure, setStructure] = useState([]);
  const [docs, setDocs] = useState([]);
  const [docsState, setDocsState] = useState('idle');
  const [view, setView] = useState('materials');
  const [search, setSearch] = useState('');
  const [uploadTopic, setUploadTopic] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [openDoc, setOpenDoc] = useState(null);
  const [confirm, setConfirm] = useState(null); // {kind, item}
  const [busy, setBusy] = useState(false);
  const [nameDialog, setNameDialog] = useState(null); // {mode, unit?, topic?}
  const uploaderRef = useRef(null);

  const selected = courses.find((c) => c.id === selectedId) || null;

  const fetchCourses = useCallback(async (selectId) => {
    setCoursesState((s) => (s === 'ready' ? s : 'loading'));
    try {
      const res = await api.get('/academic/courses/', { params: { scope: 'mine', page_size: 100 } });
      const items = res.data.results ?? res.data;
      setCourses(items);
      setCoursesState('ready');
      setSelectedId((cur) => selectId || (items.some((c) => c.id === cur) ? cur : items[0]?.id ?? null));
    } catch {
      setCoursesState('error');
    }
  }, []);
  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const fetchCourse = useCallback(async ({ quiet = false } = {}) => {
    if (!selectedId) return;
    if (!quiet) setDocsState('loading');
    try {
      const [s, d] = await Promise.all([
        api.get(`/academic/courses/${selectedId}/structure/`),
        api.get('/documents/', { params: { course: selectedId, page_size: 100 } }),
      ]);
      setStructure(s.data);
      setDocs(d.data.results ?? d.data);
      setDocsState('ready');
    } catch {
      if (!quiet) setDocsState('error');
    }
  }, [selectedId]);
  useEffect(() => { setSearch(''); setUploadTopic(''); fetchCourse(); }, [fetchCourse]);

  const hasPending = docs.some((d) => d.processing_status === 'pending' || d.processing_status === 'processing');
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => { if (!document.hidden) fetchCourse({ quiet: true }); }, 4000);
    return () => clearInterval(t);
  }, [hasPending, fetchCourse]);

  const togglePublish = async () => {
    setBusy(true);
    try {
      const res = await api.patch(`/academic/courses/${selected.id}/`, { is_published: !selected.is_published });
      setCourses((list) => list.map((c) => (c.id === res.data.id ? res.data : c)));
      toast.success(res.data.is_published ? `${res.data.code} is now visible to students.` : `${res.data.code} is hidden from students.`);
    } catch (err) { toast.error(extractErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const reprocess = async (doc) => {
    try {
      await api.post(`/documents/${doc.id}/reprocess/`);
      toast.success('Re-indexing started.');
      setDocs((list) => list.map((d) => (d.id === doc.id ? { ...d, processing_status: 'pending' } : d)));
      setOpenDoc((d) => (d?.id === doc.id ? { ...d, processing_status: 'pending' } : d));
    } catch (err) { toast.error(extractErrorMessage(err)); }
  };

  const doConfirm = async () => {
    const { kind, item } = confirm;
    setBusy(true);
    try {
      if (kind === 'doc') {
        await api.delete(`/documents/${item.id}/`);
        setOpenDoc(null);
        toast.success(`“${item.title}” deleted.`);
      } else if (kind === 'unit') {
        await api.delete(`/academic/units/${item.id}/`);
        toast.success('Unit deleted.');
      } else if (kind === 'topic') {
        await api.delete(`/academic/topics/${item.id}/`);
        toast.success('Topic deleted.');
      }
      setConfirm(null);
      fetchCourse({ quiet: true });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async ({ title, description }) => {
    const d = nameDialog;
    if (d.mode === 'new-unit') await api.post('/academic/units/', { course: selected.id, title, description });
    if (d.mode === 'edit-unit') await api.patch(`/academic/units/${d.unit.id}/`, { title, description });
    if (d.mode === 'new-topic') await api.post('/academic/topics/', { unit: d.unit.id, title, description });
    if (d.mode === 'edit-topic') await api.patch(`/academic/topics/${d.topic.id}/`, { title, description });
    toast.success('Saved.');
    fetchCourse({ quiet: true });
  };

  const addToTopic = (topicId) => {
    setUploadTopic(topicId);
    uploaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    uploaderRef.current?.querySelector('button')?.focus();
  };

  const docsByTopic = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs
      .filter((d) => !q || d.title.toLowerCase().includes(q))
      .reduce((acc, d) => { (acc[d.topic || 'none'] ||= []).push(d); return acc; }, {});
  }, [docs, search]);
  const counts = useMemo(() => docs.reduce((a, d) => { a[d.processing_status] = (a[d.processing_status] || 0) + 1; return a; }, {}), [docs]);

  const DocLine = ({ d }) => {
    const st = STATUS[d.processing_status] || STATUS.pending;
    return (
      <li className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-subtle/50">
        <FileText className="size-4 shrink-0 text-fg-3" aria-hidden />
        <button onClick={() => setOpenDoc(d)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[13.5px] font-medium text-fg group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4">{d.title}</span>
          <span className="block truncate text-xs text-fg-3">{[d.category, (d.file_type || '').toUpperCase(), sizeLabel(d.file_size_mb), formatDate(d.created_at)].filter(Boolean).join(' · ')}</span>
        </button>
        <Badge tone={st.tone} dot>{st.label}</Badge>
        <IconButton icon={MoreHorizontal} label={`Details for ${d.title}`} size="sm" onClick={() => setOpenDoc(d)} />
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Content"
        description="Organise each course into units and topics, upload materials, and publish when students should see them."
        actions={<Button iconLeft={Plus} onClick={() => setNewOpen(true)}>New course</Button>}
      />

      {coursesState === 'error' ? (
        <div className="rounded-lg border border-border bg-surface"><ErrorState title="Couldn’t load your courses" onRetry={() => fetchCourses()} /></div>
      ) : coursesState === 'ready' && courses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong">
          <EmptyState icon={FolderOpen} title="Create your first course" description="Courses group the materials students can read and ask about." action={<Button iconLeft={Plus} onClick={() => setNewOpen(true)}>New course</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
          <aside className="flex min-w-0 flex-col gap-3">
            <h2 className="text-[13px] font-medium text-fg-3">Your courses {coursesState === 'ready' && <span className="tabular">· {courses.length}</span>}</h2>
            <div className="lg:hidden">
              {coursesState === 'loading' ? <Skeleton className="h-10" /> : (
                <select value={selectedId || ''} onChange={(e) => setSelectedId(e.target.value)} aria-label="Course" className={selectCls} style={selectArrow}>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                </select>
              )}
            </div>
            <nav aria-label="Courses" className="hidden flex-col gap-1 lg:flex">
              {coursesState === 'loading'
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="mb-1 h-16" />)
                : courses.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <button key={c.id} onClick={() => setSelectedId(c.id)} aria-current={active ? 'true' : undefined}
                      className={`flex flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left transition-colors ${active ? 'bg-surface shadow-xs ring-1 ring-border' : 'hover:bg-subtle'}`}>
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className={`font-mono text-[11.5px] ${active ? 'text-accent' : 'text-fg-3'}`}>{c.code}</span>
                        <span className={`text-[11px] ${c.is_published ? 'text-success' : 'text-fg-3'}`}>{c.is_published ? 'Published' : 'Draft'}</span>
                      </span>
                      <span className={`line-clamp-1 text-[13.5px] ${active ? 'font-semibold text-fg' : 'font-medium text-fg-2'}`}>{c.title}</span>
                      <span className="text-xs text-fg-3">{c.document_count} materials · {c.enrolled_count} students</span>
                    </button>
                  );
                })}
            </nav>
          </aside>

          <section className="flex min-w-0 flex-col gap-6" aria-label="Course">
            {!selected ? <Skeleton className="h-40" /> : (
              <>
                <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="accent" mono>{selected.code}</Badge>
                      <Badge tone={selected.is_published ? 'success' : 'neutral'} dot>{selected.is_published ? 'Published' : 'Draft — hidden from students'}</Badge>
                    </div>
                    <h2 className="mt-2.5 text-xl font-semibold tracking-tight text-fg">{selected.title}</h2>
                    <p className="mt-1 max-w-[60ch] text-[13px] text-fg-3">{selected.description || selected.subject_name}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                    <dl className="grid grid-cols-3 gap-6 sm:text-right">
                      <div><dt className="text-xs text-fg-3">Students</dt><dd className="mt-0.5 text-lg font-semibold tabular text-fg">{selected.enrolled_count ?? 0}</dd></div>
                      <div><dt className="text-xs text-fg-3">Materials</dt><dd className="mt-0.5 text-lg font-semibold tabular text-fg">{docsState === 'ready' ? docs.length : '–'}</dd></div>
                      <div><dt className="text-xs text-fg-3">Ready</dt><dd className="mt-0.5 text-lg font-semibold tabular text-fg">{docsState === 'ready' ? counts.completed || 0 : '–'}</dd></div>
                    </dl>
                    <Button size="sm" variant={selected.is_published ? 'secondary' : 'primary'} iconLeft={selected.is_published ? EyeOff : Eye} loading={busy} onClick={togglePublish}>
                      {selected.is_published ? 'Unpublish' : 'Publish course'}
                    </Button>
                  </div>
                </div>

                <div role="tablist" aria-label="Course sections" className="-mb-2 flex gap-5 border-b border-border">
                  {[['materials', 'Materials', FolderOpen], ['students', 'Students', Users]].map(([id, label, Icon]) => (
                    <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
                      className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-2.5 text-[14px] font-medium transition-colors ${view === id ? 'border-fg text-fg' : 'border-transparent text-fg-3 hover:text-fg'}`}>
                      <Icon className="size-4" aria-hidden />{label}
                    </button>
                  ))}
                </div>

                {view === 'students' ? <Roster course={selected} /> : docsState === 'loading' ? (
                  <div className="flex flex-col gap-3"><Skeleton className="h-16" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
                ) : docsState === 'error' ? (
                  <ErrorState title="Couldn’t load this course" onRetry={() => fetchCourse()} />
                ) : (
                  <>
                    <div ref={uploaderRef}>
                      <Uploader course={selected} structure={structure} topicId={uploadTopic} setTopicId={setUploadTopic}
                        onUploaded={(d) => { setDocs((list) => [d, ...list]); fetchCourses(selected.id); }} />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[15px] font-semibold text-fg">Units & topics</h3>
                      <div className="flex items-center gap-2">
                        {docs.length > 6 && <SearchInput icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter files" aria-label="Filter files" className="w-40 sm:w-56" />}
                        <Button size="sm" variant="secondary" iconLeft={FolderPlus} onClick={() => setNameDialog({ mode: 'new-unit' })}>Add unit</Button>
                      </div>
                    </div>

                    {structure.length === 0 && !(docsByTopic.none || []).length ? (
                      <div className="rounded-lg border border-dashed border-border-strong">
                        <EmptyState compact icon={FolderPlus} title="Structure this course" description="Add units (modules), then topics inside them. Materials are filed under topics." action={<Button size="sm" iconLeft={FolderPlus} onClick={() => setNameDialog({ mode: 'new-unit' })}>Add the first unit</Button>} />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-6">
                        {structure.map((u) => (
                          <div key={u.id}>
                            <div className="mb-2 flex items-center gap-2">
                              <h4 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">{u.title}</h4>
                              <IconButton icon={Plus} label={`Add topic to ${u.title}`} size="sm" onClick={() => setNameDialog({ mode: 'new-topic', unit: u })} />
                              <IconButton icon={Pencil} label={`Rename ${u.title}`} size="sm" onClick={() => setNameDialog({ mode: 'edit-unit', unit: u })} />
                              <IconButton icon={Trash2} label={`Delete ${u.title}`} size="sm" className="hover:!text-error" onClick={() => setConfirm({ kind: 'unit', item: u })} />
                            </div>
                            <div className="flex flex-col gap-2.5">
                              {u.topics.length === 0 && (
                                <button onClick={() => setNameDialog({ mode: 'new-topic', unit: u })} className="rounded-lg border border-dashed border-border-strong px-4 py-3 text-left text-[13px] text-fg-3 transition-colors hover:border-fg-3 hover:text-fg">
                                  + Add a topic to this unit
                                </button>
                              )}
                              {u.topics.map((t) => {
                                const list = docsByTopic[t.id] || [];
                                return (
                                  <div key={t.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                                    <div className="flex items-center gap-2 border-b border-border bg-subtle/40 py-1.5 pr-1.5 pl-4">
                                      <FolderOpen className="size-4 shrink-0 text-fg-3" aria-hidden />
                                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-fg">{t.title}</span>
                                      <span className="shrink-0 text-xs text-fg-3">{list.length}</span>
                                      <IconButton icon={UploadCloud} label={`Upload to ${t.title}`} size="sm" onClick={() => addToTopic(t.id)} />
                                      <IconButton icon={Pencil} label={`Rename ${t.title}`} size="sm" onClick={() => setNameDialog({ mode: 'edit-topic', topic: t })} />
                                      <IconButton icon={Trash2} label={`Delete ${t.title}`} size="sm" className="hover:!text-error" onClick={() => setConfirm({ kind: 'topic', item: t })} />
                                    </div>
                                    {list.length ? (
                                      <ul className="divide-y divide-border">{list.map((d) => <DocLine key={d.id} d={d} />)}</ul>
                                    ) : (
                                      <p className="px-4 py-3 text-[13px] text-fg-3">Empty folder — {t.description || 'upload the first material for this topic.'}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {(docsByTopic.none || []).length > 0 && (
                          <div>
                            <h4 className="mb-2 text-[14px] font-semibold text-fg">Not filed under a topic</h4>
                            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">{docsByTopic.none.map((d) => <DocLine key={d.id} d={d} />)}</ul>
                          </div>
                        )}
                      </div>
                    )}

                    {hasPending && (
                      <p className="flex items-center gap-2 text-xs text-fg-3">
                        <RefreshCw className="size-3.5 animate-spin [animation-duration:2.5s]" aria-hidden />
                        Indexing in progress — statuses update automatically.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <NewCourseDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(c) => fetchCourses(c.id)} />
      <DocumentSheet doc={openDoc} onClose={() => setOpenDoc(null)} onReprocess={reprocess} onDelete={(d) => setConfirm({ kind: 'doc', item: d })} />
      <NameDialog
        open={!!nameDialog}
        onClose={() => setNameDialog(null)}
        onSubmit={saveName}
        title={{ 'new-unit': 'Add a unit', 'edit-unit': 'Edit unit', 'new-topic': 'Add a topic', 'edit-topic': 'Edit topic' }[nameDialog?.mode] || ''}
        description={nameDialog?.mode === 'new-topic' ? `Inside ${nameDialog.unit.title}` : undefined}
        initial={nameDialog?.mode === 'edit-unit' ? { title: nameDialog.unit.title, description: nameDialog.unit.description || '' }
          : nameDialog?.mode === 'edit-topic' ? { title: nameDialog.topic.title, description: nameDialog.topic.description || '' }
            : { title: nameDialog?.mode === 'new-unit' ? `Unit ${structure.length + 1} · ` : '', description: '' }}
        confirmLabel={nameDialog?.mode?.startsWith('new') ? 'Add' : 'Save'}
      />
      <Modal
        isOpen={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        title={confirm ? { doc: 'Delete this document?', unit: 'Delete this unit?', topic: 'Delete this topic?' }[confirm.kind] : ''}
        description={confirm?.kind === 'doc'
          ? `“${confirm.item.title}” will be removed for students and from the assistant’s search. This can’t be undone.`
          : 'Only empty folders can be deleted — move or delete their materials first.'}
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button><Button variant="danger" iconLeft={Trash2} onClick={doConfirm} loading={busy}>Delete</Button></>}
      />
    </div>
  );
}
