import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Field — label + control + hint/error, wired up for screen readers.
 * Pass a render function to receive the generated ids:
 *   <Field label="Email" error={err}>{(p) => <input {...p} className="field-control" />}</Field>
 */
export function Field({ label, hint, error, action, id, className = '', children }) {
  const autoId = useId();
  const controlId = id || autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const controlProps = { id: controlId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {(label || action) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={controlId} className="text-[13px] font-medium text-fg-2 select-none">
              {label}
            </label>
          )}
          {action}
        </div>
      )}
      {typeof children === 'function' ? children(controlProps) : children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-error">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Input — standard text input. Supports leading/trailing icons and a password reveal toggle.
 */
export const Input = forwardRef(function Input(
  {
    label,
    hint,
    helperText,
    error,
    action,
    iconLeft: IconLeft,
    iconRight: IconRight,
    revealable = false,
    size = 'md',
    type = 'text',
    className = '',
    wrapperClassName = '',
    id,
    ...props
  },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const inputType = revealable ? (revealed ? 'text' : 'password') : type;
  const heights = { sm: 'min-h-8 !py-1 text-[13px]', md: '', lg: 'min-h-11' };

  return (
    <Field label={label} hint={hint ?? helperText} error={error} action={action} id={id} className={wrapperClassName}>
      {(p) => (
        <div className="relative flex items-center">
          {IconLeft && (
            <IconLeft aria-hidden className="pointer-events-none absolute left-3 size-4 text-fg-3" />
          )}
          <input
            ref={ref}
            type={inputType}
            {...p}
            {...props}
            className={[
              'field-control',
              heights[size] ?? '',
              IconLeft ? '!pl-9' : '',
              IconRight || revealable ? '!pr-10' : '',
              className,
            ].join(' ')}
          />
          {revealable ? (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              className="absolute right-1.5 inline-flex size-8 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-subtle hover:text-fg"
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          ) : (
            IconRight && <IconRight aria-hidden className="pointer-events-none absolute right-3 size-4 text-fg-3" />
          )}
        </div>
      )}
    </Field>
  );
});

/** Search input with a leading magnifier — used in list toolbars. */
export const SearchInput = forwardRef(function SearchInput({ icon: Icon, className = '', ...props }, ref) {
  return (
    <div className={`relative flex items-center ${className}`}>
      {Icon && <Icon aria-hidden className="pointer-events-none absolute left-3 size-4 text-fg-3" />}
      <input ref={ref} type="search" {...props} className="field-control !min-h-9 !py-1.5 !pl-9 text-[13px]" />
    </div>
  );
});
