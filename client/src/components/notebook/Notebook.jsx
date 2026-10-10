import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Bookmark, Check, ChevronDown, Copy, Layers, MessageCircle, RotateCw, Search, Trash2 } from 'lucide-react';
import { readRoute } from '../layout/navConfig';
import api, { chatApi, extractErrorMessage } from '../auth/api';
import { useToast } from '../ui/Toast';
import { PageHeader } from '../ui/PageHeader';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { Markdown } from '../ui/Markdown';
import { copyText } from '../ui/clipboard';

const DIFFICULTY_TONE = { Easy: 'success', Medium: 'warning', Hard: 'error' };

function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
}

function AnswerCard({ answer, onDelete, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const long = (answer.content || '').length > 480;
  const sources = [...new Map((answer.citations || []).map((c) => [`${c.document_id}-${c.page_number}`, c])).values()];

  return (
    <article className="group rounded-lg border border-border bg-surface transition-colors hover:border-border-strong">
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-3">
            {answer.course_code && <Badge tone="accent" mono>{answer.course_code}</Badge>}
            <time dateTime={answer.created_at}>Saved {formatDate(answer.created_at)}</time>
          </div>
          <h3 className="text-[15px] font-semibold leading-snug text-fg">{answer.question}</h3>
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0 items-center transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <IconButton icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy answer'} size="sm" onClick={async () => { if (await copyText(answer.content)) { setCopied(true); setTimeout(() => setCopied(false), 1600); } }} />
          <IconButton icon={Trash2} label="Remove from notebook" size="sm" onClick={() => onDelete(answer)} className="hover:!text-error" />
        </div>
      </header>
      <div className="px-5 pt-3 pb-4">
        <div className={`relative ${!expanded && long ? 'max-h-44 overflow-hidden' : ''}`}>
          <Markdown className="!text-[14px]">{answer.content}</Markdown>
          {!expanded && long && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />}
        </div>
        {long && (
          <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="mt-2 inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-fg-2 transition-colors hover:text-fg">
            {expanded ? 'Show less' : 'Show full answer'}
            <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        )}
        {sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {sources.map((c) => (
              <button
                key={`${c.document_id}-${c.page_number}`}
                onClick={() => onNavigate?.('documents', { doc: c.document_id, page: c.page_number })}
                className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-subtle px-2 py-1 text-xs text-fg-2 transition-colors hover:bg-hover hover:text-fg"
              >
                <BookOpen className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{c.document_title}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-fg-3">p.{c.page_number}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function Flashcard({ card, flipped, onFlip }) {
  const face = 'flip-face flex min-h-[210px] flex-col rounded-lg border border-border p-5';
  return (
    <div className="flip-scene">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? `Answer: ${card.answer}` : `Question: ${card.question}. Press to reveal the answer.`}
        onClick={onFlip}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFlip(); } }}
        data-flipped={flipped}
        className="flip-card cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <div className={`${face} bg-surface`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-fg-3">Question</span>
            {card.difficulty && <Badge tone={DIFFICULTY_TONE[card.difficulty] || 'neutral'}>{card.difficulty}</Badge>}
          </div>
          <p className="my-auto py-4 text-[15.5px] font-semibold leading-snug text-fg">{card.question}</p>
          <div className="flex items-center justify-between text-xs text-fg-3">
            <span className="truncate">{card.category || ''}</span>
            <span className="inline-flex items-center gap-1"><RotateCw className="size-3" aria-hidden /> Reveal</span>
          </div>
        </div>
        <div className={`${face} flip-back bg-subtle`} aria-hidden={!flipped}>
          <span className="text-xs font-medium text-accent">Answer</span>
          <p className="my-auto py-4 text-[14px] leading-relaxed text-fg">{card.answer}</p>
          <div className="flex justify-end text-xs text-fg-3"><span className="inline-flex items-center gap-1"><RotateCw className="size-3" aria-hidden /> Back</span></div>
        </div>
      </div>
    </div>
  );
}

export function Notebook({ onNavigate }) {
  const toast = useToast();
  // Home's "Flashcards" shortcut opens this page on the flashcards tab (#/notebook?tab=flashcards).
  const [tab, setTab] = useState(() => (readRoute().params.tab === 'flashcards' ? 'flashcards' : 'answers'));
  const [answers, setAnswers] = useState([]);
  const [decks, setDecks] = useState([]);
  const [state, setState] = useState('loading');
  const [flipped, setFlipped] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(null); // {kind, item}

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [a, g] = await Promise.all([
        chatApi.saved(),
        api.get('/assistant/generated/', { params: { content_type: 'flashcard', mine: 'true', page_size: 50 } }),
      ]);
      setAnswers(a);
      setDecks((g.data.results ?? g.data).filter((d) => d.content?.cards?.length));
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const visibleAnswers = useMemo(() => (q ? answers.filter((a) => `${a.question} ${a.content}`.toLowerCase().includes(q)) : answers), [answers, q]);
  const visibleDecks = useMemo(() => decks
    .map((d) => ({ ...d, cards: d.content.cards.filter((c) => !q || `${c.question} ${c.answer} ${c.category || ''}`.toLowerCase().includes(q)) }))
    .filter((d) => d.cards.length), [decks, q]);
  const cardCount = decks.reduce((n, d) => n + d.content.cards.length, 0);

  const remove = async () => {
    const { kind, item } = confirm;
    setConfirm(null);
    try {
      if (kind === 'answer') {
        await chatApi.unsave(item.id);
        setAnswers((list) => list.filter((a) => a.id !== item.id));
        toast.success('Removed from your notebook.');
      } else {
        await api.delete(`/assistant/generated/${item.id}/`);
        setDecks((list) => list.filter((d) => d.id !== item.id));
        toast.success('Deck deleted.');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const toggle = (key) => setFlipped((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const deckTitle = (d) => d.title.replace(/^AI Generated Flashcards for\s*/i, '');

  const TABS = [
    { id: 'answers', label: 'Saved answers', icon: Bookmark, count: answers.length },
    { id: 'flashcards', label: 'Flashcards', icon: Layers, count: cardCount },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Notebook" description="Answers you saved from the AI Assistant, and flashcards made from your study materials." />

      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Notebook sections" className="-mb-px flex gap-5">
          {TABS.map(({ id, label, icon: Icon, count }) => {
            const active = tab === id;
            return (
              <button key={id} role="tab" aria-selected={active} onClick={() => { setTab(id); setQuery(''); }}
                className={`inline-flex items-center gap-2 border-b-2 pb-3 text-[14px] font-medium transition-colors ${active ? 'border-fg text-fg' : 'border-transparent text-fg-3 hover:text-fg'}`}>
                <Icon className="size-4" aria-hidden />{label}
                <span className={`rounded-sm px-1.5 text-xs tabular ${active ? 'bg-subtle text-fg-2' : 'text-fg-3'}`}>{state === 'ready' ? count : '–'}</span>
              </button>
            );
          })}
        </div>
        {state === 'ready' && (tab === 'answers' ? answers.length : cardCount) > 0 && (
          <SearchInput icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === 'answers' ? 'Search saved answers' : 'Search flashcards'} aria-label="Search notebook" className="mb-3 w-full sm:w-64" />
        )}
      </div>

      {state === 'loading' ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 !rounded-lg" />)}</div>
      ) : state === 'error' ? (
        <div className="rounded-lg border border-border bg-surface"><ErrorState title="Couldn’t load your notebook" onRetry={load} /></div>
      ) : tab === 'answers' ? (
        answers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong">
            <EmptyState icon={BookOpen} title="Nothing saved yet" description="When an answer in Ask is worth keeping, choose “Save to notebook” and it will appear here." action={<Button iconLeft={MessageCircle} onClick={() => onNavigate?.('assistant')}>Ask a question</Button>} />
          </div>
        ) : visibleAnswers.length === 0 ? (
          <EmptyState compact icon={Search} title="No matches" description={`No saved answers mention “${query}”.`} />
        ) : (
          <div className="flex flex-col gap-3">
            {visibleAnswers.map((a) => <AnswerCard key={a.id} answer={a} onNavigate={onNavigate} onDelete={(item) => setConfirm({ kind: 'answer', item })} />)}
          </div>
        )
      ) : decks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong">
          <EmptyState icon={Layers} title="No flashcards yet" description="Open a file in Study Materials and choose “Make flashcards” to turn it into a revision deck." action={<Button iconLeft={BookOpen} onClick={() => onNavigate?.('documents')}>Open Study Materials</Button>} />
        </div>
      ) : visibleDecks.length === 0 ? (
        <EmptyState compact icon={Search} title="No matches" description={`No flashcards mention “${query}”.`} />
      ) : (
        <div className="flex flex-col gap-10">
          {visibleDecks.map((d) => (
            <section key={d.id} aria-label={deckTitle(d)}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-fg">{deckTitle(d)}</h2>
                  <p className="text-xs text-fg-3">{d.cards.length} cards · made {formatDate(d.created_at)} · tap a card to reveal the answer</p>
                </div>
                <IconButton icon={Trash2} label="Delete deck" size="sm" onClick={() => setConfirm({ kind: 'deck', item: d })} className="hover:!text-error" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {d.cards.map((c, i) => <Flashcard key={`${d.id}-${i}`} card={c} flipped={flipped.has(`${d.id}-${i}`)} onFlip={() => toggle(`${d.id}-${i}`)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'deck' ? 'Delete this deck?' : 'Remove this answer?'}
        description={confirm?.kind === 'deck' ? 'All cards in the deck will be deleted.' : 'The conversation it came from stays in your Ask history.'}
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" onClick={remove}>{confirm?.kind === 'deck' ? 'Delete deck' : 'Remove'}</Button></>}
      />
    </div>
  );
}
