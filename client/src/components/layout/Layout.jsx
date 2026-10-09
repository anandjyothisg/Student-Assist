import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileDrawer';
import { TopNav } from './TopNav';
import { CommandPalette } from './CommandPalette';
import { SettingsModal } from './SettingsModal';
import { useMediaQuery } from '../ui/useMediaQuery';

/** Screens that manage their own height/scroll (chat, split-pane viewer). */
const FULL_HEIGHT_TABS = new Set(['assistant', 'documents']);

const SIDEBAR_PREF_KEY = 'sidebar-collapsed';

export function AppShell({ children, activeTab, setActiveTab, user, onLogout, onUpdateUser }) {
  const isMobile = useMediaQuery('(max-width: 767.98px)');
  const isTablet = useMediaQuery('(max-width: 1023.98px)');
  const [userCollapsed, setUserCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_PREF_KEY) === '1'; } catch { return false; }
  });
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const collapsed = isTablet || userCollapsed;
  const toggleSidebar = () => {
    setUserCollapsed((v) => {
      try { localStorage.setItem(SIDEBAR_PREF_KEY, v ? '0' : '1'); } catch { /* ignore */ }
      return !v;
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const closeCommand = useCallback(() => setIsCommandOpen(false), []);

  useEffect(() => {
    window.addEventListener('open-settings', openSettings);
    return () => window.removeEventListener('open-settings', openSettings);
  }, [openSettings]);

  const isFullHeight = FULL_HEIGHT_TABS.has(activeTab);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-sm focus:text-canvas"
        style={{ zIndex: 'var(--z-toast)' }}
      >
        Skip to content
      </a>

      <CommandPalette
        isOpen={isCommandOpen}
        onClose={closeCommand}
        setActiveTab={setActiveTab}
        user={user}
        onOpenSettings={openSettings}
        onLogout={onLogout}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        user={user}
        onLogout={() => { setIsSettingsOpen(false); onLogout?.(); }}
        onUpdateUser={onUpdateUser}
      />

      {!isMobile && (
        <Sidebar
          isCollapsed={collapsed}
          canToggle={!isTablet}
          onToggle={toggleSidebar}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onLogout={onLogout}
          onOpenSettings={openSettings}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopNav
          activeTab={activeTab}
          user={user}
          onOpenCommandPalette={() => setIsCommandOpen(true)}
          onOpenSettings={openSettings}
        />

        {isFullHeight ? (
          <main id="main" tabIndex={-1} className={`flex min-h-0 flex-1 flex-col overflow-hidden outline-none ${isMobile ? 'mobile-safe-bottom' : ''}`}>
            {children}
          </main>
        ) : (
          <main id="main" tabIndex={-1} className={`min-h-0 flex-1 overflow-y-auto outline-none ${isMobile ? 'mobile-safe-bottom' : ''}`}>
            <div className="mx-auto w-full max-w-[1160px] px-4 pt-6 pb-12 sm:px-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10">
              {children}
            </div>
          </main>
        )}
      </div>

      {isMobile && (
        <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onLogout={onLogout}
          onOpenSettings={openSettings}
        />
      )}
    </div>
  );
}

/** Wrapper used by App — forwards every prop (including onUpdateUser) to the shell. */
export function Layout(props) {
  return <AppShell {...props} />;
}

export const StudentLayout = AppShell;
export const TeacherLayout = AppShell;
export const AdminLayout = AppShell;
