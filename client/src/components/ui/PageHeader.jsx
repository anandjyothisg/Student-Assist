import React from 'react';

/**
 * PageHeader — the consistent top block for every non-chat page:
 * serif display title, one-line description, actions aligned right (stacked on phones).
 */
export function PageHeader({ title, description, eyebrow, actions, meta, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 flex items-center gap-2">{eyebrow}</div>}
        <h1 className="hero-title text-[1.875rem] sm:text-[2.25rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[60ch] text-sm text-fg-3">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Tag shown on screens whose numbers are illustrative, not live. */
export function SampleDataNote({ children = 'Sample data' }) {
  return (
    <span className="inline-flex min-h-[22px] items-start gap-1.5 rounded-sm border border-dashed border-border-strong px-2 py-[3px] text-[11.5px] font-medium leading-[14px] text-fg-3">
      <span aria-hidden className="mt-[4px] size-1.5 shrink-0 rounded-full bg-warning" />
      {children}
    </span>
  );
}
