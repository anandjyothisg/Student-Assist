import React, { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ai-chat');

  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [mobileTab, setMobileTab] = useState('canvas'); // 'canvas' | 'copilot'

  const pagesData = {
    1: {
      title: 'DOCUMENT CONTENT CANVAS',
      author: 'Registered Document Stream — StudentAssist',
      paragraphs: [
        { id: 'p1', text: 'Select or upload a registered course material from the Content Studio tab to view extracted page contents, AI citations, and annotations.' }
      ],
      citations: []
    }
  };

  const totalPages = Object.keys(pagesData).length;
  const currentData = pagesData[currentPage] || pagesData[1];

  const handleMouseDown = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isResizingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
    if (newWidth >= 25 && newWidth <= 75) setSplitWidth(newWidth);
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const newNote = { id: Date.now(), page: currentPage, text: noteInput.trim() };
    setNotes(prev => [...prev, newNote]);
    setNoteInput('');
    toast.success('Annotation saved.');
  };

  const handleDeleteNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    toast.info('Note removed.');
  };

  const handleToggleBookmark = () => {
    const exists = bookmarks.find(b => b.page === currentPage);
    if (exists) {
      setBookmarks(prev => prev.filter(b => b.page !== currentPage));
      toast.info(`Bookmark for page ${currentPage} removed.`);
    } else {
      setBookmarks(prev => [...prev, { id: Date.now(), page: currentPage, title: currentData.title }]);
      toast.success(`Bookmarked page ${currentPage}.`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      
      {/* Top Control Toolbar */}
      <div className="h-12 px-3 sm:px-4 flex items-center justify-between text-xs font-sans shrink-0" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', color: 'var(--fg-3)' }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold min-w-0" style={{ color: 'var(--fg)' }}>
            <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="truncate max-w-[120px] sm:max-w-xs font-sans">Document_Viewer.pdf</span>
          </div>
          <span style={{ color: 'var(--border)' }}>|</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-md disabled:opacity-30 cursor-pointer hover:opacity-80"
              style={{ color: 'var(--fg-3)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] font-medium px-1" style={{ color: 'var(--fg)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-md disabled:opacity-30 cursor-pointer hover:opacity-80"
              style={{ color: 'var(--fg-3)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile View Toggle (hidden on desktop) */}
        {isMobile && (
          <div className="flex items-center p-0.5 rounded-lg border text-[11px]" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
            <button
              onClick={() => setMobileTab('canvas')}
              className="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer"
              style={{
                background: mobileTab === 'canvas' ? 'var(--bg-surface)' : 'transparent',
                color: mobileTab === 'canvas' ? 'var(--fg)' : 'var(--fg-3)',
                boxShadow: mobileTab === 'canvas' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Canvas
            </button>
            <button
              onClick={() => setMobileTab('copilot')}
              className="px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer"
              style={{
                background: mobileTab === 'copilot' ? 'var(--bg-surface)' : 'transparent',
                color: mobileTab === 'copilot' ? 'var(--fg)' : 'var(--fg-3)',
                boxShadow: mobileTab === 'copilot' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Copilot
            </button>
          </div>
        )}

        {/* Zoom & Search Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1 rounded-md px-2 py-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
            <Search className="w-3.5 h-3.5" style={{ color: 'var(--fg-3)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find in page..."
              className="bg-transparent text-xs outline-none w-20 sm:w-24"
              style={{ color: 'var(--fg)' }}
            />
          </div>
          <div className="hidden xs:flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(75, z - 10))} className="p-1 rounded-md cursor-pointer hover:opacity-80" style={{ color: 'var(--fg-3)' }}>
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] w-8 text-center" style={{ color: 'var(--fg)' }}>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))} className="p-1 rounded-md cursor-pointer hover:opacity-80" style={{ color: 'var(--fg-3)' }}>
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleToggleBookmark}
            className="p-1.5 rounded-md border transition-colors cursor-pointer"
            style={{
              background: bookmarks.some(b => b.page === currentPage) ? 'var(--accent-dim)' : 'var(--bg-surface)',
              borderColor: bookmarks.some(b => b.page === currentPage) ? 'var(--accent)' : 'var(--border)',
              color: bookmarks.some(b => b.page === currentPage) ? 'var(--accent)' : 'var(--fg-3)',
            }}
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative min-h-0 w-full">
        
        {/* Left Pane: Document Canvas */}
        {(!isMobile || mobileTab === 'canvas') && (
          <div
            className="h-full overflow-y-auto p-4 sm:p-8 md:p-10 flex justify-center min-w-0"
            style={{
              width: isMobile ? '100%' : `${splitWidth}%`,
              flexShrink: 0,
              background: 'var(--bg)',
            }}
          >
            <div
              className="w-full max-w-2xl rounded-lg p-6 sm:p-10 shadow-sm flex flex-col gap-5 transition-transform duration-150"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}
            >
              <div className="flex flex-col gap-1.5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <h1 className="font-sans text-lg sm:text-xl font-semibold tracking-tight leading-snug" style={{ color: 'var(--fg)' }}>
                  {currentData.title}
                </h1>
                <p className="text-xs font-sans font-medium" style={{ color: 'var(--fg-3)' }}>
                  {currentData.author}
                </p>
              </div>

              {currentData.paragraphs && currentData.paragraphs.map(p => (
                <p key={p.id} className="text-xs sm:text-[14px] leading-relaxed font-sans" style={{ color: 'var(--fg-2)' }}>
                  {p.text}
                </p>
              ))}

              {currentData.formula && (
                <div className="my-2 p-3 sm:p-4 rounded-md text-center font-mono text-sm sm:text-base font-semibold shadow-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
                  {currentData.formula}
                </div>
              )}

              {currentData.paragraphs2 && currentData.paragraphs2.map(p => (
                <p key={p.id} className="text-xs sm:text-[14px] leading-relaxed font-sans" style={{ color: 'var(--fg-2)' }}>
                  {p.text}
                </p>
              ))}

              {currentData.table && (
                <div className="my-2 overflow-x-auto rounded-md" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  <table className="w-full text-xs text-left font-sans">
                    <thead className="font-medium uppercase text-[10px]" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', color: 'var(--fg-3)' }}>
                      <tr>
                        <th className="p-2.5">Algorithm</th>
                        <th className="p-2.5">Average Case</th>
                        <th className="p-2.5">Worst Case</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}>
                      {currentData.table.map((r, i) => (
                        <tr key={i} className="hover:opacity-90 transition-colors">
                          <td className="p-2.5 font-semibold">{r.name}</td>
                          <td className="p-2.5 font-mono" style={{ color: 'var(--accent)' }}>{r.avg}</td>
                          <td className="p-2.5 font-mono" style={{ color: 'var(--fg-3)' }}>{r.worst}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resizable Handle (Desktop only) */}
        {!isMobile && (
          <div
            onMouseDown={handleMouseDown}
            className="w-1.5 hover:w-2 cursor-col-resize transition-all flex items-center justify-center group z-10 select-none shrink-0"
            style={{ background: 'var(--border)' }}
          >
            <GripVertical className="w-3 h-3" style={{ color: 'var(--fg-3)' }} />
          </div>
        )}

        {/* Right Pane: AI Assistant & Annotations */}
        {(!isMobile || mobileTab === 'copilot') && (
          <div
            className="h-full flex flex-col overflow-hidden min-w-0"
            style={{
              width: isMobile ? '100%' : 'auto',
              flex: isMobile ? 'none' : 1,
              background: 'var(--bg-surface)',
              borderLeft: isMobile ? 'none' : '1px solid var(--border)',
            }}
          >
            {/* Tab Strip */}
            <div className="flex items-center p-1.5 gap-1 text-xs font-sans shrink-0" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setActiveTab('ai-chat')}
                className="flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  background: activeTab === 'ai-chat' ? 'var(--bg-surface)' : 'transparent',
                  color: activeTab === 'ai-chat' ? 'var(--fg)' : 'var(--fg-3)',
                  boxShadow: activeTab === 'ai-chat' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <Bot className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                <span>AI Copilot</span>
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className="flex-1 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  background: activeTab === 'notes' ? 'var(--bg-surface)' : 'transparent',
                  color: activeTab === 'notes' ? 'var(--fg)' : 'var(--fg-3)',
                  boxShadow: activeTab === 'notes' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <Bookmark className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                <span>Annotations ({notes.length})</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 flex flex-col">
              {activeTab === 'ai-chat' ? (
                <AiChatWindow contextDocument="Document_Viewer.pdf" />
              ) : (
                <div className="flex flex-col gap-4">
                  <form onSubmit={handleAddNote} className="flex flex-col gap-2">
                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder={`Add annotation for Page ${currentPage}...`}
                      rows={3}
                      className="w-full border rounded-md p-3 text-xs outline-none focus:ring-2 focus:ring-[var(--accent)]/40 resize-none font-sans"
                      style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)', color: 'var(--fg)' }}
                    />
                    <button
                      type="submit"
                      className="self-end px-4 py-2 rounded-md text-white text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm hover:opacity-90"
                      style={{ background: 'var(--accent)' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Note</span>
                    </button>
                  </form>

                  <div className="flex flex-col gap-2.5 mt-2">
                    {notes.length === 0 ? (
                      <p className="text-xs text-center py-6" style={{ color: 'var(--fg-3)' }}>No annotations created yet.</p>
                    ) : (
                      notes.map((n) => (
                        <div key={n.id} className="p-3 rounded-md border flex flex-col gap-1 text-xs" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
                          <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--fg-3)' }}>
                            <span className="font-mono font-medium" style={{ color: 'var(--accent)' }}>Page {n.page}</span>
                            <button onClick={() => handleDeleteNote(n.id)} className="hover:opacity-80 cursor-pointer" style={{ color: 'var(--fg-3)' }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="leading-relaxed font-sans" style={{ color: 'var(--fg)' }}>{n.text}</p>
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
