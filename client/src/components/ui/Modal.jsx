import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { useIsMobile } from './useMediaQuery';
import { useOverlay } from './useOverlay';

const sizes = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-xl',
  xl: 'md:max-w-2xl',
  '2xl': 'md:max-w-4xl',
};

/**
 * Modal — centred dialog on desktop, bottom sheet on phones.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className = '',
  closeOnOverlayClick = true,
  showCloseButton = true,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const isMobile = useIsMobile();
  useOverlay(isOpen, onClose, panelRef);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-end justify-center md:items-center md:p-6" style={{ zIndex: 'var(--z-modal)' }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.98, y: 8 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: isMobile ? 0.28 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={[
              'relative flex w-full flex-col overflow-hidden border border-border bg-surface text-fg shadow-xl outline-none',
              'max-h-[92dvh] rounded-t-xl md:max-h-[86dvh] md:rounded-xl',
              sizes[size] ?? sizes.md,
              className,
            ].join(' ')}
          >
            {isMobile && <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong" />}
            {(title || showCloseButton) && (
              <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3 md:px-6 md:pt-5">
                <div className="min-w-0">
                  {title && <h2 id={titleId} className="text-base font-semibold tracking-tight text-fg">{title}</h2>}
                  {description && <p id={descId} className="mt-1 text-[13px] text-fg-3">{description}</p>}
                </div>
                {showCloseButton && <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-1.5 -mt-1" />}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 md:px-6 md:pb-6">{children}</div>
            {footer && <ModalFooter>{footer}</ModalFooter>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ModalFooter({ children, className = '' }) {
  return (
    <div
      className={`flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-subtle/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end md:px-6 pb-[max(0.875rem,env(safe-area-inset-bottom))] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Sheet — side panel on desktop (`side`), bottom sheet on phones.
 */
export function Sheet({ isOpen, onClose, title, children, side = 'right', width = 'md:w-[400px]', label }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const isMobile = useIsMobile();
  useOverlay(isOpen, onClose, panelRef);

  const from = isMobile ? { y: '100%' } : { x: side === 'right' ? '100%' : '-100%' };
  const to = isMobile ? { y: 0 } : { x: 0 };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0" style={{ zIndex: 'var(--z-drawer)' }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-[var(--overlay)]"
            aria-hidden
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={from}
            animate={to}
            exit={from}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={[
              'absolute flex flex-col overflow-hidden bg-surface text-fg shadow-xl outline-none',
              'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-t border-border',
              'md:inset-y-0 md:bottom-auto md:h-full md:max-h-none md:rounded-none md:border-t-0',
              side === 'right' ? 'md:right-0 md:left-auto md:border-l' : 'md:left-0 md:right-auto md:border-r',
              width,
            ].join(' ')}
          >
            {isMobile && <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong" />}
            {title && (
              <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
                <h2 id={titleId} className="truncate text-sm font-semibold">{title}</h2>
                <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-1.5" />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
