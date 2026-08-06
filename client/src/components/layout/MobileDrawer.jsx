import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Settings, ChevronRight } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { Avatar } from '../ui/Avatar';

export function MobileNav({ activeTab, setActiveTab, user, onLogout }) {
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  const role  = user?.role ?? 'student';
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student;

  const name  = user?.username || user?.full_name || 'User';
  const email = user?.email ?? '';

  // Close sheet on back-gesture / popstate (Android back button support)
  useEffect(() => {
    if (!accountSheetOpen) return;
    const handlePop = () => setAccountSheetOpen(false);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [accountSheetOpen]);

  return (
    <>
      {/* ── Bottom Tab Bar ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40"
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
        aria-label="Mobile navigation"
      >
        <div
          className="flex items-stretch justify-around"
          style={{ height: '56px', padding: '0 4px' }}
        >
          {items.map((item) => {
            const Icon     = item.icon;
            const isActive = activeTab === item.tab;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.tab)}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center justify-center flex-1 cursor-pointer transition-all duration-200"
                style={{
                  color: isActive ? 'var(--fg)' : 'var(--fg-3)',
                  borderRadius: '8px',
                  padding: '6px 4px',
                  gap: '3px',
                  outline: 'none',
                  minWidth: 0,
                }}
              >
                <div
                  className="flex items-center justify-center transition-transform duration-200"
                  style={{
                    width: '22px',
                    height: '22px',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    strokeWidth={isActive ? 2.25 : 1.8}
                  />
                </div>
                <span
                  className="text-[10px] font-semibold leading-tight truncate w-full text-center"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '-0.2px',
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Account Tab */}
          <button
            onClick={() => setAccountSheetOpen(true)}
            aria-label="Open account menu"
            className="flex flex-col items-center justify-center flex-1 cursor-pointer transition-all duration-200"
            style={{
              color: 'var(--fg-3)',
              borderRadius: '8px',
              padding: '6px 4px',
              gap: '3px',
              outline: 'none',
              minWidth: 0,
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{ width: '22px', height: '22px' }}
            >
              <Avatar
                name={name}
                size="xs"
                className="flex-shrink-0"
                style={{ width: '20px', height: '20px', fontSize: '9px' }}
              />
            </div>
            <span
              className="text-[10px] font-semibold leading-tight"
              style={{
                fontFamily: 'var(--font-sans)',
                letterSpacing: '-0.2px',
                color: 'var(--fg-3)',
              }}
            >
              Account
            </span>
          </button>
        </div>
      </nav>

      {/* ── Account Bottom Sheet ── */}
      <AnimatePresence>
        {accountSheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
              onClick={() => setAccountSheetOpen(false)}
              aria-hidden="true"
            />

            {/* Bottom Sheet */}
            <motion.div
              key="mobile-account-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl md:hidden flex flex-col"
              style={{
                background: 'var(--bg-surface)',
                borderTop: '1px solid var(--border)',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
                maxHeight: 'min(90svh, 520px)',
                paddingBottom: 'env(safe-area-inset-bottom, 12px)',
              }}
              aria-label="Account menu"
              role="dialog"
              aria-modal="true"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0" aria-hidden="true">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ background: 'var(--border-hover, var(--border))' }}
                />
              </div>

              {/* Header Row */}
              <div
                className="flex items-center justify-between flex-shrink-0"
                style={{ padding: '8px 20px 12px' }}
              >
                <span
                  className="text-[15px] font-semibold"
                  style={{
                    color: 'var(--fg)',
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Account
                </span>
                <button
                  onClick={() => setAccountSheetOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors duration-150 flex-shrink-0"
                  style={{ color: 'var(--fg-3)', background: 'transparent', outline: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  aria-label="Close account menu"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'var(--border)', flexShrink: 0 }} />

              {/* Scrollable content */}
              <div
                className="flex-1 overflow-y-auto"
                style={{ overscrollBehavior: 'contain' }}
              >
                {/* User Info */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={name}
                      size="md"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{
                          color: 'var(--fg)',
                          fontFamily: 'var(--font-sans)',
                          letterSpacing: '-0.2px',
                        }}
                      >
                        {name}
                      </p>
                      {email && (
                        <p
                          className="text-xs truncate mt-0.5"
                          style={{
                            color: 'var(--fg-3)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {email}
                        </p>
                      )}
                      <div
                        className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md"
                        style={{
                          background: 'var(--bg-hover)',
                          color: 'var(--fg-3)',
                          border: '1px solid var(--border)',
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {user?.role || 'student'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div
                  className="flex flex-col"
                  style={{ padding: '10px 12px', gap: '4px' }}
                >
                  {/* Settings */}
                  <button
                    onClick={() => {
                      setAccountSheetOpen(false);
                      // Tiny delay so the sheet can start closing before modal opens
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('open-settings'));
                      }, 80);
                    }}
                    className="flex items-center justify-between w-full rounded-lg cursor-pointer transition-all duration-150 active:scale-[0.98]"
                    style={{
                      padding: '12px 16px',
                      color: 'var(--fg-2)',
                      fontSize: '14px',
                      fontFamily: 'var(--font-sans)',
                      background: 'transparent',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.color      = 'var(--fg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color      = 'var(--fg-2)';
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Settings
                        className="w-4 h-4 flex-shrink-0"
                        strokeWidth={2}
                        style={{ color: 'var(--fg-3)' }}
                      />
                      <span className="font-medium">Settings</span>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0"
                      strokeWidth={2}
                      style={{ color: 'var(--fg-3)' }}
                    />
                  </button>

                  {/* Sign Out */}
                  <button
                    onClick={() => {
                      setAccountSheetOpen(false);
                      onLogout?.();
                    }}
                    className="flex items-center justify-between w-full rounded-lg cursor-pointer transition-all duration-150 active:scale-[0.98]"
                    style={{
                      padding: '12px 16px',
                      color: 'var(--error)',
                      fontSize: '14px',
                      fontFamily: 'var(--font-sans)',
                      background: 'transparent',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--error-dim, rgba(255, 59, 48, 0.08))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <LogOut
                        className="w-4 h-4 flex-shrink-0"
                        strokeWidth={2}
                      />
                      <span className="font-medium">Sign out</span>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0"
                      strokeWidth={2}
                      style={{ color: 'var(--error)' }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function MobileDrawer() {
  return null;
}