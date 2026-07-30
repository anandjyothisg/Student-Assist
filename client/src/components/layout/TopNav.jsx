import React from 'react';
import { Search, Moon, Sun } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useTheme } from '../ui/Theme';

const TAB_LABELS = {
  assistant: 'Ask',
  documents: 'Sources',
  notebook:  'Notebook',
  academic:  'Content',
  analytics: 'Analytics',
  dashboard: 'Status',
  accounts:  'Users',
};

export function TopNav({ onMenuOpen, activeTab, user, onOpenCommandPalette }) {
  const { isDark, toggleTheme } = useTheme();
  const role  = user?.role ?? 'student';
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student;

  const activeItem = items.find((i) => i.tab === activeTab);
  const pageTitle  = activeItem?.label ?? TAB_LABELS[activeTab] ?? '';

  return (
    <header
      className="sticky top-0 z-20 w-full h-12 flex items-center justify-between px-5"
      style={{
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Left: mobile menu + page title */}
      <div className="flex items-center gap-3">
        {onMenuOpen && (
          <button
            onClick={onMenuOpen}
            className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--fg-3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg)';
              e.currentTarget.style.background = 'var(--bg-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-3)';
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label="Open menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect y="3" width="16" height="1.5" rx="0.75" />
              <rect y="7.25" width="11" height="1.5" rx="0.75" />
              <rect y="11.5" width="16" height="1.5" rx="0.75" />
            </svg>
          </button>
        )}

        {pageTitle && (
          <span
            className="font-sans text-[13px] font-medium tracking-tight select-none"
            style={{ color: 'var(--fg-2)' }}
          >
            {pageTitle}
          </span>
        )}
      </div>

      {/* Right: theme toggle + command palette */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer"
          style={{ color: 'var(--fg-3)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--fg)';
            e.currentTarget.style.background = 'var(--bg-subtle)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--fg-3)';
            e.currentTarget.style.background = 'transparent';
          }}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark
            ? <Sun className="w-3.5 h-3.5" />
            : <Moon className="w-3.5 h-3.5" />
          }
        </button>

        {/* Command palette */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          style={{
            color: 'var(--fg-3)',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            fontSize: '12px',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--fg-2)';
            e.currentTarget.style.borderColor = 'var(--border-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--fg-3)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search</span>
          <span className="keycap hidden sm:inline-flex" style={{ fontSize: '10px' }}>⌘K</span>
        </button>
      </div>
    </header>
  );
}
