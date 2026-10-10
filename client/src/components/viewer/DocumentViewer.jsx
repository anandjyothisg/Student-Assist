import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Download, FileText, FolderOpen, Layers, Minus,
  NotebookPen, Plus, Search, Sparkles, Trash2, Type, X,
} from 'lucide-react';
import api, { extractErrorMessage, rootApi } from '../auth/api';
import { useToast } from '../ui/Toast';
import { useMediaQuery } from '../ui/useMediaQuery';
import { AiChatWindow } from '../chat/AiChatWindow';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { useRoute } from '../layout/useRoute';
import { navigate, replaceParams } from '../layout/navConfig';
import { forgetMaterial, rememberOpened } from '../home/recent';

const NOTES_KEY = 'sources_notes';
const LAST_COURSE_KEY = 'sources_course';

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}') || {}; } catch { return {}; }
}

const TYPE_TONE = { pdf: 'text-[#b4483c] dark:text-[#f0948a]', docx: 'text-[#3b6bb5] dark:text-[#8fb3ee]', txt: 'text-fg-3', pptx: 'text-[#c06a1c]' };

function highlight(text, term) {
  if (!term || term.length < 2) return text;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.split(new RegExp(`(${safe})`, 'gi')).map((part, i) =>
    part.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="rounded-xs bg-accent-dim px-0.5 text-fg ring-1 ring-accent/40">{part}</mark>
      : part,
  );
}

async function downloadDocument(doc, toast) {
  try {
    const res = await api.get(`/documents/${doc.id}/download/`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    const ext = { pdf: 'pdf', docx: 'docx', txt: 'txt', pptx: 'pptx' }[doc.file_type] || 'bin';
    a.href = url;
    a.download = `${doc.title.replace(/[^\w\s.-]+/g, '').trim() || 'document'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    toast.error('The original file couldn’t be downloaded.');
  }
}

/* ─── Document row ────────────────────────────────────────────────────── */
function DocRow({ d, onOpen, showPlace }) {
  return (
    <button
      onClick={() => onOpen(d)}
      className="group flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-subtle/60 focus-visible:outline-offset-[-2px]"
    >
      <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-2 transition-colors group-hover:bg-accent-dim group-hover:text-accent">
        <FileText className="size-[18px]" aria-hidden />
        <span className={`absolute -right-1 -bottom-1 rounded-xs bg-surface px-1 font-mono text-[9px] font-semibold uppercase ring-1 ring-border ${TYPE_TONE[d.file_type] || 'text-fg-3'}`}>{d.file_type}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-fg">{d.title}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-fg-3">
          {showPlace
            ? [d.course_code, d.unit_title, d.topic_title].filter(Boolean).join(' · ')
            : [d.category, d.page_count ? `${d.page_count} pages` : null, d.uploaded_by_name].filter(Boolean).join(' · ')}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}

/* ─── Library ─────────────────────────────────────────────────────────── */
function Library({ onOpen, onNavigate }) {
  const [courses, setCourses] = useState([]);
  const [state, setState] = useState('loading');
  const [courseId, setCourseId] = useState(() => { try { return localStorage.getItem(LAST_COURSE_KEY); } catch { return null; } });
  const [structure, setStructure] = useState(null);
  const [docs, setDocs] = useState([]);
  const [courseState, setCourseState] = useState('idle');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);

  const loadCourses = useCallback(async () => {
    setState('loading');
    try {
      const res = await api.get('/academic/courses/', { params: { enrolled: 'true', page_size: 100 } });
      const list = res.data.results ?? res.data;
      setCourses(list);
      setCourseId((cur) => (list.some((c) => c.id === cur) ? cur : list[0]?.id ?? null));
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => { loadCourses(); }, [loadCourses]);

  const courseSeq = useRef(0);
  const loadCourse = useCallback(async () => {
    if (!courseId) return;
    const mine = ++courseSeq.current;
    setCourseState('loading');
    try {
      const [s, d] = await Promise.all([
        api.get(`/academic/courses/${courseId}/structure/`),
        api.get('/documents/', { params: { course: courseId, page_size: 100 } }),
      ]);
      if (mine !== courseSeq.current) return; // the student switched course meanwhile
      setStructure(s.data);
      setDocs(d.data.results ?? d.data);
      setCourseState('ready');
      try { localStorage.setItem(LAST_COURSE_KEY, courseId); } catch { /* ignore */ }
    } catch {
      if (mine === courseSeq.current) setCourseState('error');
    }
  }, [courseId]);
  useEffect(() => { loadCourse(); }, [loadCourse]);

  // Search across every enrolled course (debounced).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(null); return undefined; }
    let active = true; // ignore replies for an older query
    const t = setTimeout(() => {
      api.get('/documents/', { params: { search: q, page_size: 50 } })
        .then((r) => { if (active) setResults(r.data.results ?? r.data); })
        .catch(() => { if (active) setResults([]); });
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  const course = courses.find((c) => c.id === courseId);
  const docsByTopic = useMemo(() => docs.reduce((acc, d) => { (acc[d.topic || 'none'] ||= []).push(d); return acc; }, {}), [docs]);
  const unfiled = docsByTopic.none || [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-14 sm:px-6 md:px-8 md:pt-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="hero-title text-[1.875rem] sm:text-[2.25rem]">Study Materials</h1>
            <p className="mt-1.5 max-w-[58ch] text-sm text-fg-3">Notes and files from your teachers, organised by topic. Open one to read it, and ask the AI about it as you go.</p>
          </div>
          {state === 'ready' && courses.length > 0 && (
            <SearchInput icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all your materials" aria-label="Search materials" className="w-full sm:w-72" />
          )}
        </header>

        {state === 'loading' ? (
          <div className="mt-8 flex flex-col gap-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        ) : state === 'error' ? (
          <div className="mt-8 rounded-lg border border-border bg-surface"><ErrorState title="Couldn’t load your courses" onRetry={loadCourses} /></div>
        ) : courses.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border-strong">
            <EmptyState icon={BookOpen} title="You’re not enrolled in any courses" description="Enroll in a course to see its materials here." action={<Button onClick={() => onNavigate?.('courses')}>Browse courses</Button>} />
          </div>
        ) : results ? (
          <section className="mt-8" aria-label="Search results">
            <p className="mb-3 text-[13px] text-fg-3">{results.length} {results.length === 1 ? 'result' : 'results'} for “{query.trim()}”</p>
            {results.length ? (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {results.map((d) => <li key={d.id}><DocRow d={d} onOpen={onOpen} showPlace /></li>)}
              </ul>
            ) : (
              <EmptyState compact icon={Search} title="No matching materials" description="Try a different word, or ask the assistant — it searches inside documents too." />
            )}
          </section>
        ) : (
          <>
            <div role="tablist" aria-label="Your courses" className="-mx-1 mt-7 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
              {courses.map((c) => {
                const active = c.id === courseId;
                return (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCourseId(c.id)}
                    className={`flex shrink-0 flex-col items-start rounded-lg border px-3.5 py-2 text-left transition-colors ${active ? 'border-fg bg-surface shadow-xs' : 'border-border hover:border-border-strong hover:bg-surface/60'}`}
                  >
                    <span className={`font-mono text-[11px] ${active ? 'text-accent' : 'text-fg-3'}`}>{c.code}</span>
                    <span className={`text-[13.5px] ${active ? 'font-semibold text-fg' : 'font-medium text-fg-2'}`}>{c.title}</span>
                  </button>
                );
              })}
            </div>

            {course && (
              <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="hidden lg:block">
                  <div className="sticky top-6">
                    <p className="mb-2 text-xs font-medium text-fg-3">In this course</p>
                    <nav aria-label="Course outline" className="flex flex-col gap-3 border-l border-border pl-3">
                      {(structure || []).map((u) => (
                        <div key={u.id}>
                          <a href={`#unit-${u.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`unit-${u.id}`)?.scrollIntoView({ behavior: 'smooth' }); }} className="block text-[13px] font-semibold text-fg-2 hover:text-fg">
                            {u.title.replace(/^Unit \d+\s*·\s*/, '')}
                          </a>
                          <ul className="mt-1 flex flex-col gap-0.5">
                            {u.topics.map((t) => (
                              <li key={t.id} className="flex items-center justify-between gap-2 text-[12.5px] text-fg-3">
                                <span className="truncate">{t.title}</span>
                                <span className="tabular">{t.document_count}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </nav>
                  </div>
                </aside>

                <div className="min-w-0">
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold tracking-tight text-fg">{course.title}</h2>
                      <p className="mt-1 max-w-[62ch] text-[13.5px] text-fg-3">{course.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[12.5px] text-fg-3">
                      <Badge tone="accent" mono>{course.code}</Badge>
                      <span>{course.teacher_name}</span>
                    </div>
                  </div>

                  {courseState === 'loading' ? (
                    <div className="flex flex-col gap-4"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
                  ) : courseState === 'error' ? (
                    <ErrorState title="Couldn’t load this course" onRetry={loadCourse} />
                  ) : (
                    <div className="flex flex-col gap-10">
                      {(structure || []).map((u) => (
                        <section key={u.id} id={`unit-${u.id}`} aria-labelledby={`unit-h-${u.id}`} className="scroll-mt-6">
                          <h3 id={`unit-h-${u.id}`} className="text-[15px] font-semibold text-fg">{u.title}</h3>
                          {u.description && <p className="mt-0.5 text-[13px] text-fg-3">{u.description}</p>}
                          <div className="mt-3 flex flex-col gap-3">
                            {u.topics.map((t) => {
                              const list = docsByTopic[t.id] || [];
                              return (
                                <div key={t.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                                  <div className="flex items-center gap-2.5 border-b border-border bg-subtle/40 px-4 py-2.5">
                                    <FolderOpen className="size-4 shrink-0 text-fg-3" aria-hidden />
                                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-fg">{t.title}</span>
                                    <span className="shrink-0 text-xs text-fg-3">{list.length} {list.length === 1 ? 'file' : 'files'}</span>
                                  </div>
                                  {list.length ? (
                                    <ul className="divide-y divide-border">{list.map((d) => <li key={d.id}><DocRow d={d} onOpen={onOpen} /></li>)}</ul>
                                  ) : (
                                    <p className="px-4 py-4 text-[13px] text-fg-3">{t.description || 'No materials have been published for this topic yet.'}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                      {unfiled.length > 0 && (
                        <section>
                          <h3 className="text-[15px] font-semibold text-fg">Other materials</h3>
                          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                            {unfiled.map((d) => <li key={d.id}><DocRow d={d} onOpen={onOpen} /></li>)}
                          </ul>
                        </section>
                      )}
                      {!structure?.length && !unfiled.length && (
                        <EmptyState icon={FolderOpen} title="Nothing published yet" description="Your teacher hasn’t added materials to this course." />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Notes ───────────────────────────────────────────────────────────── */
function NotesPanel({ notes, page, onAdd, onDelete }) {
  const [text, setText] = useState('');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText(''); } }} className="flex shrink-0 flex-col gap-2 border-b border-border p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={`Note for page ${page}…`} aria-label="New note" className="field-control resize-none text-[13.5px]" />
        <Button type="submit" size="sm" variant="secondary" iconLeft={Plus} disabled={!text.trim()} className="self-end">Add note</Button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {notes.length === 0 ? (
          <EmptyState compact icon={NotebookPen} title="No notes yet" description="Notes are private and saved on this device, per document." />
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="group rounded-md border border-border bg-surface p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-accent">Page {n.page}</span>
                  <IconButton icon={Trash2} label="Delete note" size="sm" onClick={() => onDelete(n.id)} className="opacity-60 group-hover:opacity-100 pointer-coarse:opacity-100" />
                </div>
                <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-fg">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PaneTabs({ value, onChange, items }) {
  return (
    <div role="tablist" className="flex shrink-0 gap-1 border-b border-border px-2 py-1.5">
      {items.map(({ id, label, icon: Icon, count }) => (
        <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
          className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors ${value === id ? 'bg-subtle text-fg' : 'text-fg-3 hover:text-fg'}`}>
          <Icon className="size-3.5" aria-hidden />{label}{count ? <span className="tabular text-fg-3">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ─── Reader ──────────────────────────────────────────────────────────── */
function Reader({ docId, initialPage, onBack }) {
  const toast = useToast();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [doc, setDoc] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [state, setState] = useState('loading');
  const [page, setPage] = useState(initialPage || 1);
  const [find, setFind] = useState('');
  const [scale, setScale] = useState(1);
  const [pane, setPane] = useState('document');
  const [sideTab, setSideTab] = useState('copilot');
  const [allNotes, setAllNotes] = useState(loadNotes);
  const [generating, setGenerating] = useState(false);
  const [split, setSplit] = useState(58);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);

  const fetchDoc = useCallback(async () => {
    setState('loading');
    try {
      const [detail, chunkRes] = await Promise.all([
        api.get(`/documents/${docId}/`),
        api.get(`/documents/${docId}/chunks/`, { params: { all: 'true' } }),
      ]);
      setDoc(detail.data);
      setChunks(Array.isArray(chunkRes.data) ? chunkRes.data : chunkRes.data.results ?? []);
      setState('ready');
      rememberOpened(detail.data);
    } catch (err) {
      const missing = err.response?.status === 404 || err.response?.status === 403;
      if (missing) forgetMaterial(docId);
      setState(missing ? 'missing' : 'error');
    }
  }, [docId]);
  useEffect(() => { fetchDoc(); }, [fetchDoc]);
  useEffect(() => { if (initialPage) setPage(initialPage); }, [initialPage]);

  const pages = useMemo(() => {
    const map = new Map();
    chunks.forEach((c) => { const p = c.page_number || 1; if (!map.has(p)) map.set(p, []); map.get(p).push(c); });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [chunks]);
  const pageNumbers = pages.map(([p]) => p);
  const pageIdx = Math.max(0, pageNumbers.indexOf(page));
  const currentPage = pageNumbers[pageIdx] ?? 1;
  const current = pages[pageIdx]?.[1] ?? [];
  const goTo = (p) => { setPage(p); replaceParams({ doc: docId, page: p }); scrollRef.current?.scrollTo({ top: 0 }); };

  const matches = useMemo(() => {
    if (find.trim().length < 2) return [];
    const q = find.toLowerCase();
    return pages.filter(([, cs]) => cs.some((c) => c.content.toLowerCase().includes(q))).map(([p]) => p);
  }, [find, pages]);

  const notes = allNotes[docId] || [];
  const persistNotes = (next) => {
    const all = { ...allNotes, [docId]: next };
    setAllNotes(all);
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(all)); } catch { /* storage full */ }
  };

  const makeFlashcards = async () => {
    setGenerating(true);
    try {
      const res = await rootApi.post('/api/assistant/flashcard/generate/', { document_id: docId, count: 6 });
      const n = res.data?.cards?.length || 0;
      if (n) toast.success(`${n} flashcards added to your notebook.`);
      else toast.warning('No flashcards could be made from this document.');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const startResize = (e) => {
    e.preventDefault();
    const move = (ev) => {
      const r = containerRef.current?.getBoundingClientRect();
      if (r) setSplit(Math.min(72, Math.max(40, ((ev.clientX - r.left) / r.width) * 100)));
    };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  if (state === 'missing') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState icon={FileText} title="This document isn’t available" description="It may have been removed, or it belongs to a course you’re not enrolled in." action={<Button onClick={onBack} iconLeft={ArrowLeft}>Back to Study Materials</Button>} />
      </div>
    );
  }

  const toolbar = (
    <div className="flex shrink-0 items-center gap-x-3 gap-y-2 border-b border-border bg-canvas px-3 py-2 sm:px-4">
      <IconButton icon={ArrowLeft} label="Back to Study Materials" onClick={onBack} size="sm" />
      <div className="min-w-0 flex-1">
        {doc ? (
          <>
            <p className="truncate text-[14px] font-semibold leading-tight text-fg">{doc.title}</p>
            <p className="truncate text-xs text-fg-3">{[doc.course_code, doc.unit_title, doc.topic_title].filter(Boolean).join(' · ')}</p>
          </>
        ) : <Skeleton className="h-4 w-48" />}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton icon={Download} label="Download original" size="sm" onClick={() => doc && downloadDocument(doc, toast)} disabled={!doc} />
        <Button size="sm" variant="secondary" iconLeft={Layers} loading={generating} onClick={makeFlashcards} disabled={state !== 'ready' || chunks.length === 0}>
          <span className="hidden sm:inline">{generating ? 'Making cards…' : 'Make flashcards'}</span>
          <span className="sm:hidden">Cards</span>
        </Button>
      </div>
    </div>
  );

  const documentColumn = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5 sm:px-4">
        <div className="flex items-center gap-0.5">
          <IconButton icon={ChevronLeft} label="Previous page" size="sm" disabled={pageIdx <= 0} onClick={() => goTo(pageNumbers[pageIdx - 1])} />
          <span className="min-w-16 text-center font-mono text-xs tabular text-fg-2">{pages.length ? `${currentPage} / ${pageNumbers[pageNumbers.length - 1]}` : '–'}</span>
          <IconButton icon={ChevronRight} label="Next page" size="sm" disabled={pageIdx >= pages.length - 1} onClick={() => goTo(pageNumbers[pageIdx + 1])} />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          <div className="relative flex min-w-0 max-w-44 flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-fg-3" aria-hidden />
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find…" aria-label="Find in document" className="field-control !min-h-8 w-full !py-1 !pr-7 !pl-8 !text-[13px]" />
            {find && <button onClick={() => setFind('')} aria-label="Clear search" className="absolute right-1.5 rounded-sm p-1 text-fg-3 hover:text-fg"><X className="size-3.5" /></button>}
          </div>
          <span aria-hidden className="mx-1 hidden h-4 w-px bg-border sm:block" />
          <IconButton icon={Minus} label="Smaller text" size="sm" disabled={scale <= 0.85} onClick={() => setScale((s) => Math.max(0.85, +(s - 0.1).toFixed(2)))} />
          <Type className="size-3.5 text-fg-3" aria-hidden />
          <IconButton icon={Plus} label="Larger text" size="sm" disabled={scale >= 1.4} onClick={() => setScale((s) => Math.min(1.4, +(s + 0.1).toFixed(2)))} />
        </div>
      </div>

      {find.trim().length >= 2 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-subtle/50 px-4 py-2 text-xs text-fg-3">
          {matches.length ? (
            <>
              <span>Found on</span>
              {matches.map((p) => (
                <button key={p} onClick={() => goTo(p)} className={`rounded-sm px-1.5 py-0.5 font-mono transition-colors ${p === currentPage ? 'bg-accent-dim text-accent' : 'hover:bg-hover hover:text-fg'}`}>p.{p}</button>
              ))}
            </>
          ) : <span>No matches for “{find}”.</span>}
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-subtle/40 px-3 py-5 sm:px-6 sm:py-8">
        {state === 'loading' ? (
          <div className="mx-auto max-w-[700px] rounded-lg border border-border bg-surface p-6 sm:p-10">
            <Skeleton className="mb-6 h-5" width="50%" />
            <div className="flex flex-col gap-2.5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-3.5" width={`${92 - (i % 3) * 12}%`} />)}</div>
          </div>
        ) : state === 'error' ? (
          <ErrorState title="Couldn’t open this document" description="The connection dropped. Try again." onRetry={fetchDoc} />
        ) : chunks.length === 0 ? (
          <EmptyState icon={FileText} title="No readable text" description="This file has no text the app can read yet. Your teacher may need to upload it again." />
        ) : (
          <article className="mx-auto max-w-[700px] rounded-lg border border-border bg-surface px-6 py-8 shadow-sm sm:px-12 sm:py-12" style={{ fontSize: `${scale}rem` }}>
            <header className="mb-6 border-b border-border pb-4">
              <p className="font-mono text-[0.72em] text-fg-3">{doc?.course_code} · Page {currentPage}</p>
              <h2 className="mt-1 text-[1.2em] font-semibold leading-snug text-fg">{doc?.title}</h2>
            </header>
            <div className="flex flex-col gap-[0.9em] text-[0.95em] leading-[1.75] text-fg-2">
              {current.map((c) => (
                <p key={c.id} className="whitespace-pre-line">{highlight(c.content, find.trim())}</p>
              ))}
            </div>
            <footer className="mt-10 flex items-center justify-between border-t border-border pt-4 text-[0.75em] text-fg-3">
              <button disabled={pageIdx <= 0} onClick={() => goTo(pageNumbers[pageIdx - 1])} className="rounded-sm transition-colors enabled:hover:text-fg disabled:opacity-40">← Previous page</button>
              <span className="tabular">Page {currentPage}</span>
              <button disabled={pageIdx >= pages.length - 1} onClick={() => goTo(pageNumbers[pageIdx + 1])} className="rounded-sm transition-colors enabled:hover:text-fg disabled:opacity-40">Next page →</button>
            </footer>
          </article>
        )}
      </div>
    </div>
  );

  const notesPanel = (
    <NotesPanel
      notes={notes}
      page={currentPage}
      onAdd={(text) => persistNotes([{ id: Date.now(), page: currentPage, text }, ...notes])}
      onDelete={(id) => persistNotes(notes.filter((n) => n.id !== id))}
    />
  );
  const copilot = doc ? (
    <AiChatWindow
      key={doc.id}
      courseId={doc.course}
      contextLabel={`${doc.course_code} · ${doc.course_title}`}
      suggestions={[`Summarise “${doc.title}”`, 'What are the key definitions in this material?', 'Give me two practice questions on this topic']}
    />
  ) : <div className="p-4"><Skeleton className="h-24" /></div>;

  if (!isDesktop) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <PaneTabs value={pane} onChange={setPane} items={[
          { id: 'document', label: 'Document', icon: FileText },
          { id: 'copilot', label: 'Ask AI', icon: Sparkles },
          { id: 'notes', label: 'Notes', icon: NotebookPen, count: notes.length },
        ]} />
        <div className="min-h-0 flex-1">
          {pane === 'document' && documentColumn}
          {pane === 'copilot' && copilot}
          {pane === 'notes' && notesPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar}
      <div ref={containerRef} className="flex min-h-0 flex-1">
        <div style={{ width: `${split}%` }} className="min-w-0 shrink-0">{documentColumn}</div>
        <div
          role="separator" aria-orientation="vertical" aria-label="Resize panels" tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSplit((s) => Math.max(40, s - 2)); if (e.key === 'ArrowRight') setSplit((s) => Math.min(72, s + 2)); }}
          className="group relative w-px shrink-0 cursor-col-resize bg-border outline-none focus-visible:bg-accent"
        >
          <span className="absolute inset-y-0 -right-1.5 -left-1.5" />
          <span className="absolute top-1/2 left-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <aside className="flex min-w-0 flex-1 flex-col bg-canvas">
          <PaneTabs value={sideTab} onChange={setSideTab} items={[
            { id: 'copilot', label: 'Ask AI', icon: Sparkles },
            { id: 'notes', label: 'Notes', icon: NotebookPen, count: notes.length },
          ]} />
          <div className="min-h-0 flex-1">{sideTab === 'copilot' ? copilot : notesPanel}</div>
        </aside>
      </div>
    </div>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────────── */
export function DocumentViewer({ onNavigate }) {
  const route = useRoute();
  const docId = route.params.doc || null;
  const page = route.params.page ? Number(route.params.page) : null;

  if (docId) {
    return <Reader docId={docId} initialPage={page} onBack={() => replaceParams({})} />;
  }
  return <Library onOpen={(d) => navigate('documents', { doc: d.id })} onNavigate={onNavigate} />;
}

