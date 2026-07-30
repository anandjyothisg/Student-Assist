import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MessageSquare, BookOpen, NotebookPen,
  FolderOpen, BarChart2, Users, Layers, ArrowRight,
} from 'lucide-react';

const allActions = [
  { id: 'assistant', title: 'Ask AI',          desc: 'Query your course materials with AI',       icon: MessageSquare, role: 'all' },
  { id: 'documents', title: 'Document Viewer', desc: 'Read lecture notes and sources',             icon: BookOpen,      role: 'all' },
  { id: 'notebook',  title: 'Study Notebook',  desc: 'Review saved answers and highlights',        icon: NotebookPen,   role: 'student' },
  { id: 'academic',  title: 'Content Studio',  desc: 'Upload and organize course files',           icon: FolderOpen,    role: 'teacher' },
  { id: 'analytics', title: 'Analytics',       desc: 'Track curriculum coverage and difficulty',   icon: BarChart2,     role: 'teacher' },
  { id: 'accounts',  title: 'User Directory',  desc: 'Manage student and teacher access',          icon: Users,         role: 'admin' },
  { id: 'academic',  title: 'Subject Catalog', desc: 'Manage curriculum tags and course lists',    icon: Layers,        role: 'admin' },
];

export function CommandPalette({ isOpen, onClose, setActiveTab, user }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const role = user?.role || 'student';

  const filtered = allActions.filter((a) =>
    (a.role === 'all' || a.role === role) &&
    (
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.desc.toLowerCase().includes(query.toLowerCase())
    )
  );

  const handleSelect = useCallback((tab) => {
    setActiveTab(tab);
    setQuery('');
    onClose();
  }, [setActiveTab, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      }
      if (e.key === 'Enter' && filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex].id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, filtered, selectedIndex, handleSelect]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg rounded-xl overflow-hidden z-10 flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Search Input */}
            <div
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--fg-3)' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or run a command..."
                className="flex-1 bg-transparent outline-none text-[14px]"
                style={{
                  color: 'var(--fg)',
                  fontFamily: 'var(--font-sans)',
                }}
              />
              <span className="keycap flex-shrink-0">ESC</span>
            </div>

            {/* Results */}
            <div className="py-1.5 max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <div
                  className="py-8 text-center text-[13px]"
                  style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
                >
                  No results for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <div className="px-1.5 flex flex-col gap-0.5">
                  {filtered.map((item, idx) => {
                    const Icon = item.icon;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`${item.id}-${idx}`}
                        onClick={() => handleSelect(item.id)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-left"
                        style={{
                          background: isSelected ? 'var(--bg-hover)' : 'transparent',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: isSelected ? 'var(--bg-canvas, var(--bg))' : 'var(--bg-subtle)',
                              color: isSelected ? 'var(--fg)' : 'var(--fg-3)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col">
                            <span
                              className="text-[13px] font-medium"
                              style={{
                                color: 'var(--fg)',
                                fontFamily: 'var(--font-sans)',
                              }}
                            >
                              {item.title}
                            </span>
                            <span
                              className="text-[11px]"
                              style={{
                                color: 'var(--fg-3)',
                                fontFamily: 'var(--font-sans)',
                              }}
                            >
                              {item.desc}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <ArrowRight
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: 'var(--fg-3)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
              }}
            >
              <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                <span><span className="keycap">↑↓</span> navigate</span>
                <span><span className="keycap">↵</span> select</span>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                SmartStudent AI
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
