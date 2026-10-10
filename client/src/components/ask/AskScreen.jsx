import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowUpRight, Bookmark, BookmarkCheck, Check, ChevronDown, Copy, ExternalLink, FileText,
  History, Info, MessageSquarePlus, Pencil, SearchX, Trash2,
} from 'lucide-react';
import api, { chatApi, extractErrorMessage, streamChat } from '../auth/api';
import { useToast } from '../ui/Toast';
import { Composer } from '../ui/Composer';
import { Markdown } from '../ui/Markdown';
import { Modal, Sheet } from '../ui/Modal';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { BrandMark } from '../ui/BrandMark';
import { copyText } from '../ui/clipboard';
import { useMediaQuery } from '../ui/useMediaQuery';
import { useRoute } from '../layout/useRoute';
import { replaceParams } from '../layout/navConfig';

const SUGGESTIONS = {
  'ML-302': 'How does gradient descent update the weights in linear regression?',
  'CS-305': 'What is the difference between 3NF and BCNF?',
  'CS-308': 'Explain the TCP three-way handshake.',
  'AI-301': 'Why is A* search optimal when the heuristic is admissible?',
  'CS-201': 'Why does quicksort take O(n²) time in the worst case?',
  'CS-304': 'What are the four necessary conditions for deadlock?',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function groupSessions(sessions) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const groups = { Today: [], 'Previous 7 days': [], Earlier: [] };
  sessions.forEach((s) => {
    const d = new Date(s.updated_at);
    if (d >= startToday) groups.Today.push(s);
    else if (now - d < 7 * 86400000) groups['Previous 7 days'].push(s);
    else groups.Earlier.push(s);
  });
  return Object.entries(groups).filter(([, v]) => v.length);
}

/* ─── Conversation history list ───────────────────────────────────────── */
function ConversationList({ sessions, state, activeId, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');

  if (state === 'loading') {
    return <div className="flex flex-col gap-2 p-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>;
  }
  if (!sessions.length) {
    return <p className="px-4 py-6 text-[13px] leading-relaxed text-fg-3">No chats yet. Your chats will appear here.</p>;
  }
  return (
    <nav aria-label="Chat history" className="flex flex-col gap-4 p-2">
      {groupSessions(sessions).map(([label, items]) => (
        <div key={label}>
          <p className="px-2.5 pb-1 text-[11.5px] font-medium text-fg-3">{label}</p>
          <ul className="flex flex-col gap-px">
            {items.map((s) => {
              const active = s.id === activeId;
              return (
                <li key={s.id} className="group relative">
                  {editing === s.id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); if (title.trim()) onRename(s.id, title.trim()); setEditing(null); }}
                      className="px-1"
                    >
                      <input
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                        aria-label="Chat name"
                        className="field-control !min-h-9 !py-1.5 text-[13px]"
                      />
                    </form>
                  ) : (
                    <>
                      <button
                        onClick={() => onSelect(s.id)}
                        aria-current={active ? 'true' : undefined}
                        className={`flex w-full flex-col items-start rounded-md px-2.5 py-2 pr-16 text-left transition-colors ${active ? 'bg-subtle' : 'hover:bg-subtle/70'}`}
                      >
                        <span className={`w-full truncate text-[13.5px] ${active ? 'font-semibold text-fg' : 'text-fg-2'}`}>{s.title || 'Untitled chat'}</span>
                        <span className="mt-0.5 font-mono text-[11px] text-fg-3">{s.course_code || 'All my courses'}</span>
                      </button>
                      <div className="absolute top-1.5 right-1 flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
                        <IconButton icon={Pencil} label="Rename chat" size="sm" onClick={() => { setEditing(s.id); setTitle(s.title); }} />
                        <IconButton icon={Trash2} label="Delete chat" size="sm" className="hover:!text-error" onClick={() => onDelete(s)} />
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/* ─── Scope picker ─────────────────────────────────────────────────────── */
function ScopePicker({ courses, value, onChange, locked }) {
  const current = courses.find((c) => c.id === value);
  if (locked) {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-md bg-subtle px-2.5 text-[13px] text-fg-2">
        <span className="text-fg-3">Asking about</span>
        <span className="font-medium text-fg">{current ? current.code : 'All my courses'}</span>
      </span>
    );
  }
  return (
    <label className="relative inline-flex h-9 items-center" title="Choose which course the AI answers from">
      <span className="sr-only">Ask about</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 max-w-[15rem] appearance-none truncate rounded-md border border-border bg-surface py-0 pr-8 pl-2.5 text-[13px] font-medium text-fg transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent"
      >
        <option value="">All my courses</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-fg-3" aria-hidden />
    </label>
  );
}

/* ─── One assistant answer ─────────────────────────────────────────────── */
function SourceList({ items, onCite, muted = false }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {items.map((c, i) => (
        <li key={c.chunk_id || i} className="max-w-full">
          <button
            onClick={() => onCite(c)}
            className={`group inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-surface py-1.5 pr-2.5 pl-1.5 text-left text-[12.5px] transition-colors hover:border-border-strong ${muted ? 'opacity-80' : ''}`}
          >
            <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-sm font-mono text-[11px] font-semibold ${muted ? 'bg-subtle text-fg-3' : 'bg-accent-dim text-accent'}`}>{c.index || i + 1}</span>
            <span className="truncate font-medium text-fg-2 group-hover:text-fg">{c.document_title}</span>
            <span className="shrink-0 font-mono text-[11px] text-fg-3">{c.course_code} · p.{c.page_number}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Answer({ msg, onCite, onRetry }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (msg.error) {
    return <ErrorState variant="inline" title="We couldn’t answer that" description={msg.error} onRetry={onRetry} />;
  }

  const notFound = msg.status === 'not_found';
  const offline = msg.status === 'model_unavailable';
  const all = msg.citations ?? [];
  const byIndex = (n) => all.find((c) => (c.index ?? all.indexOf(c) + 1) === n);
  // Final answers flag which passages they actually cite; older answers have no flag.
  const sources = all.filter((c) => c.cited !== false);
  const alsoRetrieved = all.filter((c) => c.cited === false);
  const matchedByWording = sources.some((c) => c.attributed);
  const sourcesLabel = offline
    ? 'Matching parts of your materials'
    : sources.length
      ? (matchedByWording ? 'Sources (matched by wording; the AI didn’t point to them itself)' : 'Sources')
      : null;

  const save = async () => {
    setSaving(true);
    try {
      await chatApi.save(msg.id);
      setSaved(true);
      toast.success('Saved to your notebook.');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="flex flex-col gap-3" aria-busy={msg.streaming || undefined}>
      <div className="flex items-center gap-2.5">
        <BrandMark size={22} />
        <span className="text-[13px] font-semibold text-fg">AuraStudy</span>
        {sources.length > 0 && !notFound && !msg.streaming && (
          <span className="text-xs text-fg-3">· {sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>
        )}
      </div>

      <div className="sm:pl-[34px]">
        {notFound ? (
          <div className="flex gap-3 rounded-lg border border-border bg-subtle/60 px-4 py-3">
            <SearchX className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
            <p className="text-[14px] leading-relaxed text-fg-2">{msg.content}</p>
          </div>
        ) : msg.streaming && !msg.content ? (
          <div className="flex items-center gap-2.5 py-1 text-[13px] text-fg-3" role="status">
            <span className="ai-thinking-line !w-12" />
            {msg.citations?.length ? 'Thinking… reading your course materials' : 'Looking through your course materials…'}
          </div>
        ) : (
          <>
            {offline && (
              <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-dim px-3.5 py-2.5 text-[13px] text-fg-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                The AI is offline right now, so here are the matching parts of your materials instead of a written answer.
              </div>
            )}
            <Markdown onCite={(n) => onCite(byIndex(n))} isCiteValid={(n) => !!byIndex(n)}>{offline ? msg.content.split('\n').slice(1).join('\n') : msg.content}</Markdown>
            {msg.streaming && <span className="ai-cursor" aria-hidden />}
          </>
        )}

        {!notFound && all.length > 0 && !msg.streaming && (
          <div className="mt-4">
            {sourcesLabel && (
              <>
                <p className="mb-2 text-xs font-medium text-fg-3">{sourcesLabel}</p>
                <SourceList items={sources} onCite={onCite} />
              </>
            )}
            {!offline && !sources.length && (
              <p className="mb-2 text-xs text-fg-3">This answer doesn’t point to a specific page. Check it against the materials below.</p>
            )}
            {alsoRetrieved.length > 0 && (
              sources.length ? (
                <details className="mt-3 text-xs text-fg-3">
                  <summary className="cursor-pointer select-none font-medium hover:text-fg-2">Also found, not used in the answer ({alsoRetrieved.length})</summary>
                  <div className="mt-2"><SourceList items={alsoRetrieved} onCite={onCite} muted /></div>
                </details>
              ) : (
                <SourceList items={alsoRetrieved} onCite={onCite} muted />
              )
            )}
          </div>
        )}

        {!msg.streaming && !notFound && (
          <div className="-ml-2.5 mt-3 flex flex-wrap items-center gap-0.5">
            <button
              onClick={async () => { if (await copyText(msg.content)) { setCopied(true); setTimeout(() => setCopied(false), 1600); } }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-fg-3 transition-colors hover:bg-subtle hover:text-fg"
            >
              {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {msg.status === 'answered' && msg.id && !String(msg.id).startsWith('pending-') && (
              <button
                onClick={save}
                disabled={saved || saving}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors hover:bg-subtle hover:text-fg ${saved ? 'text-fg' : 'text-fg-3'}`}
              >
                {saved ? <BookmarkCheck className="size-3.5" aria-hidden /> : <Bookmark className="size-3.5" aria-hidden />}
                {saved ? 'Saved' : 'Save to notebook'}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* ─── Screen ───────────────────────────────────────────────────────────── */
export function AskScreen({ user, onNavigate }) {
  const toast = useToast();
  const route = useRoute();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const sessionParam = route.params.session || null;

  const [scopeCourses, setScopeCourses] = useState([]);
  const [scope, setScope] = useState('');
  const [health, setHealth] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsState, setSessionsState] = useState('loading');
  const [session, setSession] = useState(null); // {id, title, course, course_code}
  const [messages, setMessages] = useState([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [citation, setCitation] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const abortRef = useRef(null);
  const busyRef = useRef(false); // guards double submits within one render
  // Leaving the screen stops an answer that is still streaming.
  useEffect(() => () => abortRef.current?.abort(), []);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await chatApi.sessions());
      setSessionsState('ready');
    } catch {
      setSessionsState('error');
    }
  }, []);

  useEffect(() => {
    api.get('/ai/scope/').then((r) => setScopeCourses(r.data)).catch(() => setScopeCourses([]));
    api.get('/ai/health/').then((r) => setHealth(r.data)).catch(() => setHealth(null));
    refreshSessions();
  }, [refreshSessions]);

  // Home and My Courses can open this screen with a question (?q=) and/or a
  // course (?course=). The question is asked once, then removed from the URL.
  const startedFromLink = useRef(false);
  useEffect(() => {
    const { q, course } = route.params;
    if (sessionParam || startedFromLink.current || (!q && !course)) return;
    if (course && scopeCourses.length === 0) return; // wait until the course list has loaded
    startedFromLink.current = true;
    const known = course && scopeCourses.some((c) => c.id === course);
    if (known) setScope(course);
    replaceParams({});
    if (q) setTimeout(() => ask(q, known ? course : undefined), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.q, route.params.course, scopeCourses]);

  // Open the conversation named in the URL (also on refresh / back-forward).
  useEffect(() => {
    if (!sessionParam) {
      if (!busy) { setSession(null); setMessages([]); }
      return;
    }
    if (session?.id === sessionParam || busy) return;
    let cancelled = false;
    setLoadingSession(true);
    chatApi.session(sessionParam)
      .then((data) => {
        if (cancelled) return;
        setSession({ id: data.id, title: data.title, course: data.course, course_code: data.course_code });
        setScope(data.course || '');
        setMessages(data.messages.map((m) => ({ ...m })));
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('That chat is no longer available.');
        replaceParams({});
      })
      .finally(() => !cancelled && setLoadingSession(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionParam]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: busy ? 'auto' : 'smooth' });
  }, [messages, busy]);

  const newChat = () => {
    abortRef.current?.abort();
    setSession(null);
    setMessages([]);
    setQuery('');
    setHistoryOpen(false);
    replaceParams({});
    setTimeout(() => composerRef.current?.focus(), 50);
  };

  const ask = async (text, scopeOverride) => {
    const q = (text ?? query).trim();
    const askScope = scopeOverride ?? scope;
    if (!q || busy || busyRef.current) return;
    busyRef.current = true;
    setQuery('');
    setBusy(true);
    const tempId = `pending-${Date.now()}`;
    setMessages((m) => [...m, { id: `u-${tempId}`, role: 'user', content: q }, { id: tempId, role: 'assistant', content: '', streaming: true, citations: [] }]);
    const controller = new AbortController();
    abortRef.current = controller;
    const patch = (fn) => setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, ...fn(x) } : x)));

    try {
      const final = await streamChat(
        { question: q, courseId: session ? null : askScope || null, sessionId: session?.id, signal: controller.signal },
        {
          onMeta: (meta) => {
            patch(() => ({ citations: meta.citations }));
            if (!session) {
              setSession({ id: meta.session_id, title: meta.session_title, course: askScope || null, course_code: scopeCourses.find((c) => c.id === askScope)?.code });
              replaceParams({ session: meta.session_id });
            }
          },
          onToken: (t) => patch((x) => ({ content: x.content + t })),
        },
      );
      setMessages((m) => m.map((x) => (x.id === tempId
        ? { id: final.message_id, role: 'assistant', content: final.answer, status: final.status, citations: final.citations }
        : x)));
      refreshSessions();
    } catch (err) {
      if (err.name === 'AbortError') {
        // The server keeps the partial answer; it can't be saved from here
        // because it has no final message id yet.
        patch((x) => ({ streaming: false, status: 'stopped', content: x.content ? `${x.content}

_Stopped._` : '_Stopped._' }));
        refreshSessions();
      } else {
        patch(() => ({ streaming: false, error: err.message, question: q }));
        // Keep what the student typed so they don't have to retype it.
        setQuery((cur) => cur || q);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      abortRef.current = null;
      composerRef.current?.focus({ preventScroll: true });
    }
  };

  const retry = (msg) => {
    setMessages((m) => {
      const i = m.findIndex((x) => x.id === msg.id);
      return i < 0 ? m : m.slice(0, Math.max(0, i - 1));
    });
    ask(msg.question);
  };

  const rename = async (id, title) => {
    try {
      await chatApi.rename(id, title);
      setSessions((list) => list.map((s) => (s.id === id ? { ...s, title } : s)));
      if (session?.id === id) setSession((s) => ({ ...s, title }));
    } catch (err) { toast.error(extractErrorMessage(err)); }
  };

  const remove = async () => {
    const s = toDelete;
    setToDelete(null);
    try {
      await chatApi.remove(s.id);
      setSessions((list) => list.filter((x) => x.id !== s.id));
      if (session?.id === s.id) newChat();
      toast.success('Chat deleted.');
    } catch (err) { toast.error(extractErrorMessage(err)); }
  };

  const selectSession = (id) => {
    setHistoryOpen(false);
    if (id !== session?.id) { abortRef.current?.abort(); replaceParams({ session: id }); }
  };

  const suggestions = useMemo(() => {
    const pool = scope ? scopeCourses.filter((c) => c.id === scope) : scopeCourses;
    const list = pool.map((c) => SUGGESTIONS[c.code] || `Explain the main ideas of ${c.title} simply.`);
    if (pool.length === 1) {
      const c = pool[0];
      list.push(`Give me three practice questions on ${c.title}.`, `What should I revise first for ${c.title}?`);
    }
    return [...new Set(list)].slice(0, 3);
  }, [scopeCourses, scope]);

  const active = messages.length > 0 || loadingSession;
  const llmDown = health && !health.ready;
  const firstName = (user?.username || '').split(/\s+/)[0] || 'there';
  const noCourses = scopeCourses.length === 0;

  const historyList = (
    <ConversationList
      sessions={sessions}
      state={sessionsState}
      activeId={session?.id}
      onSelect={selectSession}
      onRename={rename}
      onDelete={setToDelete}
    />
  );

  const composer = (
    <Composer
      ref={composerRef}
      value={query}
      onChange={setQuery}
      onSubmit={() => ask()}
      onStop={() => abortRef.current?.abort()}
      loading={busy}
      size={active ? 'md' : 'lg'}
      minRows={active ? 1 : 2}
      autoFocus={!active}
      placeholder={active ? 'Ask a follow-up…' : 'Ask anything about your course materials…'}
      label="Your question"
      footer={active ? null : (
        <>
          <span className="hidden sm:inline"><kbd className="keycap">Enter</kbd> to send · <kbd className="keycap">Shift</kbd> + <kbd className="keycap">Enter</kbd> for a new line</span>
          <span>Answers show where they came from</span>
        </>
      )}
    />
  );

  return (
    <div className="flex min-h-0 flex-1">
      {isDesktop && (
        <aside className="flex w-[272px] shrink-0 flex-col border-r border-border bg-canvas" aria-label="Chat history">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <span className="px-1 text-[13px] font-semibold text-fg">Chat history</span>
            <Button size="sm" variant="secondary" iconLeft={MessageSquarePlus} onClick={newChat}>New chat</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{historyList}</div>
        </aside>
      )}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
          {!isDesktop && <Button size="sm" variant="secondary" iconLeft={History} onClick={() => setHistoryOpen(true)}>Chats</Button>}
          <ScopePicker courses={scopeCourses} value={scope} onChange={setScope} locked={!!session} />
          {session && <span className="hidden min-w-0 truncate text-[13px] text-fg-3 md:inline">{session.title}</span>}
          <div className="ml-auto flex items-center gap-1">
            {active && <Button size="sm" variant="ghost" iconLeft={MessageSquarePlus} onClick={newChat} className="lg:hidden">New chat</Button>}
          </div>
        </div>

        {llmDown && (
          <div role="status" className="flex shrink-0 items-start gap-2.5 border-b border-warning/25 bg-warning-dim px-4 py-2.5 text-[13px] text-fg-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>
              <strong className="font-semibold text-fg">The AI is offline right now.</strong>{' '}
              You can still ask: you’ll see the matching parts of your materials until it’s back.
            </span>
          </div>
        )}

        {!active ? (
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 sm:px-6">
            <div className="my-auto flex w-full max-w-[680px] flex-col py-10 sm:py-14">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="mb-8 text-center">
                <h1 className="hero-title text-[2.25rem] sm:text-[3rem]">{greeting()}, {firstName}.</h1>
                <p className="mx-auto mt-3 max-w-[48ch] text-[15px] leading-relaxed text-fg-3">
                  {user?.role === 'student'
                    ? 'Ask anything about your courses. Every answer shows the page it came from.'
                    : user?.role === 'teacher'
                      ? 'See how the assistant answers from your course materials, the same way your students do.'
                      : 'Ask across every course to check answers and their sources.'}
                </p>
              </motion.div>

              {noCourses && user?.role === 'student' ? (
                <div className="rounded-lg border border-dashed border-border-strong p-6 text-center">
                  <p className="text-[14px] text-fg-2">Join a course first. The AI answers from the materials of the courses you’re in.</p>
                  <Button className="mt-4" onClick={() => onNavigate?.('courses')}>Browse courses</Button>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                  {composer}
                </motion.div>
              )}

              {suggestions.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14, duration: 0.3 }} className="mt-8">
                  <p className="mb-2 px-1 text-xs font-medium text-fg-3">Not sure where to start? Try one of these</p>
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface/60">
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button onClick={() => ask(s)} className="group flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-[14px] text-fg-2 transition-colors hover:bg-subtle hover:text-fg">
                          <span>{s}</span>
                          <ArrowUpRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-fg" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6" aria-live="polite">
              <div className="mx-auto flex w-full max-w-[740px] flex-col gap-8 pt-8 pb-10">
                {loadingSession ? (
                  <div className="flex flex-col gap-4"><Skeleton className="ml-auto h-10 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-24" /></div>
                ) : (
                  messages.map((m) => (m.role === 'user' ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[85%] rounded-xl rounded-br-sm bg-subtle px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-fg">{m.content}</p>
                    </div>
                  ) : (
                    <Answer key={m.id} msg={m} onCite={(c) => c && setCitation(c)} onRetry={busy ? undefined : () => retry(m)} />
                  )))
                )}
              </div>
            </div>
            <div className="relative shrink-0 px-4 pb-4 sm:px-6 sm:pb-5">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-canvas to-transparent" />
              <div className="mx-auto w-full max-w-[740px]">
                {composer}
                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-fg-3">
                  <span className="truncate"><span className="hidden sm:inline">Answers come only from your course materials but can still be wrong. </span>Check the sources before relying on an answer.</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!isDesktop && (
        <Sheet isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Chat history" side="left">
          <div className="border-b border-border p-3">
            <Button fullWidth iconLeft={MessageSquarePlus} onClick={newChat}>New chat</Button>
          </div>
          {historyList}
        </Sheet>
      )}

      <Sheet isOpen={!!citation} onClose={() => setCitation(null)} title="Source" label="Source details">
        {citation && (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-dim text-accent">
                <FileText className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug text-fg">{citation.document_title}</p>
                <p className="mt-1 text-[12.5px] text-fg-3">{[citation.course_code, citation.unit, citation.topic].filter(Boolean).join(' · ')}</p>
                <div className="mt-2 flex gap-1.5"><Badge tone="accent">Page {citation.page_number}</Badge><Badge>Source {citation.index}</Badge></div>
              </div>
            </div>
            <figure>
              <figcaption className="mb-2 text-xs font-medium text-fg-3">From the document</figcaption>
              <blockquote className="rounded-md border-l-2 border-accent bg-subtle px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line text-fg-2">{citation.excerpt}</blockquote>
            </figure>
            {typeof citation.score === 'number' && (
              <details className="text-xs text-fg-3">
                <summary className="inline-flex cursor-pointer select-none items-center gap-1 font-medium hover:text-fg-2"><Info className="size-3" aria-hidden /> Details</summary>
                <div className="mt-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span>How closely this matches your question</span>
                    <span className="font-mono tabular text-fg-2">{Math.round(citation.score * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, Math.min(100, citation.score * 100))}%` }} />
                  </div>
                </div>
              </details>
            )}
            {user?.role === 'student' && (
              <Button iconRight={ExternalLink} variant="secondary" onClick={() => { setCitation(null); onNavigate?.('documents', { doc: citation.document_id, page: citation.page_number }); }}>
                Open in Study Materials at page {citation.page_number}
              </Button>
            )}
          </div>
        )}
      </Sheet>

      <Modal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this chat?"
        description={toDelete ? `“${toDelete.title}” will be removed from your chat history.` : ''}
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button><Button variant="danger" iconLeft={Trash2} onClick={remove}>Delete chat</Button></>}
      />
    </div>
  );
}
