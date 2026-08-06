import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileDrawer';
import { TopNav } from './TopNav';
import { CommandPalette } from './CommandPalette';
import { SettingsModal } from './SettingsModal';

// These MUST match the actual rendered widths in Sidebar.jsx
const SIDEBAR_COLLAPSED_WIDTH = 68;  // px — matches `isCollapsed ? 68 : 240` in Sidebar
const SIDEBAR_EXPANDED_WIDTH  = 240; // px — matches `isCollapsed ? 68 : 240` in Sidebar
const MOBILE_NAV_HEIGHT       = 56;  // px — matches MobileNav h-16 (64px) minus top border

const FULL_HEIGHT_TABS = new Set([
  'assistant',
  'ask',
  'documents',
  'sources',
  'notebook',
]);

export function AppShell({
  children,
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onUpdateUser,
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCommandOpen, setIsCommandOpen]       = useState(false);
  const [isSettingsOpen, setIsSettingsOpen]     = useState(false);
  const [isMobile, setIsMobile]                 = useState(false);

  // Responsive breakpoint detection
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      if (w < 1024) setSidebarCollapsed(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ⌘K command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Stable reference — useCallback ensures addEventListener/removeEventListener
  // always get the same function object, preventing listener accumulation on re-renders.
  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, [handleOpenSettings]);

  const isFullHeight = FULL_HEIGHT_TABS.has(activeTab);

  // Width offset for the fixed sidebar
  const sidebarWidth = isMobile
    ? 0
    : sidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH;

  const role = user?.role || 'student';
  const maxWidthClass =
    role === 'teacher'
      ? 'max-w-[1100px]'
      : role === 'admin'
        ? 'max-w-[1200px]'
        : 'max-w-[880px]';

  // Content padding responds to three tiers: mobile / tablet / desktop
  const contentPadding = isMobile
    ? '16px 16px'
    : window.innerWidth < 1024
      ? '24px 24px'
      : '32px 40px';

  return (
    // Outer shell: exactly viewport height, no scroll
    <div
      className="flex overflow-hidden"
      style={{
        height: '100dvh',
        background: 'var(--bg)',
        color: 'var(--fg)',
      }}
    >
      {/* Command palette — rendered outside layout flow to avoid z-index issues */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        setActiveTab={setActiveTab}
        user={user}
      />

      {/* Single SettingsModal instance — mounted/unmounted via AnimatePresence inside */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onLogout={() => {
          setIsSettingsOpen(false);
          onLogout?.();
        }}
        onUpdateUser={onUpdateUser}
      />

      {/* Desktop Sidebar — only rendered on md+ screens */}
      {!isMobile && (
        <Sidebar
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onLogout={onLogout}
        />
      )}

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onLogout={onLogout}
        />
      )}

      {/* Main column: offset by the fixed sidebar width */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{
          marginLeft: isMobile ? 0 : `${sidebarWidth}px`,
          transition: 'margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
          height: '100dvh',
        }}
      >
        {/* Top Nav — fixed height, never shrinks */}
        <div className="flex-shrink-0">
          <TopNav
            activeTab={activeTab}
            user={user}
            onOpenCommandPalette={() => setIsCommandOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        {/* Content area */}
        {isFullHeight ? (
          // Full-height tabs: fill all remaining space, no scroll on this wrapper
          <main
            className="flex-1 flex flex-col overflow-hidden min-h-0"
            style={{
              paddingBottom: isMobile ? `${MOBILE_NAV_HEIGHT}px` : 0,
            }}
          >
            {children}
          </main>
        ) : (
          // Scrollable content tabs
          <main
            className="flex-1 overflow-y-auto"
            style={{
              paddingBottom: isMobile
                ? `${MOBILE_NAV_HEIGHT + 24}px`
                : '48px',
            }}
          >
            <div
              className={`w-full ${maxWidthClass} mx-auto`}
              style={{ padding: contentPadding }}
            >
              {children}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export function StudentLayout(props) {
  return <AppShell {...props} />;
}

export function TeacherLayout(props) {
  return <AppShell {...props} />;
}

export function AdminLayout(props) {
  return <AppShell {...props} />;
}

export function Layout({
  children,
  activeTab: externalActiveTab,
  setActiveTab: externalSetActiveTab,
  user,
  onLogout,
}) {
  const [localTab, setLocalTab] = useState('assistant');
  const activeTab   = externalActiveTab   ?? localTab;
  const setActiveTab = externalSetActiveTab ?? setLocalTab;

  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={user}
      onLogout={onLogout}
    >
      {children}
    </AppShell>
  );
}