import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsUpDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { Avatar } from '../ui/Avatar';
import { Brand } from '../ui/BrandMark';
import { AccountMenu } from './AccountMenu';

function NavItem({ item, isActive, collapsed, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onClick(item)}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'group relative flex h-9 w-full items-center rounded-md text-[13.5px] transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
        collapsed ? 'justify-center' : 'gap-2.5 px-2.5',
        isActive ? 'bg-subtle font-semibold text-fg' : 'font-medium text-fg-3 hover:bg-subtle/70 hover:text-fg',
      ].join(' ')}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-active"
          aria-hidden
          className="absolute top-2 bottom-2 -left-2 w-[3px] rounded-r-full bg-accent"
          transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        />
      )}
      <Icon className={`size-[18px] shrink-0 ${isActive ? 'text-fg' : ''}`} strokeWidth={isActive ? 2.1 : 1.85} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}

function AccountPopover({ open, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label="Account"
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-full left-2 mb-2 w-[300px] origin-bottom-left overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          style={{ zIndex: 'var(--z-popover)' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Sidebar({ isCollapsed, canToggle, onToggle, activeTab, setActiveTab, user, onLogout, onOpenSettings }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const role = user?.role ?? 'student';
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student;

  return (
    <aside
      aria-label="Primary"
      className="relative hidden h-dvh shrink-0 flex-col border-r border-border bg-canvas transition-[width] duration-200 ease-out md:flex"
      style={{ width: isCollapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)', zIndex: 'var(--z-nav)' }}
    >
      <div className={`flex h-[var(--header-h)] shrink-0 items-center ${isCollapsed ? 'justify-center' : 'justify-between pr-2 pl-4'}`}>
        <Brand collapsed={isCollapsed} />
        {canToggle && !isCollapsed && (
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="inline-flex size-8 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-subtle hover:text-fg"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <nav className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pt-3 ${isCollapsed ? 'px-2.5' : 'px-3'}`}>
        {!isCollapsed && <p className="mb-1.5 px-2.5 text-[11px] font-medium text-fg-3">Workspace</p>}
        {items.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeTab === item.tab}
            collapsed={isCollapsed}
            onClick={(i) => setActiveTab(i.tab)}
          />
        ))}
      </nav>

      <div className={`relative flex shrink-0 flex-col gap-1 border-t border-border py-3 ${isCollapsed ? 'items-center px-2.5' : 'px-3'}`}>
        {canToggle && isCollapsed && (
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mb-1 inline-flex size-9 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-subtle hover:text-fg"
          >
            <PanelLeftOpen className="size-[18px]" />
          </button>
        )}
        <button
          onClick={() => setAccountOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={accountOpen}
          title={isCollapsed ? user?.username || 'Account' : undefined}
          className={[
            'flex items-center rounded-md transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent',
            isCollapsed ? 'size-10 justify-center' : 'w-full gap-2.5 px-2 py-1.5',
            accountOpen ? 'bg-subtle' : '',
          ].join(' ')}
        >
          <Avatar name={user?.username || user?.email} src={user?.avatar} size="sm" />
          {!isCollapsed && (
            <>
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-[13px] font-semibold leading-tight text-fg">{user?.username || 'Account'}</span>
                <span className="truncate text-xs capitalize leading-tight text-fg-3">{user?.role || 'student'}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-fg-3" aria-hidden />
            </>
          )}
        </button>
        <AccountPopover open={accountOpen} onClose={() => setAccountOpen(false)}>
          <AccountMenu user={user} onLogout={onLogout} onOpenSettings={onOpenSettings} onClose={() => setAccountOpen(false)} />
        </AccountPopover>
      </div>
    </aside>
  );
}
