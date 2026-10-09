import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
  }, [remove]);

  const api = useMemo(() => ({
    success: (m, d) => add(m, 'success', d),
    error:   (m, d) => add(m, 'error', d),
    warning: (m, d) => add(m, 'warning', d),
    info:    (m, d) => add(m, 'info', d),
    add, remove,
  }), [add, remove]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}

function ToastContainer({ toasts, onClose }) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[calc(var(--header-h)+0.75rem+env(safe-area-inset-top,0px))] flex flex-col items-center gap-2 md:inset-x-auto md:top-auto md:right-5 md:bottom-5 md:flex-col-reverse md:items-end"
      style={{ zIndex: 'var(--z-toast)' }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => onClose(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const toastConfig = {
  success: { Icon: CheckCircle2, tone: 'text-success' },
  error:   { Icon: AlertCircle,  tone: 'text-error' },
  warning: { Icon: AlertTriangle, tone: 'text-warning' },
  info:    { Icon: Info,         tone: 'text-fg-3' },
};

function ToastItem({ toast, onClose }) {
  const { Icon, tone } = toastConfig[toast.type] ?? toastConfig.info;

  return (
    <motion.div
      layout
      role={toast.type === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface py-3 pr-2.5 pl-3.5 shadow-lg"
    >
      <Icon className={`mt-px size-4 shrink-0 ${tone}`} aria-hidden />
      <p className="flex-1 text-[13px] font-medium leading-snug text-fg">{toast.message}</p>
      <button
        onClick={onClose}
        className="-my-1 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-3 transition-colors hover:bg-subtle hover:text-fg"
        aria-label="Dismiss notification"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}
