import React, { useState, useEffect, useRef } from 'react';
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
  User
} from 'lucide-react';

import { Heading, Text } from '../ui/Typography';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../ui/Toast';
import { Loader } from '../ui/Loader';

export function AiChatWindow() {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isCopilot, setIsCopilot] = useState(true);
  const [streamingIndex, setStreamingIndex] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const [activeSources, setActiveSources] = useState([]);
  const messagesEndRef = useRef(null);

  const suggestions = [
    {
      id: 'quicksort',
      title: 'Analyze Quicksort Complexity',
      query: 'Analyze the mathematical complexity bounds of the Quicksort algorithm and show a code block.',
      icon: Terminal
    },
    {
      id: 'svm',
      title: 'Derive SVM Margins',
      query: 'Explain Support Vector Machines margin classification and derive the primal optimization formula.',
      icon: Sigma
    },
    {
      id: 'k-maps',
      title: 'Simplify K-Maps',
      query: 'What are the rules to simplify logic using Karnaugh Maps (K-Maps)? Include a simple boolean expression.',
      icon: BookOpen
    }
  ];

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userQuery = input;
    setInput('');

    const userMsg = { id: Date.now(), sender: 'user', text: userQuery };
    const aiMsgId = Date.now() + 1;
    const aiMsg = { 
      id: aiMsgId, 
      sender: 'ai', 
      text: '', 
      sources: [], 
      isStreaming: true 
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);

    try {
      const res = await api.post('/ai/ask/', { query: userQuery });
      const answerText = res.data.answer || res.data.response || `Received query: "${userQuery}". Connect registered data source for indexed analysis.`;
      const sources = res.data.citations ? res.data.citations.map((c, i) => ({
        id: i + 1,
        title: c.document_title || 'Registered Document',
        url: '#',
        site: `Page ${c.page_number || 1}`
      })) : [];
      
      setActiveSources(sources);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, sources } : msg
        )
      );
      streamResponse(answerText, aiMsgId);
    } catch (_err) {
      const fallbackText = `I have received your query: "${userQuery}". No registered files were found matching this prompt. Please upload your course documents to begin indexed retrieval.`;
      streamResponse(fallbackText, aiMsgId);
    }
  };

  const handleSuggestionClick = (query) => {
    setInput(query);
  };

  const [copiedId, setCopiedId] = useState(null);
  const handleCopyToClipboard = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Message copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = (id) => {
    const aiMsg = messages.find((m) => m.id === id);
    if (!aiMsg) return;

    const searchKey = Object.keys(mockDatabase).find(
      (key) => (aiMsg.text.includes('Quicksort') && key === 'quicksort') ||
               (aiMsg.text.includes('Vector') && key === 'svm') ||
               (aiMsg.text.includes('Karnaugh') && key === 'k-maps')
    );

    const matchText = searchKey ? mockDatabase[searchKey].text : aiMsg.text;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, text: '', isStreaming: true } : msg
      )
    );

    toast.info('Regenerating response...');
    setTimeout(() => {
      streamResponse(matchText, id);
    }, 400);
  };

  const renderMessageContent = (text, isAi) => {
    if (!isAi) return <p className="text-sm font-sans text-[#FAFAFA]">{text}</p>;

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const precedingText = text.substring(lastIndex, match.index);
      if (precedingText) {
        parts.push({ type: 'text', content: precedingText });
      }
      parts.push({ type: 'code', lang: match[1] || 'code', content: match[2] });
      lastIndex = codeBlockRegex.lastIndex;
    }

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }

    return (
      <div className="flex flex-col gap-4 font-sans text-sm text-[#FAFAFA] leading-relaxed">
        {parts.map((part, pIdx) => {
          if (part.type === 'code') {
            return (
              <div key={pIdx} className="rounded-2xl border border-white/[0.05] bg-[#09090B] text-[#FAFAFA] overflow-hidden flex flex-col font-mono text-xs my-2 shadow-sm">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-[#18181B] select-none text-[11px] text-[#71717A]">
                  <span className="uppercase font-medium">{part.lang}</span>
                  <button 
                    onClick={() => handleCopyToClipboard(pIdx + '_code', part.content)}
                    className="flex items-center gap-1.5 hover:text-[#FAFAFA] cursor-pointer"
                  >
                    {copiedId === pIdx + '_code' ? (
                      <>
                        <Check className="w-3 h-3 text-[#10B981]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto leading-normal">
                  <code>{part.content}</code>
                </pre>
              </div>
            );
          }

          const subText = part.content;
          const subParts = subText.split(/(\$\$[\s\S]*?\$\$)/g);

          return (
            <div key={pIdx} className="flex flex-col gap-3">
              {subParts.map((subPart, sIdx) => {
                if (subPart.startsWith('$$') && subPart.endsWith('$$')) {
                  const formula = subPart.substring(2, subPart.length - 2).trim();
                  return (
                    <div 
                      key={sIdx} 
                      className="py-4 px-6 rounded-2xl border border-[#2563EB]/20 bg-[#2563EB]/10 flex items-center justify-center my-2 text-center overflow-x-auto relative group shadow-sm"
                    >
                      <div className="absolute top-2 left-3 flex items-center gap-1 text-[9px] text-[#2563EB] font-bold uppercase select-none font-mono">
                        <Sigma className="w-3 h-3 text-[#2563EB]" /> Formula
                      </div>
                      <span className="font-serif text-lg font-normal tracking-wide text-[#FAFAFA]">
                        {formula}
                      </span>
                    </div>
                  );
                }

                const boldParts = subPart.split(/(\*\*.*?\*\*)/g);
                return (
                  <p key={sIdx} className="leading-relaxed">
                    {boldParts.map((bPart, bIdx) => {
                      if (bPart.startsWith('**') && bPart.endsWith('**')) {
                        return (
                          <strong key={bIdx} className="font-semibold text-[#FAFAFA]">
                            {bPart.substring(2, bPart.length - 2)}
                          </strong>
                        );
                      }

                      const citationParts = bPart.split(/(\[\d+\])/g);
                      return (
                        <React.Fragment key={bIdx}>
                          {citationParts.map((cPart, cIdx) => {
                            if (cPart.startsWith('[') && cPart.endsWith(']')) {
                              const num = cPart.substring(1, cPart.length - 1);
                              return (
                                <sup 
                                  key={cIdx} 
                                  className="text-[10px] font-semibold text-[#2563EB] bg-[#2563EB]/15 border border-[#2563EB]/30 px-1 rounded mx-0.5 select-none cursor-pointer"
                                  onClick={() => {
                                    toast.info(`Citation [${num}] references source card`);
                                  }}
                                >
                                  {num}
                                </sup>
                              );
                            }
                            return cPart;
                          })}
                        </React.Fragment>
                      );
                    })}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 font-sans relative">
      
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6 gap-5 overflow-y-auto">
          <div className="flex flex-col items-center gap-2.5">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center font-serif text-xl shadow-sm"
              style={{ background: 'var(--fg)', color: 'var(--bg)' }}
            >
              A
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight" style={{ color: 'var(--fg)' }}>
              Where knowledge begins.
            </h2>
            <p className="max-w-xs sm:max-w-md text-xs font-sans leading-relaxed" style={{ color: 'var(--fg-3)' }}>
              Search complexity bounds, SVM math primals, and K-Map logic. Optimized for study references.
            </p>
          </div>

          <div 
            className="w-full max-w-2xl mt-2 grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
          >
            {suggestions.map((s) => {
              const Icon = s.icon;
              return (
                <div 
                  key={s.id} 
                  onClick={() => handleSuggestionClick(s.query)}
                  className="flex flex-col text-left p-3.5 rounded-lg cursor-pointer transition-all duration-150 hover:border-[var(--accent)] group"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="p-1.5 rounded-md w-7 h-7 flex items-center justify-center mb-2.5 transition-colors" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-semibold text-xs leading-snug font-sans group-hover:text-[var(--accent)]" style={{ color: 'var(--fg)' }}>
                    {s.title}
                  </h4>
                  <p className="mt-1 text-[11px] leading-relaxed font-sans line-clamp-2" style={{ color: 'var(--fg-3)' }}>
                    {s.query}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 rounded-lg border min-h-0" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
          {messages.map((msg) => {
            const isAi = msg.sender === 'ai';
            const isCurrentStreaming = isAi && streamingIndex === msg.id;
            const currentText = isCurrentStreaming ? streamingText : msg.text;

            return (
              <div 
                key={msg.id} 
                className="flex flex-col gap-2.5 py-4 border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center border text-xs" style={{ background: isAi ? 'var(--accent-dim)' : 'var(--bg-surface)', borderColor: isAi ? 'var(--accent)' : 'var(--border)', color: isAi ? 'var(--accent)' : 'var(--fg-3)' }}>
                    {isAi ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                    {isAi ? 'AI Assistant' : 'You'}
                  </span>
                </div>

                {isAi && msg.sources && msg.sources.length > 0 && (
                  <div className="pl-8 flex flex-col gap-2 mt-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider select-none font-sans" style={{ color: 'var(--fg-3)' }}>
                      <Globe className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} /> Core Sources
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.sources.map((src) => (
                        <a
                          key={src.id}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 border rounded-md flex items-start gap-1.5 transition-colors cursor-pointer min-w-0"
                          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                        >
                          <span className="text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded flex-shrink-0 mt-0.5 font-mono" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                            {src.id}
                          </span>
                          <div className="min-w-0 font-sans">
                            <p className="text-[10px] font-semibold truncate leading-snug" style={{ color: 'var(--fg)' }}>
                              {src.title}
                            </p>
                            <p className="text-[9px] truncate mt-0.5" style={{ color: 'var(--fg-3)' }}>
                              {src.site}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pl-8 pr-2 min-h-[24px] relative">
                  {isCurrentStreaming ? (
                    <>
                      {renderMessageContent(currentText, isAi)}
                      <span className="inline-block w-1.5 h-4 animate-pulse ml-0.5" style={{ background: 'var(--accent)' }} />
                    </>
                  ) : msg.isStreaming && !isCurrentStreaming ? (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--fg-3)' }}>
                      <Loader variant="spinner" size="sm" />
                      <span>Synthesizing database sources...</span>
                    </div>
                  ) : (
                    renderMessageContent(msg.text, isAi)
                  )}
                </div>

                {isAi && !msg.isStreaming && !isCurrentStreaming && (
                  <div className="pl-8 flex items-center gap-2 mt-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleCopyToClipboard(msg.id, msg.text)}
                      iconLeft={copiedId === msg.id ? Check : Copy}
                      className="text-xs h-7"
                      style={{ color: 'var(--fg-3)' }}
                    >
                      {copiedId === msg.id ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRegenerate(msg.id)}
                      iconLeft={RotateCcw}
                      className="text-xs h-7"
                      style={{ color: 'var(--fg-3)' }}
                    >
                      Regenerate
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 border shadow-sm rounded-lg p-2 flex flex-wrap items-center gap-2 shrink-0 relative" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() => setIsCopilot(!isCopilot)}
          className="h-8 px-2.5 rounded-md border font-sans text-[11px] font-semibold flex items-center gap-1.5 transition-all select-none cursor-pointer shrink-0"
          style={{
            background: isCopilot ? 'var(--accent-dim)' : 'var(--bg-subtle)',
            borderColor: isCopilot ? 'var(--accent)' : 'var(--border)',
            color: isCopilot ? 'var(--accent)' : 'var(--fg-3)',
          }}
          aria-label="Toggle search engine mode"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">{isCopilot ? 'Web Copilot' : 'Normal Search'}</span>
        </button>

        <textarea
          rows="1"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 min-w-[120px] bg-transparent border-0 outline-none font-sans text-xs sm:text-sm py-1 resize-none max-h-12"
          style={{ color: 'var(--fg)' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 rounded-md cursor-pointer"
            style={{ color: 'var(--fg-3)' }}
            iconLeft={Paperclip}
            onClick={() => toast.info('Attaching document file...')}
            aria-label="Attach file"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!input.trim() || streamingIndex !== null}
            className="w-8 h-8 p-0 rounded-md cursor-pointer"
            style={{ background: 'var(--accent)', color: '#FFFFFF' }}
            iconLeft={Send}
            aria-label="Send message"
          />
        </div>
      </form>
    </div>
  );
}
