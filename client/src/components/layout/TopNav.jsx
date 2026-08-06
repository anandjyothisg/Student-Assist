import React from 'react';
import { Search, Moon, Sun, Settings } from 'lucide-react';
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

export function TopNav({ activeTab, user, onOpenCommandPalette, onOpenSettings }) {
  const { isDark, toggleTheme } = useTheme();
  const role  = user?.role ?? 'student';
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student;

  const activeItem = items.find((i) => i.tab === activeTab);
  const pageTitle  = activeItem?.label ?? TAB_LABELS[activeTab] ?? '';

  return (
    <header
      className="sticky top-0 z-20 w-full flex items-center justify-between"
      style={{
        height: '56px',
        padding: '0 20px',
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* ── Left: Page Title ── */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {pageTitle && (
          <h1
            className="font-sans font-semibold tracking-tight select-none truncate"
            style={{
              fontSize: '15px',
              color: 'var(--fg)',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            {pageTitle}
          </h1>
        )}
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Search / Command Palette */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2.5 rounded-lg transition-all duration-150 cursor-pointer"
          style={{
            padding: '7px 12px',
            color: 'var(--fg-3)',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
            fontWeight: '500',
            minHeight: '34px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color        = 'var(--fg)';
            e.currentTarget.style.borderColor  = 'var(--fg-3)';
            e.currentTarget.style.background   = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color        = 'var(--fg-3)';
            e.currentTarget.style.borderColor  = 'var(--border)';
            e.currentTarget.style.background   = 'var(--bg-subtle)';
          }}
          aria-label="Open command palette"
        >
          <Search className="w-[15px] h-[15px] flex-shrink-0" strokeWidth={2} />
          <span className="hidden sm:inline whitespace-nowrap">Search</span>

          {/* Keyboard shortcut hint */}
          <div
            className="hidden md:flex items-center gap-0.5 ml-1"
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg-3)',
              fontWeight: '600',
            }}
          >
            <kbd
              className="flex items-center justify-center rounded"
              style={{
                minWidth: '17px',
                height: '17px',
                padding: '0 3px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontSize: '10px',
              }}
            >
              ⌘
            </kbd>
            <kbd
              className="flex items-center justify-center rounded"
              style={{
                minWidth: '17px',
                height: '17px',
                padding: '0 3px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                fontSize: '10px',
              }}
            >
              K
            </kbd>
          </div>
        </button>

        {/* Separator */}
        <div
          className="w-px h-5 mx-0.5"
          style={{ background: 'var(--border)' }}
          aria-hidden="true"
        />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer"
          style={{
            width: '34px',
            height: '34px',
            color: 'var(--fg-3)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color      = 'var(--fg)';
            e.currentTarget.style.background = 'var(--bg-subtle)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color      = 'var(--fg-3)';
            e.currentTarget.style.background = 'transparent';
          }}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? (
            <Sun className="w-[17px] h-[17px]" strokeWidth={2} />
          ) : (
            <Moon className="w-[17px] h-[17px]" strokeWidth={2} />
          )}
        </button>

        {/* Settings — visible on desktop so users have a quick path without avatar */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="hidden sm:flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer"
            style={{
              width: '34px',
              height: '34px',
              color: 'var(--fg-3)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color      = 'var(--fg)';
              e.currentTarget.style.background = 'var(--bg-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color      = 'var(--fg-3)';
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label="Open settings"
            title="Settings"
          >
            <Settings className="w-[17px] h-[17px]" strokeWidth={2} />
          </button>
        )}
      </div>
    </header>
  );
}