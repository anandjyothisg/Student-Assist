import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, LogOut, Settings, X } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { Avatar } from '../ui/Avatar';

function NavItem({ item, isActive, collapsed, onClick }) {
  const Icon = item.icon;

  return (
    <button
      onClick={() => onClick(item)}
      title={collapsed ? item.label : undefined}
      className="w-full flex items-center rounded-md text-left relative transition-all duration-150 cursor-pointer select-none"
      style={{
        gap: collapsed ? 0 : '10px',
        padding: collapsed ? '8px 0' : '8px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: isActive ? 'var(--fg)' : 'var(--fg-3)',
        background: isActive ? 'var(--bg-hover)' : 'transparent',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        fontWeight: isActive ? '500' : '400',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--fg-2)';
          e.currentTarget.style.background = 'var(--bg-subtle)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--fg-3)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {/* Active indicator bar */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-bar"
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
          style={{
            left: collapsed ? '4px' : '2px',
            background: 'var(--accent)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}

      <Icon
        className="flex-shrink-0 transition-none"
        style={{
          width: '15px',
          height: '15px',
          color: isActive ? 'var(--fg)' : 'var(--fg-3)',
        }}
        strokeWidth={isActive ? 2 : 1.75}
      />

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.12 }}
            className="truncate whitespace-nowrap overflow-hidden block"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function AccountPanel({ open, onClose, user, onLogout }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={ref}
            initial={{ x: -288, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -288, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative z-10 flex flex-col"
            style={{
              width: '288px',
              height: '100%',
              background: 'var(--bg-surface)',
              borderRight: '1px solid var(--border)',
              boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 h-14 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span
                className="text-[11px] font-medium uppercase tracking-widest"
                style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
              >
                Account
              </span>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors"
                style={{ color: 'var(--fg-3)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--fg)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-3)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* User Info */}
            <div className="px-5 py-6 flex items-center gap-3.5 flex-shrink-0">
              <Avatar
                name={user?.username || user?.email}
                src={user?.avatar}
                size="lg"
              />
              <div className="flex flex-col min-w-0 gap-0.5">
                <span
                  className="text-[14px] font-semibold truncate"
                  style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
                >
                  {user?.username || 'User'}
                </span>
                <span
                  className="text-[12px] truncate"
                  style={{
                    color: 'var(--fg-3)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {user?.email || ''}
                </span>
                <span
                  className="mt-1 text-[10px] font-medium uppercase tracking-wider w-fit px-2 py-0.5 rounded-md"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--fg-3)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {user?.role || 'student'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div
              className="flex-1 px-3 py-2"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('open-settings'));
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer"
                style={{
                  color: 'var(--fg-2)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--fg)';
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-2)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Settings
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: 'var(--fg-3)' }}
                />
                <span>Settings</span>
              </button>
            </div>

            {/* Logout */}
            <div
              className="p-3 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
                style={{
                  color: 'var(--error)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--error-dim)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">Sign out</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Sidebar({
  isCollapsed,
  setIsCollapsed,
  activeTab,
  setActiveTab,
  user,
  onLogout,
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const role = user?.role ?? 'student';
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student;
  const width = isCollapsed ? 56 : 220;

  return (
    <>
      <aside
        className="fixed top-0 left-0 h-full z-30 flex-col md:flex hidden"
        style={{
          width: `${width}px`,
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          transition: 'width 200ms ease-out',
          display: undefined, // let md:flex override
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center flex-shrink-0 overflow-hidden"
          style={{
            height: '56px',
            padding: isCollapsed ? '0 14px' : '0 14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex-shrink-0 rounded-lg flex items-center justify-center cursor-default"
              style={{
                width: '28px',
                height: '28px',
                background: 'var(--fg)',
                color: 'var(--bg)',
                fontFamily: 'var(--font-serif)',
                fontSize: '14px',
              }}
            >
              A
            </div>

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.12 }}
                  className="font-sans font-medium tracking-tight whitespace-nowrap text-[14px]"
                  style={{ color: 'var(--fg)' }}
                >
                  AuraStudy
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Nav */}
        <nav
          className="flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden"
          style={{
            flex: 1,
            padding: '8px',
            minHeight: 0,
          }}
        >
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

        {/* Bottom */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            borderTop: '1px solid var(--border)',
            padding: '8px',
            gap: '4px',
          }}
        >
          {/* Account button */}
          <button
            onClick={() => setAccountOpen(true)}
            title={isCollapsed ? user?.username || 'Account' : undefined}
            className="w-full flex items-center rounded-lg transition-all cursor-pointer overflow-hidden"
            style={{
              gap: isCollapsed ? 0 : '10px',
              padding: isCollapsed ? '8px 0' : '8px 10px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              color: 'var(--fg-2)',
              minHeight: '40px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Avatar
              name={user?.username || user?.email}
              src={user?.avatar}
              size="sm"
              className="flex-shrink-0"
            />

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.12 }}
                  className="flex flex-col min-w-0 overflow-hidden"
                >
                  <span
                    className="text-[13px] font-medium truncate whitespace-nowrap"
                    style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
                  >
                    {user?.username || 'User'}
                  </span>
                  <span
                    className="text-[10px] truncate whitespace-nowrap uppercase tracking-wider"
                    style={{
                      color: 'var(--fg-3)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {user?.role || 'student'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{
              color: 'var(--fg-3)',
              padding: '6px 0',
              minHeight: '32px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg-2)';
              e.currentTarget.style.background = 'var(--bg-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-3)';
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      <AccountPanel
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        user={user}
        onLogout={onLogout}
      />
    </>
  );
}