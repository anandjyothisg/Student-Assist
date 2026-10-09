import React from 'react';
import { Search, Moon, Sun, Settings } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useTheme } from '../ui/Theme';
import { IconButton } from '../ui/Button';
import { BrandMark } from '../ui/BrandMark';

const TAB_TITLES = {
  assistant: 'Ask',
  documents: 'Sources',
  notebook: 'Notebook',
  academic: 'Content',
  analytics: 'Insights',
  dashboard: 'Status',
  accounts: 'Users',
  courses: 'Courses',
};

export function TopNav({ activeTab, user, onOpenCommandPalette, onOpenSettings }) {
  const { isDark, toggleTheme } = useTheme();
  const items = NAV_ITEMS[user?.role] ?? NAV_ITEMS.student;
  const title = items.find((i) => i.tab === activeTab)?.label ?? TAB_TITLES[activeTab] ?? '';
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

  return (
    <header
      className="sticky top-0 flex h-[var(--header-h)] w-full shrink-0 items-center justify-between gap-3 border-b border-border bg-canvas/90 px-4 backdrop-blur-md md:px-6"
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <BrandMark size={26} className="md:hidden" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[14px]">
          <span className="hidden capitalize text-fg-3 md:inline">{user?.role || 'Workspace'}</span>
          <span aria-hidden className="hidden text-border-strong md:inline">/</span>
          <span aria-current="page" className="truncate font-semibold tracking-[-0.01em] text-fg">{title}</span>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onOpenCommandPalette}
          aria-label="Search and jump to"
          className="group inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[13px] text-fg-3 transition-colors hover:border-border-strong hover:text-fg sm:w-56 sm:px-3"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden flex-1 text-left sm:inline">Search…</span>
          <span className="hidden items-center gap-0.5 sm:flex" aria-hidden>
            <kbd className="keycap">{isMac ? '⌘' : 'Ctrl'}</kbd>
            <kbd className="keycap">K</kbd>
          </span>
        </button>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <IconButton
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        />
        {onOpenSettings && (
          <span className="hidden md:contents">
            <IconButton icon={Settings} label="Settings" onClick={onOpenSettings} />
          </span>
        )}
      </div>
    </header>
  );
}
