import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Sparkles,
  Copy,
  Check,
  BookOpen,
  Terminal,
  Sigma,
  User,
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { Loader } from '../ui/Loader';
import api from '../auth/api';

/* ─── Inline markdown renderer ──────────────────────────────────────── */
function renderAiContent(raw) {
  if (!raw) return null;

  const segments = raw.split(/(```[\s\S]*?```)/g);

  return segments.map((seg, i) => {
    if (seg.startsWith('```')) {
      const lines = seg.slice(3).split('\n');
      const lang = lines[0].trim() || 'code';
      const code = lines.slice(1).join('\n').replace(/```$/, '').trimEnd();
      return (
        <div
          key={i}
          className="my-3 rounded-lg overflow-hidden font-mono text-xs"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center px-3 py-1.5 text-[10px] uppercase tracking-wider select-none"
            style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', color: 'var(--fg-3)' }}
          >
            {lang}
          </div>
          <pre className="p-3 overflow-x-auto leading-relaxed whitespace-pre" style={{ color: 'var(--fg)' }}>
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    const lines = seg.split('\n').filter(Boolean);
    return (
      <div key={i} className="flex flex-col gap-1.5">
        {lines.map((line, j) => {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <p key={j} className="leading-relaxed text-[13px] font-sans" style={{ color: 'var(--fg-2)' }}>
              {parts.map((p, k) =>
                p.startsWith('**') && p.endsWith('**') ? (
                  <strong key={k} style={{ color: 'var(--fg)', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
                ) : p
              )}
            </p>
          );
        })}
      </div>
    );
  });
}

/* ─── Suggestion chips ──────────────────────────────────────────────── */
const SUGGESTIONS = [
  { id: 'quicksort', title: 'Analyze Quicksort', query: 'Analyze the mathematical complexity bounds of Quicksort and show a code example.', icon: Terminal },
  { id: 'svm', title: 'Derive SVM Margins', query: 'Explain Support Vector Machines and derive the primal optimization formula.', icon: Sigma },
  { id: 'k-maps', title: 'Simplify K-Maps', query: 'What are the rules to simplify logic using Karnaugh Maps? Include an example.', icon: BookOpen },
];

/* ─── Main component ────────────────────────────────────────────────── */
export function AiChatWindow({ courseId }) {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      const q = input.trim();
      if (!q || loading) return;

      const uid = Date.now();
      const aid = uid + 1;
      setInput('');
      textareaRef.current?.focus();

      setMessages((prev) => [...prev, { id: uid, sender: 'user', text: q }]);
      setLoading(true);

      try {
        const payload = { query: q };
        if (courseId) payload.course_id = courseId;

        const res = await api.post('/ai/ask/', payload);
        const answerText = res.data.answer || res.data.response || 'No content found for this query.';
        const citations = res.data.citations || [];

        setMessages((prev) => [...prev, { id: aid, sender: 'ai', text: answerText, citations }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: aid,
            sender: 'ai',
            text: `I received your query: **"${q}"**\n\nUpload course materials or connect to a backend service to retrieve indexed answers.`,
            citations: [],
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, courseId]
  );

  const handleSuggestion = (query) => {
    setInput(query);
    textareaRef.current?.focus();
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col w-full h-full min-h-0 overflow-hidden" style={{ fontFamily: 'var(--font-sans)' }}>

      {/* ── Message Area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-serif text-xl flex-shrink-0"
                style={{ background: 'var(--fg)', color: 'var(--bg)' }}
              >
                A
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight font-sans" style={{ color: 'var(--fg)' }}>
                  AI Copilot
                </h2>
                <p className="text-xs mt-1 max-w-[260px]" style={{ color: 'var(--fg-3)' }}>
                  Ask anything about your course materials
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSuggestion(s.query)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer transition-all w-full"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
                  >
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-medium font-sans" style={{ color: 'var(--fg-2)' }}>{s.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {messages.map((msg) => {
              const isAi = msg.sender === 'ai';
              return (
                <div key={msg.id} className="px-4 py-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isAi ? 'var(--accent-dim)' : 'var(--bg-subtle)',
                        border: `1px solid ${isAi ? 'var(--accent)' : 'var(--border)'}`,
                        color: isAi ? 'var(--accent)' : 'var(--fg-3)',
                      }}
                    >
                      {isAi ? <Sparkles className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>
                      {isAi ? 'AI Copilot' : 'You'}
                    </span>
                  </div>

                  <div className="pl-8">
                    {isAi ? renderAiContent(msg.text) : (
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>{msg.text}</p>
                    )}
                  </div>

                  {isAi && (
                    <div className="pl-8 flex items-center gap-1 mt-1">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] cursor-pointer transition-colors"
                        style={{ color: 'var(--fg-3)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-3)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3" style={{ color: 'var(--success)' }} /> : <Copy className="w-3 h-3" />}
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="px-4 py-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                  >
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-3)' }}>
                    AI Copilot
                  </span>
                </div>
                <div className="pl-8 flex items-center gap-2" style={{ color: 'var(--fg-3)' }}>
                  <Loader variant="dots" size="sm" color="accent" />
                  <span className="text-xs">Searching course materials…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} className="h-2" />
          </div>
        )}
      </div>

      {/* ── Input Bar ────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-3 py-2.5"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-lg px-3 py-2"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
            }}
            placeholder="Ask about your course…"
            className="flex-1 bg-transparent outline-none resize-none font-sans text-[13px] leading-relaxed py-0.5 min-w-0"
            style={{ color: 'var(--fg)', maxHeight: '96px', overflowY: 'auto' }}
          />

          <div className="flex-shrink-0 flex items-center gap-1 self-end pb-0.5">
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer disabled:opacity-30"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] mt-1.5" style={{ color: 'var(--fg-3)' }}>
          AI may make mistakes — verify with your course materials
        </p>
      </div>
    </div>
  );
}
