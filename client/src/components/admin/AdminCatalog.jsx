import React, { useMemo, useState } from 'react';
import { ChevronDown, Layers, Pencil, Plus, Search } from 'lucide-react';
import api, { extractErrorMessage } from '../auth/api';
import { useToast } from '../ui/Toast';
import { PageHeader } from '../ui/PageHeader';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, SearchInput } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { fetchAll, useAsync } from './useAdminData';

function SubjectDialog({ subject, open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    if (open) { setForm(subject ? { name: subject.name, code: subject.code, description: subject.description || '' } : { name: '', code: '', description: '' }); setErrors({}); }
  }, [open, subject]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Enter a name.';
    if (!form.code.trim()) errs.code = 'Enter a code.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      if (subject) await api.patch(`/academic/subjects/${subject.id}/`, form);
      else await api.post('/academic/subjects/', form);
      toast.success(subject ? 'Subject updated.' : 'Subject created.');
      onSaved();
      onClose();
    } catch (err) {
      const d = err.response?.data?.error?.details || {};
      if (d.code || d.name) setErrors({ code: d.code && [].concat(d.code).join(' '), name: d.name && [].concat(d.name).join(' ') });
      else toast.error(extractErrorMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={subject ? 'Edit subject' : 'New subject'} description="Subjects group related courses in the catalog."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="subject-form" loading={saving}>{subject ? 'Save' : 'Create subject'}</Button></>}>
      <form id="subject-form" onSubmit={submit} className="flex flex-col gap-4 pt-1" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} data-autofocus />
          <Input label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} error={errors.code} className="font-mono uppercase" />
        </div>
        <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </form>
    </Modal>
  );
}

export function AdminCatalog() {
  const toast = useToast();
  const { data, state, reload } = useAsync(async () => {
    const [subjects, courses, teachers] = await Promise.all([
      fetchAll('/academic/subjects/'),
      fetchAll('/academic/courses/'),
      fetchAll('/accounts/users/', { role: 'teacher' }),
    ]);
    return { subjects, courses, teachers };
  }, []);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null); // {subject?} | null
  const [savingId, setSavingId] = useState(null);

  const courses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.courses || [])
      .filter((c) => !q || `${c.code} ${c.title} ${c.subject_name} ${c.teacher_name}`.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [data, query]);

  const patchCourse = async (course, body, message) => {
    setSavingId(course.id);
    try {
      await api.patch(`/academic/courses/${course.id}/`, body);
      toast.success(message);
      await reload();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Courses"
        description="Subjects, the courses filed under them, who teaches each course, and whether students can see it."
        actions={<Button iconLeft={Plus} onClick={() => setDialog({})}>New subject</Button>}
      />

      {state === 'loading' && !data ? (
        <div className="flex flex-col gap-4"><div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-64" /></div>
      ) : state === 'error' ? (
        <div className="rounded-lg border border-border bg-surface"><ErrorState title="Couldn’t load the catalog" onRetry={reload} /></div>
      ) : (
        <>
          <section aria-labelledby="subjects-h">
            <h2 id="subjects-h" className="mb-3 text-[15px] font-semibold text-fg">Subjects <span className="ml-1 text-fg-3 tabular">{data.subjects.length}</span></h2>
            {data.subjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-strong"><EmptyState compact icon={Layers} title="No subjects yet" description="Create a subject before adding courses." /></div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.subjects.map((s) => {
                  const list = data.courses.filter((c) => c.subject === s.id);
                  return (
                    <li key={s.id} className="flex flex-col rounded-lg border border-border bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Badge tone="accent" mono>{s.code}</Badge>
                        <div className="-mt-1 -mr-1 flex items-center gap-1">
                          {!s.is_active && <Badge>Inactive</Badge>}
                          <IconButton icon={Pencil} label={`Edit ${s.name}`} size="sm" onClick={() => setDialog({ subject: s })} />
                        </div>
                      </div>
                      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-fg">{s.name}</h3>
                      {s.description && <p className="mt-1 line-clamp-2 text-[13px] text-fg-3">{s.description}</p>}
                      <p className="mt-auto pt-4 text-[12.5px] text-fg-3">
                        <span className="font-medium tabular text-fg-2">{list.length}</span> {list.length === 1 ? 'course' : 'courses'}
                        {list.length > 0 && <> · {list.map((c) => c.code).join(', ')}</>}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="courses-h" className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="courses-h" className="text-[15px] font-semibold text-fg">Courses <span className="ml-1 text-fg-3 tabular">{data.courses.length}</span></h2>
              <SearchInput icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a course" aria-label="Find a course" className="w-full sm:w-64" />
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              {courses.length === 0 ? (
                <EmptyState compact icon={Layers} title="No courses match" description="Try a different code, title or teacher." />
              ) : (
                <ul className="divide-y divide-border">
                  {courses.map((c) => (
                    <li key={c.id} className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="accent" mono>{c.code}</Badge>
                          <span className="truncate text-[14px] font-semibold text-fg">{c.title}</span>
                        </div>
                        <p className="mt-1 text-[12.5px] text-fg-3">
                          {c.subject_name} · <span className="tabular">{c.enrolled_count}</span> students · <span className="tabular">{c.document_count}</span> materials · <span className="tabular">{c.unit_count}</span> units
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="relative inline-flex items-center">
                          <span className="sr-only">Teacher for {c.code}</span>
                          <select
                            value={c.teacher || ''}
                            disabled={savingId === c.id}
                            onChange={(e) => patchCourse(c, { teacher: e.target.value || null }, `${c.code} reassigned.`)}
                            className="h-8 w-48 appearance-none truncate rounded-md border border-border bg-surface pr-8 pl-2.5 text-[13px] text-fg hover:border-border-strong disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {data.teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 size-4 text-fg-3" aria-hidden />
                        </label>
                        <Button
                          size="sm"
                          variant={c.is_published ? 'secondary' : 'primary'}
                          loading={savingId === c.id}
                          onClick={() => patchCourse(c, { is_published: !c.is_published }, c.is_published ? `${c.code} unpublished.` : `${c.code} published.`)}
                          className="w-28"
                        >
                          {c.is_published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Badge tone={c.is_published ? 'success' : 'neutral'} dot className="w-24 justify-center">{c.is_published ? 'Published' : 'Draft'}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      <SubjectDialog open={!!dialog} subject={dialog?.subject} onClose={() => setDialog(null)} onSaved={reload} />
    </div>
  );
}
