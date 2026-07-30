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
  GripVertical
} from 'lucide-react';

import { useToast } from '../ui/Toast';
import { AiChatWindow } from '../chat/AiChatWindow';

export function DocumentViewer() {
  const toast = useToast();

  const [splitWidth, setSplitWidth] = useState(55);
  const containerRef = useRef(null);
  const isResizingRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ai-chat');
  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [mobileTab, setMobileTab] = useState('canvas');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const pagesData = {
    1: {
      title: 'DOCUMENT CONTENT CANVAS',
      author: 'Registered Document Stream — StudentAssist',
      paragraphs: [
        {
          id: 'p1',
          text: 'Select or upload a registered course material from the Content Studio tab to view extracted page contents, AI citations, and annotations.',
        },
      ],
      citations: [],
    },
  };

  const totalPages = Object.keys(pagesData).length;
  const currentData = pagesData[currentPage] || pagesData[1];

  // Stable refs for mouse handlers to fix removeEventListener mismatch
  const handleMouseMove = useCallback((e) => {
    if (!isResizingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    if (newWidth >= 25 && newWidth <= 75) setSplitWidth(newWidth);
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    setNotes((prev) => [
      ...prev,
      { id: Date.now(), page: currentPage, text: noteInput.trim() },
    ]);
    setNoteInput('');
    toast.success('Annotation saved.');
  };

  const handleDeleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.info('Note removed.');
  };

  const handleToggleBookmark = () => {
    const exists = bookmarks.find((b) => b.page === currentPage);
    if (exists) {
      setBookmarks((prev) => prev.filter((b) => b.page !== currentPage));
      toast.info(`Bookmark for page ${currentPage} removed.`);
    } else {
      setBookmarks((prev) => [
        ...prev,
        { id: Date.now(), page: currentPage, title: currentData.title },
      ]);
      toast.success(`Bookmarked page ${currentPage}.`);
    }
  };

  const isBookmarked = bookmarks.some((b) => b.page === currentPage);

  return (
    <div
      className="flex-1 flex flex-col h-full w-full overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      {/* ── Top Toolbar ── */}
      <div
        className="h-12 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          color: 'var(--fg-3)',
        }}
      >
        {/* Left: file name + pagination */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div
            className="flex items-center gap-1.5 min-w-0"
            style={{ color: 'var(--fg)' }}
          >
            <FileText
              className="w-4 h-4 flex-shrink-0"
              style={{ color: 'var(--accent)' }}
            />
            <span
              className="truncate text-xs font-medium font-sans max-w-[100px] sm:max-w-[200px]"
              style={{ color: 'var(--fg)' }}
            >
              Document_Viewer.pdf
            </span>
          </div>

          <span className="text-xs select-none" style={{ color: 'var(--border)' }}>
            |
          </span>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-md disabled:opacity-30 cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--fg-3)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              className="font-mono text-[11px] font-medium px-1 whitespace-nowrap"
              style={{ color: 'var(--fg)' }}
            >
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-md disabled:opacity-30 cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--fg-3)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: mobile tab toggle */}
        {isMobile && (
          <div
            className="flex items-center p-0.5 rounded-lg border text-[11px] shrink-0"
            style={{
              background: 'var(--bg-subtle)',
              borderColor: 'var(--border)',
            }}
          >
            {['canvas', 'copilot'].map((tab) => (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer capitalize"
                style={{
                  background:
                    mobileTab === tab ? 'var(--bg-surface)' : 'transparent',
                  color:
                    mobileTab === tab ? 'var(--fg)' : 'var(--fg-3)',
                }}
              >
                {tab === 'canvas' ? 'Canvas' : 'Copilot'}
              </button>
            ))}
          </div>
        )}

        {/* Right: search, zoom, bookmark */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search — hidden on mobile */}
          <div
            className="hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1"
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
            }}
          >
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--fg-3)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find in page..."
              className="bg-transparent text-[12px] outline-none w-20 sm:w-24 font-sans"
              style={{ color: 'var(--fg)' }}
            />
          </div>

          {/* Zoom — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(75, z - 10))}
              className="p-1 rounded-md cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--fg-3)' }}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span
              className="font-mono text-[11px] w-9 text-center"
              style={{ color: 'var(--fg)' }}
            >
              {zoom}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="p-1 rounded-md cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--fg-3)' }}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Bookmark */}
          <button
            onClick={handleToggleBookmark}
            className="p-1.5 rounded-md border transition-colors cursor-pointer"
            style={{
              background: isBookmarked ? 'var(--accent-dim)' : 'var(--bg-surface)',
              borderColor: isBookmarked ? 'var(--accent)' : 'var(--border)',
              color: isBookmarked ? 'var(--accent)' : 'var(--fg-3)',
            }}
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Main Split Layout ── */}
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden min-h-0 w-full relative"
      >
        {/* Left Pane: Document Canvas */}
        {(!isMobile || mobileTab === 'canvas') && (
          <div
            className="h-full overflow-y-auto flex justify-center min-w-0"
            style={{
              width: isMobile ? '100%' : `${splitWidth}%`,
              flexShrink: 0,
              background: 'var(--bg)',
              padding: isMobile ? '16px' : '32px',
            }}
          >
            {/* Zoom wrapper — translate instead of scale to avoid clipping */}
            <div
              className="w-full transition-all duration-150"
              style={{
                maxWidth: `${Math.round(672 * (zoom / 100))}px`,
              }}
            >
              <div
                className="w-full rounded-lg flex flex-col gap-5"
                style={{
                  padding: isMobile ? '20px' : '40px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                }}
              >
                {/* Page header */}
                <div
                  className="flex flex-col gap-1.5 pb-4"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <h1
                    className="font-sans font-semibold tracking-tight leading-snug"
                    style={{
                      color: 'var(--fg)',
                      fontSize: `${Math.max(14, Math.round(18 * (zoom / 100)))}px`,
                    }}
                  >
                    {currentData.title}
                  </h1>
                  <p
                    className="font-sans font-medium"
                    style={{
                      color: 'var(--fg-3)',
                      fontSize: `${Math.max(10, Math.round(12 * (zoom / 100)))}px`,
                    }}
                  >
                    {currentData.author}
                  </p>
                </div>

                {/* Paragraphs */}
                {currentData.paragraphs?.map((p) => (
                  <p
                    key={p.id}
                    className="leading-relaxed font-sans"
                    style={{
                      color: 'var(--fg-2)',
                      fontSize: `${Math.max(12, Math.round(14 * (zoom / 100)))}px`,
                    }}
                  >
                    {p.text}
                  </p>
                ))}

                {/* Formula */}
                {currentData.formula && (
                  <div
                    className="my-2 p-4 rounded-md text-center font-mono font-semibold"
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      color: 'var(--accent)',
                      fontSize: `${Math.max(12, Math.round(14 * (zoom / 100)))}px`,
                    }}
                  >
                    {currentData.formula}
                  </div>
                )}

                {/* Paragraphs 2 */}
                {currentData.paragraphs2?.map((p) => (
                  <p
                    key={p.id}
                    className="leading-relaxed font-sans"
                    style={{
                      color: 'var(--fg-2)',
                      fontSize: `${Math.max(12, Math.round(14 * (zoom / 100)))}px`,
                    }}
                  >
                    {p.text}
                  </p>
                ))}

                {/* Table */}
                {currentData.table && (
                  <div
                    className="my-2 overflow-x-auto rounded-md"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <table className="w-full text-left font-sans" style={{ fontSize: '12px' }}>
                      <thead
                        style={{
                          background: 'var(--bg-subtle)',
                          borderBottom: '1px solid var(--border)',
                          color: 'var(--fg-3)',
                        }}
                      >
                        <tr>
                          {['Algorithm', 'Average Case', 'Worst Case'].map((h) => (
                            <th key={h} className="p-2.5 font-medium uppercase text-[10px] tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody style={{ color: 'var(--fg)' }}>
                        {currentData.table.map((r, i) => (
                          <tr
                            key={i}
                            style={{ borderTop: '1px solid var(--border)' }}
                          >
                            <td className="p-2.5 font-semibold">{r.name}</td>
                            <td className="p-2.5 font-mono" style={{ color: 'var(--accent)' }}>
                              {r.avg}
                            </td>
                            <td className="p-2.5 font-mono" style={{ color: 'var(--fg-3)' }}>
                              {r.worst}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resize Handle — desktop only */}
        {!isMobile && (
          <div
            onMouseDown={handleMouseDown}
            className="w-1.5 cursor-col-resize flex items-center justify-center shrink-0 select-none z-10 hover:opacity-80 transition-opacity"
            style={{ background: 'var(--border)' }}
          >
            <GripVertical className="w-3 h-3" style={{ color: 'var(--fg-3)' }} />
          </div>
        )}

        {/* Right Pane: AI + Annotations */}
        {(!isMobile || mobileTab === 'copilot') && (
          <div
            className="h-full flex flex-col overflow-hidden min-w-0"
            style={{
              width: isMobile ? '100%' : `calc(${100 - splitWidth}% - 6px)`,
              background: 'var(--bg-surface)',
              borderLeft: isMobile ? 'none' : '1px solid var(--border)',
            }}
          >
            {/* Tab Strip */}
            <div
              className="flex items-center gap-1 p-1.5 shrink-0"
              style={{
                background: 'var(--bg-subtle)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {[
                { key: 'ai-chat', label: 'AI Copilot', icon: Bot },
                { key: 'notes', label: `Annotations (${notes.length})`, icon: Bookmark },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-sans"
                  style={{
                    background: activeTab === key ? 'var(--bg-surface)' : 'transparent',
                    color: activeTab === key ? 'var(--fg)' : 'var(--fg-3)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
              {activeTab === 'ai-chat' ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <AiChatWindow contextDocument="Document_Viewer.pdf" />
                </div>
              ) : (
                <div className="flex flex-col gap-4 p-3 sm:p-4">
                  {/* Note Form */}
                  <form onSubmit={handleAddNote} className="flex flex-col gap-2">
                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder={`Add annotation for Page ${currentPage}...`}
                      rows={3}
                      className="w-full rounded-md p-3 text-xs outline-none resize-none font-sans transition-all"
                      style={{
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                        color: 'var(--fg)',
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = 'var(--border-hover)')
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = 'var(--border)')
                      }
                    />
                    <button
                      type="submit"
                      className="self-end px-4 py-2 rounded-md text-xs font-medium cursor-pointer transition-opacity flex items-center gap-1.5 hover:opacity-80"
                      style={{
                        background: 'var(--fg)',
                        color: 'var(--bg)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Save Note
                    </button>
                  </form>

                  {/* Notes List */}
                  <div className="flex flex-col gap-2.5">
                    {notes.length === 0 ? (
                      <p
                        className="text-xs text-center py-8 font-sans"
                        style={{ color: 'var(--fg-3)' }}
                      >
                        No annotations created yet.
                      </p>
                    ) : (
                      notes.map((n) => (
                        <div
                          key={n.id}
                          className="p-3 rounded-md border flex flex-col gap-1.5"
                          style={{
                            background: 'var(--bg-subtle)',
                            borderColor: 'var(--border)',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="font-mono text-[11px] font-medium"
                              style={{ color: 'var(--accent)' }}
                            >
                              Page {n.page}
                            </span>
                            <button
                              onClick={() => handleDeleteNote(n.id)}
                              className="cursor-pointer hover:opacity-70 transition-opacity"
                              style={{ color: 'var(--fg-3)' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p
                            className="text-xs leading-relaxed font-sans"
                            style={{ color: 'var(--fg)' }}
                          >
                            {n.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}