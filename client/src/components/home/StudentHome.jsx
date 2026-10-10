import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  ArrowRight, BookOpen, Bookmark, FileText, GraduationCap, Layers, MessageCircle, Send, WifiOff,
} from 'lucide-react';
import api, { chatApi } from '../auth/api';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { recentMaterials } from './recent';

/*
 * Student Home: a launchpad, not a dashboard. Everything shown here is real:
 * the courses the student can ask about, their recent chats and saved answers
 * (server), and materials opened on this device (local). Nothing is invented.
 */

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

const QUICK = [
  { label: 'Ask AI', hint: 'Start a new chat', icon: MessageCircle, tab: 'assistant' },
  { label: 'Study Materials', hint: 'Read your course notes', icon: BookOpen, tab: 'documents' },
  { label: 'My Courses', hint: 'Join or leave courses', icon: GraduationCap, tab: 'courses' },
  { label: 'Flashcards', hint: 'Revise with your decks', icon: Layers, tab: 'notebook', params: { tab: 'flashcards' } },
];

function Section({ title, action, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 !rounded-lg" />)}
    </div>
  );
}

function Quiet({ children }) {
  return <p className="rounded-lg border border-dashed border-border-strong px-4 py-5 text-[13.5px] text-fg-3">{children}</p>;
}

export function StudentHome({ user, onNavigate }) {
  const [state, setState] = useState('loading');
  const [courses, setCourses] = useState([]);
  const [chats, setChats] = useState(null); // null = failed to load
  const [savedCount, setSavedCount] = useState(null);
  const [aiReady, setAiReady] = useState(true);
  const [recent] = useState(recentMaterials);
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState('');
  const ids = { q: useId(), scope: useId() };

  const load = useCallback(async () => {
    setState('loading');
    const [scopeRes, chatRes, savedRes, healthRes] = await Promise.allSettled([
      api.get('/ai/scope/'),
      chatApi.sessions(),
      chatApi.saved(),
      api.get('/ai/health/'),
    ]);
    if (scopeRes.status !== 'fulfilled') { setState('error'); return; }
    setCourses(scopeRes.value.data || []);
    setChats(chatRes.status === 'fulfilled' ? chatRes.value : null);
    const saved = savedRes.status === 'fulfilled' ? savedRes.value : null;
    setSavedCount(saved ? (saved.results ?? saved).length : null);
    setAiReady(healthRes.status === 'fulfilled' ? !!healthRes.value.data?.ready : true);
    setState('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const first = (user?.username || '').split(' ')[0];
  const enrolled = courses.length > 0;

  const ask = (e) => {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 2) return;
    onNavigate('assistant', { q, ...(scope ? { course: scope } : {}) });
  };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="hero-title text-[2rem] sm:text-[2.5rem]">{greeting()}{first ? `, ${first}` : ''}.</h1>
        <p className="max-w-[60ch] text-[15px] text-fg-2">
          Ask questions about your course materials and get answers that show where they came from.
        </p>
      </header>

      {state === 'error' ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-5" role="alert">
          <p className="text-[15px] font-semibold text-fg">Couldn’t load your home page.</p>
          <p className="text-[14px] text-fg-3">Check your connection and try again.</p>
          <Button onClick={load}>Try again</Button>
        </div>
      ) : state === 'ready' && !enrolled ? (
        /* First time: nothing to ask about yet, so guide the student to a course. */
        <section aria-labelledby="start-h" className="rounded-xl border border-border bg-surface p-6 sm:p-8">
          <h2 id="start-h" className="text-[18px] font-semibold text-fg">Get started in three steps</h2>
          <ol className="mt-5 flex flex-col gap-4">
            {[
              ['Join a course', 'Pick the courses you’re taking. Their study materials appear straight away.'],
              ['Open your study materials', 'Read your teachers’ notes and make flashcards from them.'],
              ['Ask the AI Assistant', 'Ask anything about your courses. Every answer shows the page it came from.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-dim text-[14px] font-semibold text-accent">{i + 1}</span>
                <div>
                  <p className="text-[15px] font-semibold text-fg">{t}</p>
                  <p className="mt-0.5 text-[14px] text-fg-3">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button className="mt-6" size="lg" iconRight={ArrowRight} onClick={() => onNavigate('courses')}>Browse courses</Button>
        </section>
      ) : (
        <form onSubmit={ask} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
          <label htmlFor={ids.q} className="text-[14px] font-semibold text-fg">What do you want to learn?</label>
          <textarea
            id={ids.q}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) ask(e); }}
            rows={2}
            maxLength={2000}
            disabled={state !== 'ready'}
            placeholder="For example: What is the difference between a stack and a queue?"
            className="field-control min-h-[64px] resize-none text-[15px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <label htmlFor={ids.scope} className="shrink-0 text-[13px] text-fg-3">Ask about</label>
              <select
                id={ids.scope}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                disabled={state !== 'ready'}
                className="field-control h-10 min-w-0 max-w-[260px] truncate py-0 text-[13.5px]"
              >
                <option value="">All my courses</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
              </select>
            </div>
            <Button type="submit" size="lg" iconRight={Send} disabled={state !== 'ready' || question.trim().length < 2}>Ask AI</Button>
          </div>
          {!aiReady && (
            <p className="flex items-start gap-2 text-[13px] text-fg-3">
              <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
              The AI is offline right now. You’ll still see the matching parts of your materials.
            </p>
          )}
        </form>
      )}

      <Section title="Quick actions">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK.map(({ label, hint, icon: Icon, tab, params }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => onNavigate(tab, params)}
                className="flex h-full w-full items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-dim text-accent"><Icon className="size-[18px]" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold text-fg">{label}</span>
                  <span className="block text-[13px] text-fg-3">{hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {enrolled && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Section
            title="Continue a chat"
            action={chats?.length > 0 && <button type="button" onClick={() => onNavigate('assistant')} className="rounded-sm text-[13px] font-medium text-accent hover:underline">Chat history</button>}
          >
            {state === 'loading' ? <ListSkeleton /> : chats === null ? (
              <Quiet>Couldn’t load your chats. <button type="button" onClick={load} className="font-medium text-fg underline">Try again</button></Quiet>
            ) : chats.length === 0 ? (
              <Quiet>No chats yet. Ask your first question above.</Quiet>
            ) : (
              <ul className="flex flex-col gap-2">
                {chats.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate('assistant', { session: c.id })}
                      className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <MessageCircle className="size-4 shrink-0 text-fg-3" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-fg">{c.title || 'Untitled chat'}</span>
                        <span className="block truncate text-[12.5px] text-fg-3">{c.course_code || 'All my courses'} · {timeAgo(c.updated_at)}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-fg-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Recently opened"
            action={<button type="button" onClick={() => onNavigate('documents')} className="rounded-sm text-[13px] font-medium text-accent hover:underline">All study materials</button>}
          >
            {recent.length === 0 ? (
              <Quiet>Materials you open will show up here.</Quiet>
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {recent.slice(0, 4).map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate('documents', { doc: d.id })}
                        className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <FileText className="size-4 shrink-0 text-fg-3" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-fg">{d.title}</span>
                          <span className="block truncate text-[12.5px] text-fg-3">{d.course_code ? `${d.course_code} · ` : ''}{timeAgo(new Date(d.at).toISOString())}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-fg-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] text-fg-3">Remembered on this device.</p>
              </>
            )}
          </Section>
        </div>
      )}

      {enrolled && savedCount > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('notebook')}
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-[14px] transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent sm:w-fit"
        >
          <Bookmark className="size-4 text-accent" aria-hidden />
          <span className="text-fg">You have {savedCount} saved {savedCount === 1 ? 'answer' : 'answers'} in your Notebook</span>
          <ArrowRight className="size-4 text-fg-3" aria-hidden />
        </button>
      )}
    </div>
  );
}
