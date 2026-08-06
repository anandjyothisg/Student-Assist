import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, LogOut, Settings, X, User } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { Avatar } from '../ui/Avatar';

function NavItem({ item, isActive, collapsed, onClick }) {
  const Icon = item.icon;

  return (
    <button
      onClick={() => onClick(item)}
      title={collapsed ? item.label : undefined}
      className="w-full flex items-center rounded-lg text-left relative transition-all duration-200 cursor-pointer select-none group"
      style={{
        gap: collapsed ? 0 : '12px',
        padding: collapsed ? '10px 12px' : '10px 14px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: isActive ? 'var(--fg)' : 'var(--fg-3)',
        background: isActive ? 'var(--bg-hover)' : 'transparent',
        fontFamily: 'var(--font-sans)',
        fontSize: '13.5px',
        fontWeight: isActive ? '500' : '400',
        minHeight: '42px',
        marginBottom: '2px',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--fg)';
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
          className="absolute top-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: '0px',
            width: '3px',
            height: '20px',
            background: 'var(--accent)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}

      {/* Icon wrapper */}
      <div 
        className="flex-shrink-0 flex items-center justify-center transition-transform duration-200"
        style={{
          width: '18px',
          height: '18px',
          marginLeft: collapsed ? '0' : '4px',
        }}
      >
        <Icon
          className="transition-none"
          style={{
            width: '18px',
            height: '18px',
            color: isActive ? 'var(--fg)' : 'var(--fg-3)',
          }}
          strokeWidth={isActive ? 2.25 : 2}
        />
      </div>

      {/* Label */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="truncate whitespace-nowrap overflow-hidden block"
            style={{ letterSpacing: '-0.01em' }}
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
            transition={{ duration: 0.2 }}
            className="absolute inset-0 cursor-pointer"
            style={{ 
              background: 'rgba(0, 0, 0, 0.5)', 
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
          />

          {/* Panel Container */}
          <motion.div
            ref={ref}
            initial={{ x: -360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -360, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative z-10 flex flex-col"
            style={{
              width: '360px',
              maxWidth: '90vw',
              height: '100%',
              background: 'var(--bg-surface)',
              borderRight: '1px solid var(--border)',
              boxShadow: '12px 0 48px rgba(0, 0, 0, 0.2)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between flex-shrink-0"
              style={{ 
                height: '72px',
                padding: '0 24px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--fg-2)',
                  }}
                >
                  <User className="w-4 h-4" strokeWidth={2} />
                </div>
                <span
                  className="text-[14px] font-semibold tracking-tight"
                  style={{ 
                    color: 'var(--fg)', 
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Account
                </span>
              </div>
              
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150"
                style={{ 
                  color: 'var(--fg-3)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--fg)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-3)';
                  e.currentTarget.style.background = 'transparent';
                }}
                aria-label="Close account panel"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
            </div>

            {/* User Profile Card */}
            <div 
              className="flex-shrink-0"
              style={{
                padding: '32px 24px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="flex items-start gap-4">
                <Avatar
                  name={user?.username || user?.email}
                  src={user?.avatar}
                  size="lg"
                  className="flex-shrink-0"
                  style={{
                    width: '56px',
                    height: '56px',
                    fontSize: '20px',
                  }}
                />
                
                <div className="flex flex-col min-w-0 flex-1 gap-2">
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[16px] font-semibold truncate leading-tight"
                      style={{ 
                        color: 'var(--fg)', 
                        fontFamily: 'var(--font-sans)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {user?.username || 'User'}
                    </span>
                    <span
                      className="text-[13px] truncate leading-tight"
                      style={{
                        color: 'var(--fg-3)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {user?.email || 'user@example.com'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider w-fit px-3 py-1.5 rounded-md"
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--bg)',
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {user?.role || 'student'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Section */}
            <div
              className="flex-1 flex flex-col"
              style={{ 
                padding: '20px 16px',
                gap: '8px',
              }}
            >
              {/* Settings Button */}
              <button
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('open-settings'));
                }}
                className="w-full flex items-center gap-4 rounded-xl text-left transition-all duration-150 cursor-pointer group"
                style={{
                  padding: '14px 16px',
                  color: 'var(--fg-2)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: '500',
                  background: 'transparent',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--fg)';
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-2)';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-150"
                  style={{
                    background: 'var(--bg-hover)',
                    color: 'var(--fg-3)',
                  }}
                >
                  <Settings className="w-[18px] h-[18px]" strokeWidth={2} />
                </div>
                
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="truncate">Settings & Preferences</span>
                  <span 
                    className="text-[11px] truncate"
                    style={{
                      color: 'var(--fg-3)',
                      fontWeight: '400',
                    }}
                  >
                    Manage your account
                  </span>
                </div>
              </button>
            </div>

            {/* Sign Out Section - Enhanced Design */}
            <div
              className="flex-shrink-0"
              style={{ 
                padding: '20px 16px 24px 16px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center gap-4 rounded-xl transition-all duration-200 cursor-pointer group"
                style={{
                  padding: '16px 18px',
                  background: 'var(--error)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: '600',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                  e.currentTarget.style.opacity = '0.92';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                  }}
                >
                  <LogOut className="w-[18px] h-[18px]" strokeWidth={2.5} />
                </div>
                
                <div className="flex flex-col gap-0.5 items-start min-w-0">
                  <span className="truncate">Sign out</span>
                  <span 
                    className="text-[11px] truncate"
                    style={{
                      color: 'rgba(255, 255, 255, 0.85)',
                      fontWeight: '400',
                    }}
                  >
                    End your session
                  </span>
                </div>
              </button>
              
              {/* Optional: Alternative minimal design - uncomment to use */}
              {/* <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-3 rounded-xl transition-all duration-200 cursor-pointer"
                style={{
                  padding: '14px 18px',
                  background: 'transparent',
                  color: 'var(--error)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: '600',
                  border: '2px solid var(--error)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--error)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--error)';
                }}
              >
                <LogOut className="w-[18px] h-[18px]" strokeWidth={2.5} />
                <span>Sign out</span>
              </button> */}
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
  const width = isCollapsed ? 68 : 240;

  return (
    <>
      <aside
        className="fixed top-0 left-0 h-full z-30 flex-col hidden md:flex"
        style={{
          width: `${width}px`,
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
          transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Logo Section */}
        <div
          className="flex items-center flex-shrink-0 overflow-hidden"
          style={{
            height: '64px',
            padding: isCollapsed ? '0 18px' : '0 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex-shrink-0 rounded-xl flex items-center justify-center cursor-default shadow-sm"
              style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, var(--fg) 0%, var(--fg-2) 100%)',
                color: 'var(--bg)',
                fontFamily: 'var(--font-serif)',
                fontSize: '15px',
                fontWeight: '600',
              }}
            >
              A
            </div>

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15, ease: 'easeInOut' }}
                  className="font-sans font-semibold tracking-tight whitespace-nowrap text-[15px]"
                  style={{ 
                    color: 'var(--fg)',
                    letterSpacing: '-0.02em'
                  }}
                >
                  AuraStudy
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation Section */}
        <nav
          className="flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar"
          style={{
            flex: 1,
            padding: isCollapsed ? '12px 8px' : '12px 12px',
            minHeight: 0,
            gap: '2px',
            overscrollBehavior: 'contain',
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

        {/* Bottom Section */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            borderTop: '1px solid var(--border)',
            padding: isCollapsed ? '12px 8px' : '12px 12px',
            gap: '8px',
          }}
        >
          {/* Account Button */}
          <button
            onClick={() => setAccountOpen(true)}
            title={isCollapsed ? user?.username || 'Account' : undefined}
            className="w-full flex items-center rounded-lg transition-all duration-200 cursor-pointer overflow-hidden group"
            style={{
              gap: isCollapsed ? 0 : '12px',
              padding: isCollapsed ? '10px 12px' : '10px 12px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              color: 'var(--fg-2)',
              minHeight: '48px',
              background: 'transparent',
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
                  transition={{ duration: 0.15, ease: 'easeInOut' }}
                  className="flex flex-col min-w-0 overflow-hidden gap-0.5"
                >
                  <span
                    className="text-[13px] font-semibold truncate whitespace-nowrap leading-tight"
                    style={{ 
                      color: 'var(--fg)', 
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    {user?.username || 'User'}
                  </span>
                  <span
                    className="text-[10.5px] truncate whitespace-nowrap uppercase tracking-wider leading-tight"
                    style={{
                      color: 'var(--fg-3)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '500',
                    }}
                  >
                    {user?.role || 'student'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer"
            style={{
              color: 'var(--fg-3)',
              padding: '8px 0',
              minHeight: '36px',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg)';
              e.currentTarget.style.background = 'var(--bg-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-3)';
              e.currentTarget.style.background = 'transparent';
            }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-[18px] h-[18px]" strokeWidth={2} />
            ) : (
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2} />
                <span 
                  className="text-[11px] font-medium uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  Collapse
                </span>
              </div>
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

      {/* Custom Scrollbar Styles — standard <style> tag (not Next.js jsx) */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--fg-3);
        }
      `}</style>
    </>
  );
}