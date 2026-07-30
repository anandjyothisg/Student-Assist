import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileDrawer';
import { TopNav } from './TopNav';
import { CommandPalette } from './CommandPalette';

export function AppShell({
  children,
  activeTab,
  setActiveTab,
  user,
  onLogout,
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarCollapsed(window.innerWidth < 1024);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  const isFullHeightTab = ['assistant', 'ask', 'documents', 'sources', 'notebook'].includes(activeTab);
  const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 56 : 220);

  const role = user?.role || 'student';
  const maxWidthClass = role === 'teacher'
    ? 'max-w-[1100px]'
    : role === 'admin'
    ? 'max-w-[1200px]'
    : 'max-w-[880px]';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        setActiveTab={setActiveTab}
        user={user}
      />

      {/* Desktop sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={onLogout}
      />

      {/* Mobile bottom nav */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={onLogout}
      />

      {/* Main content area */}
      <div
        className="flex flex-col min-h-screen transition-[padding-left] duration-200 ease-out"
        style={{ paddingLeft: `${sidebarWidth}px` }}
      >
        <TopNav
          onMenuOpen={null}
          activeTab={activeTab}
          user={user}
          onOpenCommandPalette={() => setIsCommandOpen(true)}
        />

        {isFullHeightTab ? (
          <main
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {children}
          </main>
        ) : (
          <main
            className={`flex-1 w-full ${maxWidthClass} mx-auto px-6 sm:px-8 py-8 pb-24 md:pb-12`}
          >
            {children}
          </main>
        )}
      </div>
    </div>
  );
}

export function StudentLayout(props) { return <AppShell {...props} />; }
export function TeacherLayout(props) { return <AppShell {...props} />; }
export function AdminLayout(props)   { return <AppShell {...props} />; }

export function Layout({
  children,
  activeTab: externalActiveTab,
  setActiveTab: externalSetActiveTab,
  user,
  onLogout,
}) {
  const [localTab, setLocalTab] = useState('assistant');
  const activeTab    = externalActiveTab    ?? localTab;
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
