import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';

/**
 * Composer — auto-growing prompt box with a send button.
 * Enter sends, Shift+Enter inserts a newline. While an answer is being written
 * the button becomes a real Stop button when `onStop` is given.
 */
export const Composer = forwardRef(function Composer(
  { value, onChange, onSubmit, onStop, loading = false, placeholder = 'Ask a question…', maxRows = 8, minRows = 1, size = 'md', footer, autoFocus = false, label = 'Message' },
  ref,
) {
  const taRef = useRef(null);
  useImperativeHandle(ref, () => taRef.current);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    ta.style.height = `${Math.min(ta.scrollHeight, lh * maxRows + 16)}px`;
  }, [value, maxRows]);

  useEffect(() => { if (autoFocus) taRef.current?.focus({ preventScroll: true }); }, [autoFocus]);

  const canSend = value.trim().length > 0 && !loading;
  const canStop = loading && !!onStop;
  const submit = (e) => { e?.preventDefault(); if (canSend) onSubmit(); };

  return (
    <form
      onSubmit={submit}
      className={[
        'group/composer flex flex-col rounded-xl border border-border bg-surface shadow-md transition-[border-color,box-shadow]',
        'focus-within:border-border-strong focus-within:shadow-lg',
      ].join(' ')}
    >
      <div className="flex items-end gap-2 p-2 pl-4">
        <textarea
          ref={taRef}
          rows={minRows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
          }}
          placeholder={placeholder}
          aria-label={label}
          className={[
            'min-w-0 flex-1 resize-none bg-transparent py-2 text-fg outline-none placeholder:text-fg-3',
            size === 'lg' ? 'text-[15px] leading-[1.55]' : 'text-[14px] leading-[1.5]',
          ].join(' ')}
        />
        <button
          type={canStop ? 'button' : 'submit'}
          onClick={canStop ? onStop : undefined}
          disabled={!canSend && !canStop}
          aria-label={canStop ? 'Stop answering' : 'Send'}
          title={canStop ? 'Stop' : 'Send'}
          className={[
            'mb-0.5 inline-flex shrink-0 items-center justify-center rounded-lg transition-[background-color,opacity,transform] active:translate-y-px',
            'size-10',
            canSend || canStop ? 'bg-fg text-canvas hover:bg-fg/85' : 'bg-subtle text-fg-3',
            'disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {canStop ? <Square className="size-3.5 fill-current" aria-hidden /> : <ArrowUp className="size-4" strokeWidth={2.25} aria-hidden />}
        </button>
      </div>
      {footer && <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-fg-3">{footer}</div>}
    </form>
  );
});
