import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  Bookmark,
  FileText,
  Plus,
  Trash2,
  Bot,
  GripVertical,
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { AiChatWindow } from '../chat/AiChatWindow';

const PAGE_DATA = {
  1: {
    title: 'DOCUMENT CONTENT CANVAS',
    author: 'Registered Document Stream — StudentAssist',
    paragraphs: [
      {
        id: 'p1',
        text: 'Select or upload a registered course material from the Content Studio tab to view extracted page contents, AI citations, and annotations.',
      },
    ],
  },
};

export function DocumentViewer() {
  const toast = useToast();

  const [splitPct, setSplitPct] = useState(55);
  const containerRef = useRef(null);
  const isResizing = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePane, setMobilePane] = useState('canvas'); // 'canvas' | 'copilot'

  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [rightTab, setRightTab] = useState('ai-chat'); // 'ai-chat' | 'notes'
  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState('');
  const [bookmarks, setBookmarks] = useState([]);

  const totalPages = Object.keys(PAGE_DATA).length;
  const pageData = PAGE_DATA[currentPage] ?? PAGE_DATA[1];
  const isBookmarked = bookmarks.some((b) => b.page === currentPage);

  /* ── Resize handlers ─────────────────────────────────── */
  const onMouseMove = useCallback((e) => {
    if (!isResizing.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    if (pct >= 25 && pct <= 75) setSplitPct(pct);
  }, []);

  const onMouseUp = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const onMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      isResizing.current = true;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [onMouseMove, onMouseUp]
  );

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  /* ── Responsive ─────────────────────────────────────── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* ── Notes ──────────────────────────────────────────── */
  const addNote = (e) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    setNotes((p) => [...p, { id: Date.now(), page: currentPage, text: noteInput.trim() }]);
    setNoteInput('');
    toast.success('Annotation saved.');
  };
  const deleteNote = (id) => {
    setNotes((p) => p.filter((n) => n.id !== id));
    toast.info('Note removed.');
  };
  const toggleBookmark = () => {
    if (isBookmarked) {
      setBookmarks((p) => p.filter((b) => b.page !== currentPage));
      toast.info(`Bookmark removed for page ${currentPage}.`);
    } else {
      setBookmarks((p) => [...p, { id: Date.now(), page: currentPage, title: pageData.title }]);
      toast.success(`Page ${currentPage} bookmarked.`);
    }
  };

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 h-11 px-3 flex items-center justify-between gap-2"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Left: file + pagination */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
            <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <span
              className="font-sans font-medium text-xs truncate max-w-[80px] sm:max-w-[180px]"
              style={{ color: 'var(--fg)' }}
            >
              Document_Viewer.pdf
            </span>
          </div>

          <span className="text-xs select-none px-1" style={{ color: 'var(--border)' }}>|</span>

          {/* Pagination */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded disabled:opacity-30 cursor-pointer"
              style={{ color: 'var(--fg-3)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] px-0.5 whitespace-nowrap" style={{ color: 'var(--fg)' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded disabled:opacity-30 cursor-pointer"
              style={{ color: 'var(--fg-3)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: mobile tab switcher */}
        {isMobile && (
          <div
            className="flex items-center p-0.5 rounded-md flex-shrink-0"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          >
            {['canvas', 'copilot'].map((tab) => (
              <button
                key={tab}
                onClick={() => setMobilePane(tab)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer capitalize transition-all"
                style={{
                  background: mobilePane === tab ? 'var(--bg-surface)' : 'transparent',
                  color: mobilePane === tab ? 'var(--fg)' : 'var(--fg-3)',
                }}
              >
                {tab === 'canvas' ? 'Doc' : 'AI'}
              </button>
            ))}
          </div>
        )}

        {/* Right: search, zoom, bookmark */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Search — desktop only */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          >
            <Search className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--fg-3)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find in page…"
              className="bg-transparent text-[11px] outline-none w-20 font-sans"
              style={{ color: 'var(--fg)' }}
            />
          </div>

          {/* Zoom — desktop only */}
          <div className="hidden sm:flex items-center gap-0">
            <button
              onClick={() => setZoom((z) => Math.max(75, z - 10))}
              className="p-1 rounded cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--fg-3)' }}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] w-8 text-center" style={{ color: 'var(--fg)' }}>
              {zoom}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="p-1 rounded cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--fg-3)' }}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bookmark */}
          <button
            onClick={toggleBookmark}
            className="p-1.5 rounded-md border cursor-pointer transition-all"
            style={{
              background: isBookmarked ? 'var(--accent-dim)' : 'transparent',
              borderColor: isBookmarked ? 'var(--accent)' : 'var(--border)',
              color: isBookmarked ? 'var(--accent)' : 'var(--fg-3)',
            }}
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Split Layout ─────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden min-h-0 w-full">

        {/* Left: Document Canvas */}
        {(!isMobile || mobilePane === 'canvas') && (
          <div
            className="h-full overflow-y-auto"
            style={{
              width: isMobile ? '100%' : `${splitPct}%`,
              flexShrink: 0,
              padding: isMobile ? '16px' : '28px',
              background: 'var(--bg)',
            }}
          >
            <div
              className="mx-auto transition-all duration-150"
              style={{ maxWidth: `${Math.round(640 * (zoom / 100))}px` }}
            >
              {/* Paper */}
              <div
                className="rounded-xl flex flex-col gap-4"
                style={{
                  padding: isMobile ? '20px' : '36px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {/* Page header */}
                <div
                  className="flex flex-col gap-1 pb-4"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <h1
                    className="font-sans font-semibold tracking-tight leading-snug"
                    style={{
                      fontSize: `${Math.max(14, Math.round(18 * (zoom / 100)))}px`,
                      color: 'var(--fg)',
                    }}
                  >
                    {pageData.title}
                  </h1>
                  <p
                    className="font-sans"
                    style={{
                      fontSize: `${Math.max(10, Math.round(12 * (zoom / 100)))}px`,
                      color: 'var(--fg-3)',
                    }}
                  >
                    {pageData.author}
                  </p>
                </div>

                {/* Content */}
                {pageData.paragraphs?.map((p) => (
                  <p
                    key={p.id}
                    className="leading-relaxed font-sans"
                    style={{
                      fontSize: `${Math.max(12, Math.round(14 * (zoom / 100)))}px`,
                      color: 'var(--fg-2)',
                    }}
                  >
                    {p.text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Resize handle — desktop only */}
        {!isMobile && (
          <div
            onMouseDown={onMouseDown}
            className="w-1 cursor-col-resize flex-shrink-0 flex items-center justify-center select-none z-10 transition-opacity hover:opacity-80"
            style={{ background: 'var(--border)' }}
          >
            <GripVertical className="w-3 h-3 opacity-50" style={{ color: 'var(--fg-3)' }} />
          </div>
        )}

        {/* Right: AI + Annotations */}
        {(!isMobile || mobilePane === 'copilot') && (
          <div
            className="flex flex-col overflow-hidden min-h-0"
            style={{
              width: isMobile ? '100%' : `calc(${100 - splitPct}% - 4px)`,
              borderLeft: isMobile ? 'none' : '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}
          >
            {/* Tab strip */}
            <div
              className="flex-shrink-0 flex gap-1 px-2 py-1.5"
              style={{
                background: 'var(--bg-subtle)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {[
                { key: 'ai-chat', label: 'AI Copilot', icon: Bot },
                { key: 'notes', label: `Notes (${notes.length})`, icon: Bookmark },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setRightTab(key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-all text-[11px] font-medium font-sans"
                  style={{
                    background: rightTab === key ? 'var(--bg-surface)' : 'transparent',
                    color: rightTab === key ? 'var(--fg)' : 'var(--fg-3)',
                    border: rightTab === key ? '1px solid var(--border)' : '1px solid transparent',
                  }}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Tab content — this must be flex-1 min-h-0 overflow-hidden to contain AiChatWindow */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {rightTab === 'ai-chat' ? (
                <AiChatWindow />
              ) : (
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                  {/* Note form */}
                  <form onSubmit={addNote} className="flex flex-col gap-2">
                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder={`Annotate page ${currentPage}…`}
                      rows={3}
                      className="w-full rounded-lg p-2.5 text-xs outline-none resize-none font-sans transition-colors"
                      style={{
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                        color: 'var(--fg)',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    />
                    <button
                      type="submit"
                      className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-opacity hover:opacity-80"
                      style={{ background: 'var(--fg)', color: 'var(--bg)' }}
                    >
                      <Plus className="w-3 h-3" />
                      Save note
                    </button>
                  </form>

                  {/* Notes list */}
                  {notes.length === 0 ? (
                    <p className="text-xs text-center py-8" style={{ color: 'var(--fg-3)' }}>
                      No annotations yet.
                    </p>
                  ) : (
                    notes.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-lg flex flex-col gap-1.5"
                        style={{
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px]" style={{ color: 'var(--accent)' }}>
                            Page {n.page}
                          </span>
                          <button
                            onClick={() => deleteNote(n.id)}
                            className="cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--fg-3)' }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed font-sans" style={{ color: 'var(--fg)' }}>
                          {n.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}