import React, { createContext, useContext, useState, useCallback } from 'react';
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

  const api = {
    success: useCallback((m, d) => add(m, 'success', d), [add]),
    error:   useCallback((m, d) => add(m, 'error',   d), [add]),
    warning: useCallback((m, d) => add(m, 'warning', d), [add]),
    info:    useCallback((m, d) => add(m, 'info',    d), [add]),
    add, remove,
  };

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
      aria-live="polite"
      className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-full max-w-[320px] pointer-events-none"
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
  success: {
    icon: <CheckCircle2 className="w-4 h-4 flex-shrink-0" />,
    iconColor: 'var(--success)',
    borderColor: 'var(--success-dim)',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4 flex-shrink-0" />,
    iconColor: 'var(--error)',
    borderColor: 'var(--error-dim)',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 flex-shrink-0" />,
    iconColor: 'var(--warning)',
    borderColor: 'var(--warning-dim)',
  },
  info: {
    icon: <Info className="w-4 h-4 flex-shrink-0" />,
    iconColor: 'var(--fg-3)',
    borderColor: 'var(--border)',
  },
};

function ToastItem({ toast, onClose }) {
  const config = toastConfig[toast.type] ?? toastConfig.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, y: 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-md"
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${config.borderColor}`,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <span style={{ color: config.iconColor, marginTop: '1px' }}>
        {config.icon}
      </span>
      <p
        className="flex-1 font-sans text-[13px] font-medium leading-snug"
        style={{ color: 'var(--fg)' }}
      >
        {toast.message}
      </p>
      <button
        onClick={onClose}
        className="flex-shrink-0 rounded-md p-0.5 transition-colors duration-150 cursor-pointer"
        style={{ color: 'var(--fg-3)' }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
