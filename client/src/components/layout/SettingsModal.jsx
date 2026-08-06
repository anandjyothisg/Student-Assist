import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';

export function SettingsModal({ isOpen, onClose, user, onLogout, onUpdateUser }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    // AnimatePresence is the single source of truth for open/close —
    // no redundant `if (!isOpen) return null` guard needed here.
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* ── Modal Container ── */}
          <motion.div
            key="settings-modal"
            initial={isMobile ? { y: '100%' } : { scale: 0.96, opacity: 0, y: '-48%' }}
            animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1, y: '-50%' }}
            exit={isMobile ? { y: '100%' } : { scale: 0.96, opacity: 0, y: '-48%' }}
            transition={{
              duration: isMobile ? 0.26 : 0.22,
              ease: isMobile ? [0.16, 1, 0.3, 1] : [0.4, 0, 0.2, 1],
            }}
            className={`fixed z-50 flex flex-col ${
              isMobile
                ? 'bottom-0 inset-x-0 rounded-t-2xl'
                : 'left-1/2 top-1/2 -translate-x-1/2 rounded-xl'
            }`}
            style={{
              // Desktop: responsive width, fixed transform origin
              width: isMobile ? '100%' : 'min(92vw, 920px)',
              // Height: let content drive it, cap with max-height
              height: isMobile ? 'min(92svh, 680px)' : 'auto',
              maxHeight: isMobile ? 'min(92svh, 680px)' : 'min(88vh, 720px)',
              // Safe-area padding for notched phones
              paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : '0px',
              boxShadow: 'var(--shadow-xl)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              transformOrigin: isMobile ? 'bottom center' : 'center center',
              overflow: 'hidden',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            {/* ── Mobile Header (drag handle + title + close) ── */}
            {isMobile && (
              <div
                className="flex items-center justify-between flex-shrink-0 relative"
                style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}
              >
                {/* Drag Handle */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-2.5"
                  aria-hidden="true"
                >
                  <div
                    className="w-10 h-1 rounded-full"
                    style={{ background: 'var(--border-hover, var(--border))' }}
                  />
                </div>

                <span
                  className="text-[15px] font-semibold"
                  style={{
                    color: 'var(--fg)',
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Settings
                </span>

                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors duration-150 flex-shrink-0"
                  style={{ color: 'var(--fg-3)', background: 'transparent', outline: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
            )}

            {/* ── Desktop Header (title + close) ── */}
            {!isMobile && (
              <div
                className="flex items-center justify-between flex-shrink-0"
                style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}
              >
                <span
                  className="text-[17px] font-semibold"
                  style={{
                    color: 'var(--fg)',
                    fontFamily: 'var(--font-sans)',
                    letterSpacing: '-0.4px',
                  }}
                >
                  Settings
                </span>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors duration-150 flex-shrink-0"
                  style={{ color: 'var(--fg-3)', background: 'transparent', outline: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
            )}

            {/* ── Settings Panel (fills remaining space, scrolls internally) ── */}
            <div className="flex-1 overflow-hidden min-h-0">
              <SettingsPanel
                user={user}
                onLogout={onLogout}
                onUpdateUser={onUpdateUser}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}