import React from 'react';
import { motion } from 'framer-motion';

/**
 * Loader — Blueprint motion rules:
 * - No flashy loading. No rotation for decorative purpose.
 * - Spinner: kept for explicit loading states inside buttons/forms.
 * - Dots: opacity-only fade, staggered, no Y bounce.
 * - Pulse: single circle, slow opacity only, no scale.
 *
 * Note: For AI response loading, use <AiThinkingLine /> instead.
 */
export function Loader({
  variant   = 'spinner',   // 'spinner' | 'dots' | 'pulse'
  size      = 'md',
  color     = 'accent',    // 'accent' | 'muted' | 'white'
  className = '',
  ...props
}) {
  const sizes = {
    sm: { box: 'w-4 h-4', dot: 'w-1.5 h-1.5' },
    md: { box: 'w-6 h-6', dot: 'w-2   h-2'   },
    lg: { box: 'w-8 h-8', dot: 'w-2.5 h-2.5' },
    xl: { box: 'w-12 h-12',dot:'w-3   h-3'   },
  };

  const colors = {
    accent: { stroke: 'text-[#6E56CF]',  dot: 'bg-[#6E56CF]'  },
    muted:  { stroke: 'text-fg-muted',   dot: 'bg-fg-muted'   },
    white:  { stroke: 'text-white',      dot: 'bg-white'      },
  };

  const sz  = sizes[size]  ?? sizes.md;
  const col = colors[color] ?? colors.accent;

  if (variant === 'dots') {
    return (
      <div
        className={`flex items-center gap-1.5 ${className}`}
        role="status"
        aria-label="Loading"
        {...props}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
            className={`rounded-full ${sz.dot} ${col.dot}`}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div
        className={`flex items-center justify-center ${sz.box} ${className}`}
        role="status"
        aria-label="Loading"
        {...props}
      >
        <motion.span
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className={`rounded-full w-full h-full ${col.dot}`}
        />
      </div>
    );
  }

  /* Default: spinner (rotation is acceptable for explicit loading — it communicates progress) */
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={`${sz.box} ${col.stroke} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      {...props}
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </motion.svg>
  );
}
