import React from 'react';

/**
 * EmptyState — composed "nothing here yet" block.
 * `action` / `secondaryAction` accept a React node (usually a <Button>).
 */
export function EmptyState({ icon: Icon, title, description, action, secondaryAction, compact = false, className = '' }) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center animate-fade-in',
        compact ? 'gap-3 px-4 py-8' : 'gap-4 px-6 py-14',
        className,
      ].join(' ')}
    >
      {Icon && (
        <span className={`inline-flex items-center justify-center rounded-xl border border-border bg-subtle text-fg-2 ${compact ? 'size-10' : 'size-12'}`}>
          <Icon className={compact ? 'size-[18px]' : 'size-5'} aria-hidden />
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1.5">
        {title && <h3 className="text-[15px] font-semibold text-fg">{title}</h3>}
        {description && <p className="text-[13px] leading-relaxed text-fg-3">{description}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
