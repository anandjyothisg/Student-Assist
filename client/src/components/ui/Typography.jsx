import React from 'react';

/**
 * Typography — Design System spec:
 * - Instrument Serif for: hero titles, AI branding titles
 * - Geist Sans for ALL other text: nav, cards, body, labels, metadata, headings
 * - Text color: var(--fg) for primary, var(--fg-2) for secondary, var(--fg-3) for muted
 */

/**
 * Heading — Geist Sans by default. Pass display={true} ONLY for hero/AI title.
 */
export function Heading({
  level     = 1,
  children,
  className = '',
  display   = false,
  ...props
}) {
  const Tag = `h${level}`;

  const levels = {
    1: 'text-[22px] font-semibold leading-tight',
    2: 'text-[18px] font-semibold leading-snug',
    3: 'text-[15px] font-semibold leading-normal',
    4: 'text-[14px] font-semibold leading-normal',
    5: 'text-[13px] font-medium  leading-normal',
    6: 'text-[12px] font-medium  leading-normal',
  };

  return (
    <Tag
      className={[
        display ? 'font-serif' : 'font-sans',
        'tracking-tight',
        levels[level] ?? levels[3],
        className,
      ].join(' ')}
      style={{ color: 'var(--fg)' }}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * Text — Geist Sans body text.
 */
export function Text({
  as:       Tag      = 'p',
  variant           = 'p',
  size      = 'md',
  weight    = 'normal',
  muted     = false,
  secondary = false,
  children,
  className = '',
  ...props
}) {
  const El = Tag !== 'p' ? Tag : variant !== 'p' ? variant : 'p';

  const sizes = {
    xs:  'text-[11px] leading-4',
    sm:  'text-[13px] leading-5',
    md:  'text-[15px] leading-6',
    lg:  'text-[18px] leading-7',
    xl:  'text-[22px] leading-8',
    '2xl':'text-[28px] leading-9',
  };

  const weights = {
    light:    'font-light',
    normal:   'font-normal',
    medium:   'font-medium',
    semibold: 'font-semibold',
    bold:     'font-bold',
  };

  const colorVar = muted
    ? 'var(--fg-3)'
    : secondary
    ? 'var(--fg-2)'
    : 'var(--fg)';

  return (
    <El
      className={[
        'font-sans',
        sizes[size]   ?? sizes.md,
        weights[weight] ?? weights.normal,
        className,
      ].join(' ')}
      style={{ color: colorVar }}
      {...props}
    >
      {children}
    </El>
  );
}

/**
 * Code — monospace inline or block.
 */
export function Code({ block = false, children, className = '', ...props }) {
  if (block) {
    return (
      <pre
        className={`p-4 rounded-lg font-mono text-[13px] overflow-x-auto ${className}`}
        style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          color: 'var(--fg)',
        }}
        {...props}
      >
        <code>{children}</code>
      </pre>
    );
  }
  return (
    <code
      className={`px-1.5 py-0.5 rounded font-mono text-[13px] ${className}`}
      style={{
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        color: 'var(--fg)',
      }}
      {...props}
    >
      {children}
    </code>
  );
}

/**
 * Label — small uppercase metadata labels.
 */
export function Label({ children, className = '', htmlFor, ...props }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`font-sans text-[11px] font-semibold uppercase tracking-[0.06em] select-none ${className}`}
      style={{ color: 'var(--fg-3)' }}
      {...props}
    >
      {children}
    </label>
  );
}
