import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const sizes = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-xl',
  xl:   'max-w-2xl',
  '2xl':'max-w-4xl',
  full: 'max-w-full m-4',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="fixed inset-0 cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
          />

          {/* Panel */}
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={[
              'relative w-full rounded-md flex flex-col z-10 max-h-[88vh]',
              'overflow-hidden',
              sizes[size] ?? sizes.md,
              className,
            ].join(' ')}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-xl)',
              color: 'var(--fg)',
            }}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div
                className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {title && (
                  <h3
                    className="font-sans text-[14px] font-semibold tracking-tight"
                    style={{ color: 'var(--fg)' }}
                  >
                    {title}
                  </h3>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150 cursor-pointer ml-auto"
                    style={{ color: 'var(--fg-3)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                      e.currentTarget.style.color = 'var(--fg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--fg-3)';
                    }}
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div
              className="overflow-y-auto flex-1 font-sans text-[14px] leading-relaxed"
              style={{ color: 'var(--fg-2)' }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ModalFooter({ children, className = '' }) {
  return (
    <div
      className={`flex items-center justify-end gap-2.5 px-6 py-4 flex-shrink-0 ${className}`}
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
      }}
    >
      {children}
    </div>
  );
}
