import React from 'react';

export function Badge({
  children,
  variant = 'subtle',
  color   = 'neutral',
  icon: Icon,
  dot     = false,
  className = '',
  ...props
}) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium font-sans tracking-wide select-none';

  // Use CSS variables for theming — these adapt to dark/light mode automatically
  const styles = {
    solid: {
      neutral: { background: 'var(--bg-hover)',    color: 'var(--fg)',    border: '1px solid var(--border)' },
      accent:  { background: 'var(--accent)',       color: 'var(--accent-fg)', border: '1px solid var(--accent)' },
      success: { background: 'var(--success)',      color: '#fff',        border: '1px solid var(--success)' },
      warning: { background: 'var(--warning)',      color: '#fff',        border: '1px solid var(--warning)' },
      error:   { background: 'var(--error)',        color: '#fff',        border: '1px solid var(--error)' },
      info:    { background: 'var(--accent)',       color: 'var(--accent-fg)', border: '1px solid var(--accent)' },
      primary: { background: 'var(--fg)',           color: 'var(--bg)',   border: '1px solid var(--fg)' },
    },
    subtle: {
      neutral: { background: 'var(--bg-subtle)',   color: 'var(--fg-2)', border: '1px solid var(--border)' },
      accent:  { background: 'var(--accent-dim)',  color: 'var(--accent)', border: '1px solid var(--accent)' },
      success: { background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)' },
      warning: { background: 'var(--warning-dim)', color: 'var(--warning)', border: '1px solid var(--warning)' },
      error:   { background: 'var(--error-dim)',   color: 'var(--error)',  border: '1px solid var(--error)' },
      info:    { background: 'var(--accent-dim)',  color: 'var(--accent)', border: '1px solid var(--accent)' },
      primary: { background: 'var(--bg-subtle)',   color: 'var(--fg)',   border: '1px solid var(--border-hover)' },
    },
    outline: {
      neutral: { background: 'transparent', color: 'var(--fg-2)',   border: '1px solid var(--border)' },
      accent:  { background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' },
      success: { background: 'transparent', color: 'var(--success)', border: '1px solid var(--success)' },
      warning: { background: 'transparent', color: 'var(--warning)', border: '1px solid var(--warning)' },
      error:   { background: 'transparent', color: 'var(--error)',  border: '1px solid var(--error)' },
      info:    { background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' },
      primary: { background: 'transparent', color: 'var(--fg)',     border: '1px solid var(--border-hover)' },
    },
  };

  const styleObj = (styles[variant] ?? styles.subtle)[color] ?? styles.subtle.neutral;

  const dotColors = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    error:   'var(--error)',
    accent:  'var(--accent)',
    info:    'var(--accent)',
    primary: 'var(--fg)',
    neutral: 'var(--fg-3)',
  };

  return (
    <span className={`${base} ${className}`} style={styleObj} {...props}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: dotColors[color] ?? dotColors.neutral }}
        />
      )}
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
      {children}
    </span>
  );
}
