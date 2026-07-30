import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Settings } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { Avatar } from '../ui/Avatar';

export function MobileNav({ activeTab, setActiveTab, user, onLogout }) {
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);

  const role  = user?.role ?? 'student';
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student;

  const name = user?.username || user?.full_name || 'User';
  const email = user?.email ?? '';

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40"
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
        }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-14 px-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.tab)}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1 flex-1 h-full cursor-pointer py-2 transition-colors"
                style={{
                  color: isActive ? 'var(--fg)' : 'var(--fg-3)',
                }}
              >
                <Icon
                  className="w-[18px] h-[18px]"
                  strokeWidth={isActive ? 2 : 1.75}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Account tab */}
          <button
            onClick={() => setAccountSheetOpen(true)}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full cursor-pointer py-2"
            style={{ color: 'var(--fg-3)' }}
          >
            <Avatar
              name={name}
              size="xs"
              className="flex-shrink-0"
            />
            <span
              className="text-[10px] font-medium"
              style={{ fontFamily: 'var(--font-sans)', color: 'var(--fg-3)' }}
            >
              Account
            </span>
          </button>
        </div>
      </nav>

      {/* Account Bottom Sheet */}
      <AnimatePresence>
        {accountSheetOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 md:hidden cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
              onClick={() => setAccountSheetOpen(false)}
            />

            <motion.div
              key="mobile-account-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-md pb-8 md:hidden"
              style={{
                background: 'var(--bg-surface)',
                borderTop: '1px solid var(--border)',
                boxShadow: 'var(--shadow-xl)',
              }}
              aria-label="Account panel"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div
                  className="w-8 h-1 rounded-full"
                  style={{ background: 'var(--border-hover)' }}
                />
              </div>

              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-2 mb-1"
              >
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
                >
                  Account
                </span>
                <button
                  onClick={() => setAccountSheetOpen(false)}
                  className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
                  style={{ color: 'var(--fg-3)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User info */}
              <div
                className="px-5 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <Avatar name={name} size="md" />
                <div className="min-w-0">
                  <p
                    className="text-[14px] font-semibold truncate"
                    style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
                  >
                    {name}
                  </p>
                  {email && (
                    <p
                      className="text-[12px] truncate mt-0.5"
                      style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                    >
                      {email}
                    </p>
                  )}
                  <span
                    className="mt-1.5 inline-block text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md"
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
              <div className="px-3 py-2">
                <button
                  onClick={() => {
                    setAccountSheetOpen(false);
                    window.dispatchEvent(new CustomEvent('open-settings'));
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer"
                  style={{
                    color: 'var(--fg-2)',
                    fontSize: '14px',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-subtle)';
                    e.currentTarget.style.color = 'var(--fg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--fg-2)';
                  }}
                >
                  <Settings className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--fg-3)' }} />
                  Settings
                </button>

                <button
                  onClick={() => {
                    setAccountSheetOpen(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer"
                  style={{
                    color: 'var(--error)',
                    fontSize: '14px',
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
                  Sign out
                </button>
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
