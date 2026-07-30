import React from 'react';
import { motion } from 'framer-motion';

export function AiThinkingLine({ className = '', width = 'w-24' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.0, 0, 0.2, 1] }}
      aria-label="AI is generating a response"
      role="status"
    >
      <motion.div
        animate={{ opacity: [0.25, 1, 0.25] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className={`h-[2px] rounded-full ${width} ${className}`}
        style={{ background: 'var(--accent)' }}
      />
    </motion.div>
  );
}

export function AiThinkingDots({ className = '' }) {
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="status"
      aria-label="Loading"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{
            duration: 1.4,
            repeat:   Infinity,
            ease:     'easeInOut',
            delay:    i * 0.2,
          }}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--accent)' }}
        />
      ))}
    </div>
  );
}
