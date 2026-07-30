import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const base = [
  'inline-flex items-center justify-center font-sans font-medium select-none cursor-pointer',
  'transition-all duration-150 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
  'disabled:pointer-events-none disabled:opacity-40',
  'relative overflow-hidden',
].join(' ');

const variants = {
  primary: [
    'bg-[var(--fg)] text-[var(--bg)]',
    'hover:opacity-90 active:opacity-100',
    'shadow-[var(--shadow-sm)]',
  ].join(' '),

  accent: [
    'bg-[var(--accent)] text-[var(--accent-fg)]',
    'hover:bg-[var(--accent-hover)]',
    'shadow-[var(--shadow-sm)]',
  ].join(' '),

  secondary: [
    'bg-[var(--bg-subtle)] text-[var(--fg-2)]',
    'border border-[var(--border)]',
    'hover:text-[var(--fg)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
  ].join(' '),

  outline: [
    'bg-transparent text-[var(--fg)]',
    'border border-[var(--border)]',
    'hover:bg-[var(--bg-subtle)] hover:border-[var(--border-hover)]',
  ].join(' '),

  ghost: [
    'bg-transparent text-[var(--fg-2)]',
    'hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]',
  ].join(' '),

  link: [
    'bg-transparent text-[var(--accent)] p-0 h-auto rounded-none',
    'hover:opacity-80 underline-offset-2 hover:underline',
  ].join(' '),

  danger: [
    'bg-transparent text-[var(--error)]',
    'border border-[var(--error-dim)]',
    'hover:bg-[var(--error-dim)]',
  ].join(' '),
};

const sizes = {
  xs: 'h-8   px-3   text-[11.5px] gap-1.5 rounded-sm font-medium',
  sm: 'h-9   px-4   text-[12.5px] gap-2   rounded-md font-medium',
  md: 'h-10  px-[18px] text-[13px]   gap-2   rounded-md font-medium',
  lg: 'h-11  px-[22px] text-[13.5px] gap-2.5 rounded-md font-medium',
  xl: 'h-12  px-6   text-[14px]   gap-3   rounded-md font-medium',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  children,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const isBtnDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      disabled={isBtnDisabled}
      onClick={onClick}
      whileHover={!isBtnDisabled ? { scale: 1.01 } : {}}
      whileTap={!isBtnDisabled ? { scale: 0.98 } : {}}
      transition={{ duration: 0.1 }}
      className={`${base} ${variants[variant] ?? variants.outline} ${sizes[size] ?? sizes.md} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
      {!loading && IconLeft && <IconLeft className="w-3.5 h-3.5 flex-shrink-0" />}
      {children && <span>{children}</span>}
      {!loading && IconRight && <IconRight className="w-3.5 h-3.5 flex-shrink-0" />}
    </motion.button>
  );
}
