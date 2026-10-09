import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, SearchX, Sparkles } from 'lucide-react';
import { streamChat } from '../auth/api';
import { Composer } from '../ui/Composer';
import { Markdown } from '../ui/Markdown';
import { ErrorState } from '../ui/ErrorState';
import { BrandMark } from '../ui/BrandMark';
import { copyText } from '../ui/clipboard';

/**
 * AiChatWindow — compact, streaming copilot beside the document reader.
 * Keeps one conversation (session) per mounted reader, scoped to `courseId`.
 */
export function AiChatWindow({ courseId, contextLabel, suggestions = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const sessionRef = useRef(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: busy ? 'auto' : 'smooth' });
  }, [messages, busy]);

  const send = async (override) => {
    const q = (override ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    const id = `a${Date.now()}`;
    setMessages((m) => [...m, { id: `u${id}`, sender: 'user', text: q }, { id, sender: 'ai', text: '', streaming: true, citations: [] }]);
    const patch = (fn) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, ...fn(x) } : x)));
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const final = await streamChat(
        { question: q, courseId: sessionRef.current ? null : courseId, sessionId: sessionRef.current, signal: controller.signal },
        {
          onMeta: (meta) => { sessionRef.current = meta.session_id; patch(() => ({ citations: meta.citations })); },
          onToken: (t) => patch((x) => ({ text: x.text + t })),
        },
      );
      patch(() => ({ text: final.answer, status: final.status, citations: final.citations, streaming: false }));
    } catch (err) {
      if (err.name !== 'AbortError') patch(() => ({ streaming: false, error: err.message, question: q }));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (mid, text) => {
    if (await copyText(text)) { setCopiedId(mid); setTimeout(() => setCopiedId(null), 1600); }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center gap-5 px-5 py-8">
            <div className="flex flex-col items-start gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-dim text-accent"><Sparkles className="size-[18px]" aria-hidden /></span>
              <div>
                <h2 className="text-[15px] font-semibold text-fg">Ask about this course</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-3">
                  Answers come from <span className="text-fg-2">{contextLabel || 'this course'}</span> and cite the pages they use.
                </p>
              </div>
            </div>
            {suggestions.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button onClick={() => send(s)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-[13px] text-fg-2 transition-colors hover:border-border-strong hover:text-fg">{s}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6 px-4 py-5">
            {messages.map((m) => {
              if (m.sender === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[88%] rounded-lg rounded-br-sm bg-subtle px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap text-fg">{m.text}</p>
                  </div>
                );
              }
              if (m.error) {
                return <ErrorState key={m.id} variant="inline" title="No answer" description={m.error} onRetry={busy ? undefined : () => send(m.question)} />;
              }
              if (m.status === 'not_found') {
                return (
                  <div key={m.id} className="flex gap-2.5 rounded-lg border border-border bg-subtle/60 px-3.5 py-3 text-[13px] leading-relaxed text-fg-2">
                    <SearchX className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />{m.text}
                  </div>
                );
              }
              return (
                <div key={m.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <BrandMark size={18} />
                    <span className="text-xs font-semibold text-fg">AuraStudy</span>
                  </div>
                  {m.streaming && !m.text ? (
                    <div className="flex items-center gap-2 text-[13px] text-fg-3" role="status">
                      <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
                      <span className="ml-1">Reading the material…</span>
                    </div>
                  ) : (
                    <Markdown className="!text-[13.5px]">{m.text}</Markdown>
                  )}
                  {!m.streaming && m.citations?.length > 0 && (
                    <p className="text-xs leading-relaxed text-fg-3">
                      Sources: {m.citations.map((c) => `[${c.index}] ${c.document_title}, p.${c.page_number}`).join(' · ')}
                    </p>
                  )}
                  {!m.streaming && (
                    <button onClick={() => copy(m.id, m.text)} className="-ml-1.5 inline-flex w-fit items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs text-fg-3 transition-colors hover:bg-subtle hover:text-fg">
                      {copiedId === m.id ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                      {copiedId === m.id ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <Composer value={input} onChange={setInput} onSubmit={() => send()} loading={busy} placeholder="Ask about this course…" label="Ask the copilot" maxRows={5} />
      </div>
    </div>
  );
}
