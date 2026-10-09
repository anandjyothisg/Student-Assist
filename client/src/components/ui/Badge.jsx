import React from 'react';

const tones = {
  neutral: 'bg-subtle text-fg-2 border-border',
  accent:  'bg-accent-dim text-accent border-transparent',
  success: 'bg-success-dim text-success border-transparent',
  warning: 'bg-warning-dim text-warning border-transparent',
  error:   'bg-error-dim text-error border-transparent',
  outline: 'bg-transparent text-fg-2 border-border',
};

const dots = {
  neutral: 'bg-fg-3', accent: 'bg-accent', success: 'bg-success',
  warning: 'bg-warning', error: 'bg-error', outline: 'bg-fg-3',
};

/**
 * Badge — compact status/label chip. Rounded-rectangle, not pill.
 * `color` is accepted as an alias of `tone` for backwards compatibility.
 */
export function Badge({ children, tone, color, dot = false, mono = false, icon: Icon, className = '', ...props }) {
  const t = tone || color || 'neutral';
  return (
    <span
      className={[
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-[11.5px] font-medium leading-none',
        mono ? 'font-mono text-[11px] tracking-normal' : '',
        tones[t] ?? tones.neutral,
        className,
      ].join(' ')}
      {...props}
    >
      {dot && <span aria-hidden className={`size-1.5 rounded-full ${dots[t] ?? dots.neutral}`} />}
      {Icon && <Icon aria-hidden className="size-3" />}
      {children}
    </span>
  );
}
