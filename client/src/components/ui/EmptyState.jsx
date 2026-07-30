import React from 'react';
import { motion } from 'framer-motion';

/**
 * EmptyState — Blueprint spec:
 * - Centered, minimal. No illustration. No marketing copy.
 * - Icon (optional, monochrome). Title (Inter 15px semibold). Description (Inter 13px fg-muted).
 * - ONE action button maximum. Blueprint rule: no buttons that link away from current screen.
 * - Fade in at 180ms ease-out.
 *
 * Usage:
 *   <EmptyState
 *     icon={FileText}
 *     title="No documents yet"
 *     description="Upload the first file to let students ask questions about it."
 *     action={{ label: 'Upload a file', onClick: handleUpload }}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,           // { label: string, onClick: fn } — optional, max 1
  className = '',
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.0, 0, 0.2, 1] }}
      className={`flex flex-col items-center justify-center text-center px-6 py-12 gap-4 ${className}`}
    >
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-bg-subtle border border-border-base flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-fg-muted" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-w-xs">
        {title && (
          <h3 className="font-sans text-[15px] font-semibold text-fg-primary">
            {title}
          </h3>
        )}
        {description && (
          <p className="font-sans text-[13px] text-fg-muted leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className={[
            'mt-1 h-8 px-4 rounded-lg border border-border-base',
            'font-sans text-[13px] font-medium text-fg-secondary bg-bg-surface',
            'hover:border-[#6E56CF]/40 hover:text-[#6E56CF]',
            'transition-colors duration-150 cursor-pointer',
          ].join(' ')}
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
