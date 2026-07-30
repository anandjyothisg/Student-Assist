import React from 'react';

/**
 * Typography — Blueprint spec:
 * - Space Grotesk ONLY for: logo mark, hero title (Ask screen h1), AI branding title
 * - Inter for ALL other text: nav, cards, body, labels, metadata, headings inside pages
 * - Maximum 3 type scale steps per view, 2 weight steps per view
 * - Text color: fg-primary for primary, fg-secondary for body, fg-muted for metadata
 */

/**
 * Heading — Inter by default. Pass display={true} ONLY for logo/hero/AI screen title.
 */
export function Heading({
  level     = 1,
  children,
  className = '',
  display   = false,  // true = Space Grotesk (logo, hero, AI title)
  ...props
}) {
  const Tag = `h${level}`;

  /* Blueprint type scale — mapped to level */
  const levels = {
    1: 'text-[22px] font-semibold leading-tight',   /* page title */
    2: 'text-[18px] font-semibold leading-snug',    /* section heading */
    3: 'text-[15px] font-semibold leading-normal',  /* subsection */
    4: 'text-[14px] font-semibold leading-normal',  /* card title */
    5: 'text-[13px] font-medium  leading-normal',   /* label heading */
    6: 'text-[12px] font-medium  leading-normal',   /* small heading */
  };

  return (
    <Tag
      className={[
        display ? 'font-display' : 'font-sans',
        'text-fg-primary tracking-tight transition-colors duration-150',
        levels[level] ?? levels[3],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * Text — Inter body text.
 */
export function Text({
  as:       Tag      = 'p',
  variant           = 'p',   /* kept for compat */
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

  const color = muted
    ? 'text-fg-muted'
    : secondary
    ? 'text-fg-secondary'
    : 'text-fg-primary';

  return (
    <El
      className={[
        'font-sans transition-colors duration-150',
        sizes[size]   ?? sizes.md,
        weights[weight] ?? weights.normal,
        color,
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </El>
  );
}

/**
 * Code — monospace inline or block. bg-subtle surface, border-base border.
 */
export function Code({ block = false, children, className = '', ...props }) {
  if (block) {
    return (
      <pre
        className={`p-4 rounded-lg bg-bg-subtle border border-border-base font-mono text-[13px] text-fg-primary overflow-x-auto transition-colors duration-150 ${className}`}
        {...props}
      >
        <code>{children}</code>
      </pre>
    );
  }
  return (
    <code
      className={`px-1.5 py-0.5 rounded bg-bg-subtle border border-border-base font-mono text-[13px] text-fg-primary transition-colors duration-150 ${className}`}
      {...props}
    >
      {children}
    </code>
  );
}

/**
 * Label — small uppercase metadata labels. 11px Inter semibold letter-spaced.
 */
export function Label({ children, className = '', htmlFor, ...props }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`font-sans text-[11px] font-semibold text-fg-muted uppercase tracking-[0.06em] select-none ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
