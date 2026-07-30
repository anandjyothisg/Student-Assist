import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Copy, 
  Check, 
  ArrowUp, 
  Sparkles, 
  BookOpen, 
  Bookmark, 
  X,
  ExternalLink
} from 'lucide-react';
import api from '../auth/api';
import { useToast } from '../ui/Toast';

const SUGGESTION_CHIPS = [
  { id: 1, text: "Summarize recent course materials and lecture topics" },
  { id: 2, text: "What are the core exam concepts in my enrolled subjects?" },
  { id: 3, text: "Explain complex theoretical concepts step by step" },
];

function CodeBlock({ lang, content }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="my-5 overflow-hidden rounded-xl font-mono text-[13px]"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 text-[11px] font-sans select-none"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          color: 'var(--fg-3)',
        }}
      >
        <span className="font-medium uppercase tracking-wider">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 transition-colors cursor-pointer"
          style={{ color: 'var(--fg-3)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
        >
          {copied
            ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
            : <Copy className="w-3.5 h-3.5" />
          }
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto leading-relaxed" style={{ color: 'var(--fg)' }}>
        <code>{content}</code>
      </pre>
    </div>
  );
}

function parseInline(text) {
  const tokens = [];
  let r = text, k = 0;
  while (r.length > 0) {
    const cm = r.match(/^`([^`]+)`/);
    if (cm) {
      tokens.push(
        <code key={k++} className="font-mono text-[13px]" style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          padding: '0.1rem 0.35rem',
          borderRadius: '4px',
          color: 'var(--fg)',
        }}>{cm[1]}</code>
      );
      r = r.slice(cm[0].length);
      continue;
    }
    const bm = r.match(/^\*\*(.+?)\*\*/);
    if (bm) { tokens.push(<strong key={k++} className="font-semibold" style={{ color: 'var(--fg)' }}>{bm[1]}</strong>); r = r.slice(bm[0].length); continue; }
    const im = r.match(/^\*(.+?)\*/);
    if (im) { tokens.push(<em key={k++} className="italic" style={{ color: 'var(--fg-2)' }}>{im[1]}</em>); r = r.slice(im[0].length); continue; }
    const nx = r.search(/\*\*|\*|`/);
    if (nx === -1) { tokens.push(r); r = ''; } else if (nx === 0) { tokens.push(r[0]); r = r.slice(1); } else { tokens.push(r.slice(0, nx)); r = r.slice(nx); }
  }
  return tokens;
}

function renderMarkdown(text) {
  if (!text) return null;
  const blocks = text.split('\n\n');
  return blocks.map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('```')) {
      const lines = trimmed.split('\n');
      const lang = lines[0].replace('```', '').trim();
      const code = lines.slice(1, -1).join('\n');
      return <CodeBlock key={bIdx} lang={lang} content={code} />;
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={bIdx} className="font-sans font-semibold tracking-tight mt-8 mb-3" style={{ fontSize: '1.0625rem', color: 'var(--fg)' }}>
          {parseInline(trimmed.slice(3))}
        </h2>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={bIdx} className="font-sans font-semibold tracking-tight mt-6 mb-2" style={{ fontSize: '0.9375rem', color: 'var(--fg)' }}>
          {parseInline(trimmed.slice(4))}
        </h3>
      );
    }
    if (trimmed.startsWith('> ')) {
      return (
        <blockquote
          key={bIdx}
          className="my-5 pl-4 py-3 pr-4 rounded-r-xl font-sans"
          style={{
            borderLeft: '2px solid var(--accent)',
            background: 'var(--accent-dim)',
            fontSize: '14px',
            color: 'var(--fg-2)',
          }}
        >
          {parseInline(trimmed.slice(2))}
        </blockquote>
      );
    }

    // numbered list items
    const listLines = trimmed.split('\n').filter(l => l.match(/^\d+\.\s+/));
    if (listLines.length > 1 && listLines.length === trimmed.split('\n').length) {
      return (
        <ol key={bIdx} className="my-4 pl-5 space-y-1.5" style={{ color: 'color-mix(in srgb, var(--fg) 88%, transparent)', fontSize: '0.9375rem' }}>
          {listLines.map((line, i) => (
            <li key={i}>{parseInline(line.replace(/^\d+\.\s+/, ''))}</li>
          ))}
        </ol>
      );
    }

    if (trimmed.includes('|') && trimmed.includes('\n')) {
      const lines = trimmed.split('\n').filter(l => l.trim().startsWith('|'));
      if (lines.length >= 2) {
        const parseRow = row => row.split('|').slice(1, -1).map(c => c.trim());
        const headers = parseRow(lines[0]);
        const dataRows = lines.slice(2).map(parseRow);
        return (
          <div key={bIdx} className="my-5 overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-left" style={{ fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
              <thead style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-3)', fontSize: '11px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)', color: 'var(--fg)' }}>
                    {row.map((cell, j) => <td key={j} className="px-4 py-3">{parseInline(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

    return (
      <p key={bIdx} className="my-4 font-sans select-text leading-relaxed" style={{ fontSize: '0.9375rem', color: 'color-mix(in srgb, var(--fg) 88%, transparent)' }}>
        {parseInline(trimmed)}
      </p>
    );
  });
}

export function AskScreen({ user }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeCitation, setActiveCitation] = useState(null);
  const bottomRef = useRef(null);

  const isConversationActive = conversation.length > 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleSubmit = async (qText) => {
    const text = qText || query;
    if (!text.trim() || loading) return;

    const userMessage = { id: Date.now(), role: 'user', content: text };
    setConversation(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const res = await api.post('/ai/ask/', { query: text });
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.data.answer || res.data.response || 'No registered content found for this query.',
        citations: res.data.citations || [],
      };
      setConversation(prev => [...prev, aiMessage]);
    } catch (_err) {
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `I've received your query: "${text}". Connect a backend service or upload course materials to retrieve indexed citations.`,
        citations: [],
      };
      setConversation(prev => [...prev, aiMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleSaveToNotebook = (msg) => {
    const existing = JSON.parse(localStorage.getItem('nb_answers') || '[]');
    const newEntry = {
      id: `ans-${Date.now()}`,
      query: conversation.find(m => m.role === 'user')?.content || 'AI Study Note',
      content: msg.content,
      saved_at: new Date().toISOString(),
      course_code: 'ENROLLED-COURSE'
    };
    localStorage.setItem('nb_answers', JSON.stringify([newEntry, ...existing]));
    toast.success('Answer saved to your Study Notebook.');
  };

  return (
    <div className="flex-1 flex min-h-0 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Main Reading Column */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden items-center">
        {!isConversationActive ? (
          /* Hero Landing View */
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 max-w-[720px] mx-auto w-full text-center py-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-11 h-11 rounded-md flex items-center justify-center mb-8 flex-shrink-0"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--accent)',
              }}
            >
              <Sparkles className="w-5 h-5" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="hero-title mb-2"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}
            >
              {getGreeting()}, {user?.username || 'Student'}.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="font-sans mb-10 font-normal leading-relaxed"
              style={{ fontSize: '15px', color: 'var(--fg-3)', maxWidth: '380px' }}
            >
              What would you like to understand today?
            </motion.p>

            {/* Prompt Input */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full rounded-md p-4 flex flex-col gap-3 transition-all duration-200"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-premium-lg)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Ask any question across your course materials..."
                rows={3}
                className="w-full bg-transparent font-sans placeholder:text-[var(--fg-3)] outline-none resize-none px-2 pt-1"
                style={{ fontSize: '15px', color: 'var(--fg)' }}
              />
              <div
                className="flex items-center justify-between pt-3 px-1"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2 font-sans select-none" style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                  <span className="keycap">↵</span>
                  <span>to ask</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleSubmit()}
                  disabled={!query.trim() || loading}
                  className="w-8 h-8 rounded-md flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer"
                  style={{ background: 'var(--fg)', color: 'var(--bg)' }}
                >
                  <ArrowUp className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>

            {/* Suggestion Chips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.22, duration: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-xl"
            >
              {SUGGESTION_CHIPS.map((chip) => (
                <motion.button
                  key={chip.id}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSubmit(chip.text)}
                  className="font-sans cursor-pointer transition-all"
                  style={{
                    fontSize: '12px',
                    padding: '0.5rem 0.875rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--fg-2)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                    e.currentTarget.style.color = 'var(--fg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--fg-2)';
                  }}
                >
                  {chip.text}
                </motion.button>
              ))}
            </motion.div>
          </div>
        ) : (
          /* Conversation View */
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-10 max-w-[720px] mx-auto w-full flex flex-col gap-10">
            {conversation.map((msg, idx) => (
              <div key={msg.id || idx} className="flex flex-col gap-4">
                {msg.role === 'user' ? (
                  /* User Question */
                  <div
                    className="flex items-start gap-3 pb-6"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div
                      className="w-7 h-7 rounded-full font-semibold flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--fg-2)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Q
                    </div>
                    <h2 className="font-sans font-medium pt-0.5 leading-snug" style={{ fontSize: '16px', color: 'var(--fg)' }}>
                      {msg.content}
                    </h2>
                  </div>
                ) : (
                  /* AI Response */
                  <div className="flex flex-col gap-5">
                    {/* AI mark */}
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-sans font-medium" style={{ fontSize: '12px', color: 'var(--fg-3)' }}>
                        AuraStudy AI
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ color: 'var(--fg)' }}>
                      {renderMarkdown(msg.content)}
                    </div>

                    {/* Citation Sources */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div
                        className="pt-5 flex flex-col gap-2.5"
                        style={{ borderTop: '1px solid var(--border)' }}
                      >
                        <span
                          className="flex items-center gap-1.5 font-sans uppercase tracking-wider"
                          style={{ fontSize: '10px', fontWeight: 600, color: 'var(--fg-3)' }}
                        >
                          <BookOpen className="w-3 h-3" />
                          Sources
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((c, cIdx) => (
                            <motion.button
                              key={cIdx}
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setActiveCitation(c)}
                              className="flex items-center gap-2 cursor-pointer transition-all font-sans"
                              style={{
                                fontSize: '12px',
                                padding: '0.375rem 0.75rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-surface)',
                                color: 'var(--fg-2)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--accent)';
                                e.currentTarget.style.color = 'var(--fg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.color = 'var(--fg-2)';
                              }}
                            >
                              <FileText className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                              <span>{c.document_title}</span>
                              <span
                                className="font-mono"
                                style={{ fontSize: '10px', color: 'var(--fg-3)' }}
                              >
                                p.{c.page_number}
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-4 font-sans px-1" style={{ fontSize: '12px', color: 'var(--fg-3)' }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          setCopiedIndex(idx);
                          setTimeout(() => setCopiedIndex(null), 2000);
                        }}
                        className="flex items-center gap-1.5 cursor-pointer transition-colors"
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
                      >
                        {copiedIndex === idx
                          ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                        <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={() => handleSaveToNotebook(msg)}
                        className="flex items-center gap-1.5 cursor-pointer transition-colors"
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Save to Notebook</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex items-center gap-3 py-4 font-sans" style={{ fontSize: '13px', color: 'var(--fg-3)' }}>
                <div className="ai-thinking-line" />
                <span>Searching course materials…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Floating Input Bar at Bottom */}
        {isConversationActive && (
          <div
            className="w-full sticky bottom-0 z-10"
            style={{ background: 'color-mix(in srgb, var(--bg) 90%, transparent)', backdropFilter: 'blur(12px)' }}
          >
            <div className="max-w-[720px] mx-auto w-full p-4">
              <div
                className="flex items-center gap-3 rounded-md px-4 py-2.5 transition-all"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-premium-lg)',
                }}
              >
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask a follow-up question…"
                  className="flex-1 bg-transparent outline-none font-sans"
                  style={{ fontSize: '14px', color: 'var(--fg)' }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSubmit()}
                  disabled={!query.trim() || loading}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer flex-shrink-0"
                  style={{ background: 'var(--fg)', color: 'var(--bg)' }}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Citation Side Drawer */}
      <AnimatePresence>
        {activeCitation && (
          <motion.div
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-80 flex flex-col justify-between p-6 z-20 overflow-y-auto"
            style={{
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border)',
              boxShadow: 'var(--shadow-premium-xl)',
            }}
          >
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div
                className="flex items-center justify-between pb-4"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2 font-sans font-medium" style={{ fontSize: '13px', color: 'var(--fg)' }}>
                  <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span>Source</span>
                </div>
                <button
                  onClick={() => setActiveCitation(null)}
                  className="p-1.5 rounded-lg cursor-pointer transition-colors"
                  style={{ color: 'var(--fg-3)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-3)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Document info */}
              <div className="flex flex-col gap-2">
                <span className="font-sans font-semibold" style={{ fontSize: '14px', color: 'var(--fg)' }}>
                  {activeCitation.document_title}
                </span>
                <span
                  className="keycap w-fit"
                  style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}
                >
                  Page {activeCitation.page_number}
                </span>
              </div>

              {/* Excerpt */}
              <div
                className="p-4 rounded-xl font-sans leading-relaxed italic"
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  color: 'var(--fg-2)',
                }}
              >
                "{activeCitation.excerpt}"
              </div>

              {/* Relevance score */}
              <div className="flex flex-col gap-2" style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                <div className="flex items-center justify-between font-sans">
                  <span>Relevance score</span>
                  <span className="font-mono" style={{ color: 'var(--fg-2)' }}>
                    {Math.round((activeCitation.relevance_score || 0.9) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(activeCitation.relevance_score || 0.9) * 100}%`, background: 'var(--accent)' }}
                  />
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => setActiveCitation(null)}
              className="w-full py-2.5 rounded-lg font-sans font-medium cursor-pointer transition-all flex items-center justify-center gap-2 mt-6"
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                color: 'var(--fg-2)',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--fg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-subtle)';
                e.currentTarget.style.color = 'var(--fg-2)';
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Document Viewer</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
