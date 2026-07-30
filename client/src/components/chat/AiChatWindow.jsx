import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Paperclip,
  Globe,
  BookOpen,
  Terminal,
  Sigma,
  User,
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { Loader } from '../ui/Loader';

/* ─── Inline markdown parser (no deps) ────────────────────────────── */
function renderAiContent(raw) {
  if (!raw) return null;

  // Split on triple-back-tick code blocks first
  const segments = raw.split(/(```[\s\S]*?```)/g);

  return segments.map((seg, i) => {
    // Code block
    if (seg.startsWith('```')) {
      const lines = seg.slice(3).split('\n');
      const lang = lines[0].trim() || 'code';
      const code = lines.slice(1).join('\n').replace(/```$/, '').trimEnd();
      return (
        <div
          key={i}
          className="my-3 rounded-lg overflow-hidden font-mono text-xs"
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider select-none"
            style={{
              background: 'var(--bg-hover)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--fg-3)',
            }}
          >
            <span>{lang}</span>
          </div>
          <pre className="p-3 overflow-x-auto leading-relaxed whitespace-pre" style={{ color: 'var(--fg)' }}>
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    // Plain / bold text
    const lines = seg.split('\n').filter(Boolean);
    return (
      <div key={i} className="flex flex-col gap-1.5">
        {lines.map((line, j) => {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <p key={j} className="leading-relaxed text-[13px] font-sans" style={{ color: 'var(--fg-2)' }}>
              {parts.map((p, k) =>
                p.startsWith('**') && p.endsWith('**') ? (
                  <strong key={k} style={{ color: 'var(--fg)', fontWeight: 600 }}>
                    {p.slice(2, -2)}
                  </strong>
                ) : (
                  p
                )
              )}
            </p>
          );
        })}
      </div>
    );
  });
}

/* ─── Suggestion chips ─────────────────────────────────────────────── */
const SUGGESTIONS = [
  {
    id: 'quicksort',
    title: 'Analyze Quicksort',
    query: 'Analyze the mathematical complexity bounds of Quicksort and show a code example.',
    icon: Terminal,
  },
  {
    id: 'svm',
    title: 'Derive SVM Margins',
    query: 'Explain Support Vector Machines and derive the primal optimization formula.',
    icon: Sigma,
  },
  {
    id: 'k-maps',
    title: 'Simplify K-Maps',
    query: 'What are the rules to simplify logic using Karnaugh Maps? Include an example.',
    icon: BookOpen,
  },
];

const MOCK_RESPONSES = {
  quicksort: `**Quicksort Complexity Analysis**\n\nQuicksort is a divide-and-conquer sorting algorithm with the following complexity bounds:\n\n- **Best case**: O(n log n) — pivot splits array evenly each time\n- **Average case**: O(n log n) — expected with random pivot selection\n- **Worst case**: O(n²) — pivot always picks smallest/largest element\n\n\`\`\`python\ndef quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left   = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right  = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)\n\`\`\``,
  svm: `**Support Vector Machines — Margin Derivation**\n\nSVMs find a hyperplane that maximises the margin between two classes.\n\nThe primal optimisation problem is:\n\n**Minimise** ½ ‖w‖² subject to yᵢ(w·xᵢ + b) ≥ 1 for all i\n\nThe geometric margin for a correctly classified point is defined as:\n\n**margin = 2 / ‖w‖**\n\nMaximising the margin is equivalent to minimising ‖w‖, which leads to a convex quadratic optimisation problem solvable via Lagrange multipliers.`,
  'k-maps': `**Karnaugh Map Simplification Rules**\n\nK-Maps are a visual method to simplify Boolean expressions.\n\n**Rules:**\n1. Group 1s in powers of 2 — groups of 1, 2, 4, 8…\n2. Groups must be rectangular and wrap around edges\n3. Larger groups → fewer terms in simplified expression\n4. Each 1 must be covered by at least one group\n\n**Example:** F(A,B) = A'B + AB = B\n\nBoth minterms share B=1, so B alone covers the function.`,
};

/* ─── Main component ───────────────────────────────────────────────── */
export function AiChatWindow() {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamingId, setStreamingId] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [webMode, setWebMode] = useState(true);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom whenever messages or streaming text changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const streamResponse = useCallback((text, id) => {
    setStreamingId(id);
    setStreamingText('');
    let i = 0;
    const speed = 12; // ms per char
    const tick = () => {
      i += 3;
      if (i >= text.length) {
        setStreamingText(text);
        setStreamingId(null);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text, isStreaming: false } : m))
        );
        return;
      }
      setStreamingText(text.slice(0, i));
      setTimeout(tick, speed);
    };
    setTimeout(tick, speed);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      const q = input.trim();
      if (!q || streamingId !== null) return;

      const uid = Date.now();
      const aid = uid + 1;
      setInput('');
      textareaRef.current?.focus();

      setMessages((prev) => [
        ...prev,
        { id: uid, sender: 'user', text: q },
        { id: aid, sender: 'ai', text: '', isStreaming: true, sources: [] },
      ]);

      // Pick mock response based on keyword
      const key = Object.keys(MOCK_RESPONSES).find((k) =>
        q.toLowerCase().includes(k.replace('-', ''))
      );
      const responseText =
        MOCK_RESPONSES[key] ??
        `I received your query: **"${q}"**\n\nPlease connect a backend service or upload course materials to begin indexed retrieval.`;

      streamResponse(responseText, aid);
    },
    [input, streamingId, streamResponse]
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

  const handleRegenerate = (id) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text: '', isStreaming: true } : m))
    );
    toast.info('Regenerating response…');
    setTimeout(() => streamResponse(msg.text || 'Regenerated response.', id), 300);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col w-full h-full min-h-0 overflow-hidden" style={{ fontFamily: 'var(--font-sans)' }}>

      {/* ── Message Area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          /* Empty / Welcome */
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-serif text-xl flex-shrink-0"
                style={{ background: 'var(--fg)', color: 'var(--bg)' }}
              >
                A
              </div>
              <div>
                <h2
                  className="text-xl font-semibold tracking-tight font-sans"
                  style={{ color: 'var(--fg)' }}
                >
                  AI Copilot
                </h2>
                <p className="text-xs mt-1 max-w-[260px]" style={{ color: 'var(--fg-3)' }}>
                  Ask anything about your course materials
                </p>
              </div>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSuggestion(s.query)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer transition-all w-full"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-hover)';
                      e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg-surface)';
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-medium font-sans" style={{ color: 'var(--fg-2)' }}>
                      {s.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Conversation */
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {messages.map((msg) => {
              const isAi = msg.sender === 'ai';
              const isCurrent = isAi && streamingId === msg.id;
              const displayText = isCurrent ? streamingText : msg.text;

              return (
                <div key={msg.id} className="px-4 py-4 flex flex-col gap-3">
                  {/* Avatar + sender label */}
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

                  {/* Message content */}
                  <div className="pl-8">
                    {isCurrent ? (
                      <div>
                        {renderAiContent(displayText)}
                        <span
                          className="inline-block w-[2px] h-4 ml-0.5 align-middle animate-pulse"
                          style={{ background: 'var(--accent)' }}
                        />
                      </div>
                    ) : msg.isStreaming && !isCurrent ? (
                      <div className="flex items-center gap-2" style={{ color: 'var(--fg-3)' }}>
                        <Loader variant="dots" size="sm" color="accent" />
                        <span className="text-xs">Thinking…</span>
                      </div>
                    ) : isAi ? (
                      renderAiContent(displayText)
                    ) : (
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--fg)' }}>
                        {msg.text}
                      </p>
                    )}
                  </div>

                  {/* AI action bar */}
                  {isAi && !msg.isStreaming && !isCurrent && (
                    <div className="pl-8 flex items-center gap-1 mt-1">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] cursor-pointer transition-colors"
                        style={{ color: 'var(--fg-3)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--fg)';
                          e.currentTarget.style.background = 'var(--bg-subtle)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--fg-3)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3" style={{ color: 'var(--success)' }} />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedId === msg.id ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleRegenerate(msg.id)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] cursor-pointer transition-colors"
                        style={{ color: 'var(--fg-3)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--fg)';
                          e.currentTarget.style.background = 'var(--bg-subtle)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--fg-3)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Web mode toggle */}
          <button
            type="button"
            onClick={() => setWebMode((v) => !v)}
            className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-all cursor-pointer"
            style={{
              background: webMode ? 'var(--accent-dim)' : 'transparent',
              color: webMode ? 'var(--accent)' : 'var(--fg-3)',
              border: `1px solid ${webMode ? 'var(--accent)' : 'var(--border)'}`,
            }}
            title={webMode ? 'Web Copilot on' : 'Web Copilot off'}
          >
            <Globe className="w-3.5 h-3.5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-grow: reset, then set to scrollHeight (max 4 lines ≈ 96px)
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask about your course…"
            className="flex-1 bg-transparent outline-none resize-none font-sans text-[13px] leading-relaxed py-0.5 min-w-0"
            style={{
              color: 'var(--fg)',
              maxHeight: '96px',
              overflowY: 'auto',
            }}
          />

          {/* Attach + Send */}
          <div className="flex-shrink-0 flex items-center gap-1 self-end pb-0.5">
            <button
              type="button"
              onClick={() => toast.info('File attach coming soon.')}
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer"
              style={{ color: 'var(--fg-3)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--fg)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--fg-3)';
                e.currentTarget.style.background = 'transparent';
              }}
              aria-label="Attach file"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              disabled={!input.trim() || streamingId !== null}
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
