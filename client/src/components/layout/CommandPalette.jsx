import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CornerDownLeft, Settings, SunMoon, LogOut } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useTheme } from '../ui/Theme';
import { useOverlay } from '../ui/useOverlay';

/**
 * Command palette (⌘K / Ctrl+K). Navigation entries come from NAV_ITEMS so a
 * role can never be offered a page it isn't allowed to open.
 */
export function CommandPalette({ isOpen, onClose, setActiveTab, user, onOpenSettings, onLogout }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const { toggleTheme, isDark } = useTheme();
  useOverlay(isOpen, onClose, panelRef);

  const commands = useMemo(() => {
    const nav = (NAV_ITEMS[user?.role] ?? NAV_ITEMS.student).map((i) => ({
      id: `go-${i.id}`,
      group: 'Go to',
      title: i.label,
      desc: i.description,
      icon: i.icon,
      run: () => setActiveTab(i.tab),
    }));
    const actions = [
      { id: 'theme', group: 'Actions', title: isDark ? 'Switch to light theme' : 'Switch to dark theme', icon: SunMoon, run: toggleTheme },
      { id: 'settings', group: 'Actions', title: 'Open settings', desc: 'Profile, password and appearance', icon: Settings, run: onOpenSettings },
      { id: 'logout', group: 'Actions', title: 'Sign out', icon: LogOut, run: onLogout },
    ];
    return [...nav, ...actions];
  }, [user?.role, setActiveTab, toggleTheme, isDark, onOpenSettings, onLogout]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? commands.filter((c) => c.title.toLowerCase().includes(q) || c.desc?.toLowerCase().includes(q))
    : commands;

  useEffect(() => { if (isOpen) { setQuery(''); setIndex(0); } }, [isOpen]);
  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (cmd) => { onClose(); setTimeout(() => cmd.run?.(), 0); };

  const onKeyDown = (e) => {
    if (!filtered.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => (i + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[index]); }
  };

  let lastGroup = null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-start justify-center px-3 pt-[12dvh]" style={{ zIndex: 'var(--z-modal)' }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-fg-3" aria-hidden />
              <input
                data-autofocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search pages and actions…"
                aria-label="Search commands"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-list"
                aria-activedescendant={filtered[index] ? `cmd-${filtered[index].id}` : undefined}
                className="h-13 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-3"
              />
              <kbd className="keycap hidden sm:inline-flex">Esc</kbd>
            </div>

            <div ref={listRef} id="command-list" role="listbox" className="max-h-[min(60dvh,380px)] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-10 text-center text-[13px] text-fg-3">No matches for “{query}”.</p>
              ) : (
                filtered.map((cmd, i) => {
                  const Icon = cmd.icon;
                  const selected = i === index;
                  const header = cmd.group !== lastGroup ? cmd.group : null;
                  lastGroup = cmd.group;
                  return (
                    <React.Fragment key={cmd.id}>
                      {header && <p className="px-2.5 pt-2.5 pb-1 text-[11.5px] font-medium text-fg-3">{header}</p>}
                      <button
                        id={`cmd-${cmd.id}`}
                        data-index={i}
                        role="option"
                        aria-selected={selected}
                        onClick={() => run(cmd)}
                        onMouseMove={() => setIndex(i)}
                        className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${selected ? 'bg-subtle' : ''}`}
                      >
                        <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border ${selected ? 'bg-surface text-fg' : 'bg-subtle text-fg-3'}`}>
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[13.5px] font-medium text-fg">{cmd.title}</span>
                          {cmd.desc && <span className="truncate text-xs text-fg-3">{cmd.desc}</span>}
                        </span>
                        {selected && <CornerDownLeft className="size-3.5 shrink-0 text-fg-3" aria-hidden />}
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            <div className="hidden items-center gap-4 border-t border-border bg-subtle/60 px-4 py-2 text-xs text-fg-3 sm:flex">
              <span className="flex items-center gap-1.5"><kbd className="keycap">↑</kbd><kbd className="keycap">↓</kbd> to move</span>
              <span className="flex items-center gap-1.5"><kbd className="keycap">↵</kbd> to open</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
