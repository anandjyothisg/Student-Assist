import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';

/**
 * ErrorState — Blueprint spec:
 * - Calm, not alarming. Error color (#DC2626) on icon only.
 * - Title: fg-primary 15px semibold. Description: fg-muted 13px.
 * - ONE retry action maximum.
 * - Specialized variant for network errors.
 * - Fade in at 180ms ease-out.
 *
 * Usage:
 *   <ErrorState
 *     title="Something went wrong"
 *     description="Could not load your conversations."
 *     onRetry={refetch}
 *   />
 *
 *   <ErrorState variant="network" onRetry={refetch} />
 */
export function ErrorState({
  variant     = 'generic',  // 'generic' | 'network' | 'notfound' | 'permission'
  title,
  description,
  onRetry,
  className   = '',
}) {
  const defaults = {
    generic:    { icon: AlertCircle, title: 'Something went wrong',    desc: 'An unexpected error occurred. Please try again.' },
    network:    { icon: WifiOff,     title: 'No connection',            desc: 'Check your internet connection and try again.' },
    notfound:   { icon: AlertCircle, title: 'Not found',               desc: 'The resource you are looking for does not exist.' },
    permission: { icon: AlertCircle, title: 'Access denied',           desc: 'You do not have permission to view this content.' },
  };

  const config = defaults[variant] ?? defaults.generic;
  const Icon = config.icon;
  const resolvedTitle = title ?? config.title;
  const resolvedDesc  = description ?? config.desc;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.0, 0, 0.2, 1] }}
      className={`flex flex-col items-center justify-center text-center px-6 py-12 gap-4 ${className}`}
    >
      {/* Icon in error-tinted container */}
      <div className="w-10 h-10 rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/15 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-[#DC2626]" />
      </div>

      <div className="flex flex-col gap-1.5 max-w-xs">
        <h3 className="font-sans text-[15px] font-semibold text-fg-primary">
          {resolvedTitle}
        </h3>
        <p className="font-sans text-[13px] text-fg-muted leading-relaxed">
          {resolvedDesc}
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className={[
            'mt-1 inline-flex items-center gap-2 h-8 px-4 rounded-lg border border-border-base',
            'font-sans text-[13px] font-medium text-fg-secondary bg-bg-surface',
            'hover:border-fg-muted/40 hover:text-fg-primary',
            'transition-colors duration-150 cursor-pointer',
          ].join(' ')}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </motion.div>
  );
}
