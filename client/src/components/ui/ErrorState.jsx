import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

/**
 * ErrorState — inline failure message with optional retry.
 * `variant="inline"` renders a compact banner instead of a centred block.
 */
export function ErrorState({ title = 'Something went wrong', description, onRetry, retryLabel = 'Try again', variant = 'block', className = '' }) {
  if (variant === 'inline') {
    return (
      <div role="alert" className={`flex items-start gap-3 rounded-lg border border-error/25 bg-error-dim px-4 py-3 ${className}`}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">{title}</p>
          {description && <p className="mt-0.5 text-[13px] text-fg-2">{description}</p>}
        </div>
        {onRetry && (
          <Button size="xs" variant="secondary" iconLeft={RotateCcw} onClick={onRetry} className="shrink-0">
            {retryLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-4 px-6 py-12 text-center ${className}`}>
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-error-dim text-error">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {description && <p className="text-[13px] leading-relaxed text-fg-3">{description}</p>}
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" iconLeft={RotateCcw} onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
