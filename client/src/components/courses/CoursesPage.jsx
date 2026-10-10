import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, FileText, GraduationCap, LogOut, MessageCircle, Plus, Search, Users } from 'lucide-react';
import api, { extractErrorMessage } from '../auth/api';
import { useToast } from '../ui/Toast';
import { PageHeader } from '../ui/PageHeader';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';

function CourseCard({ c, enrolled, busy, onEnroll, onLeave, onNavigate }) {
  return (
    <li className="flex flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <Badge tone="accent" mono>{c.code}</Badge>
        <span className="text-xs text-fg-3">{c.subject_name}</span>
      </div>
      <h3 className="mt-3 text-[16px] font-semibold leading-snug text-fg">{c.title}</h3>
      <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-relaxed text-fg-3">{c.description}</p>
      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-fg-3">
        <div className="flex items-center gap-1.5"><dt className="sr-only">Teacher</dt><GraduationCap className="size-3.5" aria-hidden /><dd className="text-fg-2">{c.teacher_name || '—'}</dd></div>
        <div className="flex items-center gap-1.5"><dt className="sr-only">Materials</dt><FileText className="size-3.5" aria-hidden /><dd><span className="tabular text-fg-2">{c.document_count}</span> materials</dd></div>
        <div className="flex items-center gap-1.5"><dt className="sr-only">Students</dt><Users className="size-3.5" aria-hidden /><dd><span className="tabular text-fg-2">{c.enrolled_count}</span> students</dd></div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        {enrolled ? (
          <>
            <Button size="sm" iconLeft={BookOpen} onClick={() => { try { localStorage.setItem('sources_course', c.id); } catch { /* ignore */ } onNavigate?.('documents'); }}>Study materials</Button>
            <Button size="sm" variant="ghost" iconLeft={MessageCircle} onClick={() => onNavigate?.('assistant', { course: c.id })}>Ask AI</Button>
            <IconButton icon={LogOut} label={`Leave ${c.title}`} size="sm" onClick={() => onLeave(c)} className="ml-auto" />
          </>
        ) : c.enrollment_open ? (
          <Button size="sm" variant="secondary" iconLeft={Plus} loading={busy} onClick={() => onEnroll(c)}>Enroll</Button>
        ) : (
          <Badge>Enrollment closed</Badge>
        )}
      </div>
    </li>
  );
}

export function CoursesPage({ onNavigate }) {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [state, setState] = useState('loading');
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [leaving, setLeaving] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [c, e] = await Promise.all([
        api.get('/academic/courses/', { params: { page_size: 100 } }),
        api.get('/academic/enrollments/', { params: { page_size: 100 } }),
      ]);
      setCourses(c.data.results ?? c.data);
      setEnrollments(e.data.results ?? e.data);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const enrolledIds = useMemo(() => new Set(enrollments.map((e) => e.course.id)), [enrollments]);
  const q = query.trim().toLowerCase();
  const match = (c) => !q || `${c.code} ${c.title} ${c.subject_name} ${c.teacher_name}`.toLowerCase().includes(q);
  const mine = courses.filter((c) => enrolledIds.has(c.id) && match(c));
  const available = courses.filter((c) => !enrolledIds.has(c.id) && match(c));

  const enroll = async (c) => {
    setBusyId(c.id);
    try {
      await api.post('/academic/enrollments/', { course: c.id });
      toast.success(`You’re enrolled in ${c.title}.`);
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const leave = async () => {
    const c = leaving;
    const e = enrollments.find((x) => x.course.id === c.id);
    setLeaving(null);
    if (!e) return;
    try {
      await api.delete(`/academic/enrollments/${e.id}/`);
      toast.success(`You left ${c.title}.`);
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="My Courses"
        description="The courses you’re in, and others you can join. The AI Assistant answers from the materials of the courses you’re in."
        actions={state === 'ready' && <SearchInput icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a course" aria-label="Find a course" className="w-full sm:w-64" />}
      />

      {state === 'loading' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 !rounded-lg" />)}</div>
      ) : state === 'error' ? (
        <div className="rounded-lg border border-border bg-surface"><ErrorState title="Couldn’t load courses" onRetry={load} /></div>
      ) : (
        <>
          <section aria-labelledby="mine-h">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="mine-h" className="text-[15px] font-semibold text-fg">Your courses <span className="ml-1 text-fg-3 tabular">{enrolledIds.size}</span></h2>
            </div>
            {mine.length ? (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {mine.map((c) => <CourseCard key={c.id} c={c} enrolled onLeave={setLeaving} onNavigate={onNavigate} />)}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border-strong">
                <EmptyState compact icon={GraduationCap} title={q ? 'No enrolled courses match' : 'You aren’t enrolled in anything yet'} description={q ? 'Try a different search.' : 'Pick a course below to get started.'} />
              </div>
            )}
          </section>

          <section aria-labelledby="avail-h">
            <h2 id="avail-h" className="mb-3 text-[15px] font-semibold text-fg">Courses you can join <span className="ml-1 text-fg-3 tabular">{available.length}</span></h2>
            {available.length ? (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {available.map((c) => <CourseCard key={c.id} c={c} busy={busyId === c.id} onEnroll={enroll} />)}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-[13.5px] text-fg-3">
                <Check className="size-4 text-success" aria-hidden /> {q ? 'No other courses match your search.' : 'You’re enrolled in every published course.'}
              </p>
            )}
          </section>
        </>
      )}

      <Modal
        isOpen={!!leaving}
        onClose={() => setLeaving(null)}
        title={leaving ? `Leave ${leaving.title}?` : ''}
        description="You’ll lose access to its materials and the assistant will stop searching them. You can enroll again at any time."
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setLeaving(null)}>Cancel</Button><Button variant="danger" onClick={leave}>Leave course</Button></>}
      />
    </div>
  );
}
