import React from 'react';
import { motion } from 'framer-motion';

export function Card({ children, className = '', interactive = false, onClick, style = {}, ...props }) {
  const baseStyle = {
    borderRadius: '6px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    transition: 'all 0.15s ease-out',
    ...style,
  };

  if (interactive) {
    return (
      <motion.div
        whileHover={{ y: -1, scale: 1.005 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        className={`cursor-pointer ${className}`}
        style={baseStyle}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={className} onClick={onClick} style={baseStyle} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`p-5 flex flex-col gap-1.5 ${className}`} style={{ borderBottom: '1px solid var(--border)' }} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3
      className={`font-sans font-semibold tracking-tight ${className}`}
      style={{ fontSize: '13px', color: 'var(--fg)' }}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p
      className={`font-sans leading-relaxed ${className}`}
      style={{ fontSize: '11px', color: 'var(--fg-3)' }}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-5 font-sans ${className}`} style={{ fontSize: '13px' }} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div
      className={`p-5 pt-4 flex items-center ${className}`}
      style={{ borderTop: '1px solid var(--border)' }}
      {...props}
    >
      {children}
    </div>
  );
}
