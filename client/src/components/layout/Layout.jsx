import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileDrawer';
import { TopNav } from './TopNav';
import { CommandPalette } from './CommandPalette';

const TOPNAV_HEIGHT = 48; // px — must match TopNav's actual height
const MOBILE_NAV_HEIGHT = 56; // px — must match MobileNav's actual height

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
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
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

  const isFullHeight = FULL_HEIGHT_TABS.has(activeTab);
  const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? 56 : 220;

  const role = user?.role || 'student';
  const maxWidthClass =
    role === 'teacher'
      ? 'max-w-[1100px]'
      : role === 'admin'
        ? 'max-w-[1200px]'
        : 'max-w-[880px]';

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
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        setActiveTab={setActiveTab}
        user={user}
      />

      {/* Desktop Sidebar — rendered but hidden via CSS on mobile */}
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

      {/* Main column: sits to the right of sidebar */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{
          // Sidebar is fixed, so we offset with marginLeft
          marginLeft: isMobile ? 0 : `${sidebarWidth}px`,
          transition: 'margin-left 200ms ease-out',
          height: '100dvh',
        }}
      >
        {/* Top Nav — fixed height, never shrinks */}
        <div className="flex-shrink-0">
          <TopNav
            onMenuOpen={null}
            activeTab={activeTab}
            user={user}
            onOpenCommandPalette={() => setIsCommandOpen(true)}
          />
        </div>

        {/* Content area */}
        {isFullHeight ? (
          // Full-height tabs: fill all remaining space, no scroll on this wrapper
          <main
            className="flex-1 flex flex-col overflow-hidden min-h-0"
            style={{
              // On mobile, leave room for bottom nav
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
              // On mobile, leave room for bottom nav
              paddingBottom: isMobile
                ? `${MOBILE_NAV_HEIGHT + 24}px`
                : '48px',
            }}
          >
            <div
              className={`w-full ${maxWidthClass} mx-auto`}
              style={{
                padding: isMobile ? '20px 16px' : '32px 32px',
              }}
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
  const activeTab = externalActiveTab ?? localTab;
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