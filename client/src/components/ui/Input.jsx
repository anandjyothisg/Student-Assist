import React, { useId } from 'react';

export function Input({
  label,
  error,
  helperText,
  iconLeft:  IconLeft,
  iconRight: IconRight,
  className  = '',
  id,
  fullWidth  = true,
  disabled   = false,
  type       = 'text',
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : 'w-auto'}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="font-sans text-[11px] font-medium uppercase tracking-widest select-none"
          style={{ color: 'var(--fg-3)' }}
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {IconLeft && (
          <div
            className="absolute left-3.5 pointer-events-none flex items-center"
            style={{ color: 'var(--fg-3)' }}
          >
            <IconLeft className="w-4 h-4" />
          </div>
        )}

        <input
          id={inputId}
          type={type}
          disabled={disabled}
          className={[
            'w-full h-11 px-3.5 py-2.5 rounded-md',
            'font-sans text-[13.5px] leading-relaxed',
            'transition-all duration-150 ease-out outline-none',
            disabled ? 'opacity-85 cursor-not-allowed' : '',
            IconLeft  ? 'pl-10' : '',
            IconRight ? 'pr-10' : '',
            error
              ? 'border-[var(--error)]'
              : 'border-[var(--border)] hover:border-[var(--border-hover)] focus:border-[var(--accent)]',
            className,
          ].filter(Boolean).join(' ')}
          style={{
            background: disabled ? 'var(--bg-subtle)' : 'var(--bg-surface)',
            color: disabled ? 'var(--fg-2)' : 'var(--fg)',
            border: error
              ? '1px solid var(--error)'
              : '1px solid var(--border)',
            boxShadow: 'none',
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)';
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
          {...props}
        />

        {IconRight && (
          <div
            className="absolute right-3.5 pointer-events-none flex items-center"
            style={{ color: 'var(--fg-3)' }}
          >
            <IconRight className="w-4 h-4" />
          </div>
        )}
      </div>

      {error && (
        <p
          className="font-sans text-[11px] px-0.5"
          style={{ color: 'var(--error)' }}
        >
          {error}
        </p>
      )}
      {!error && helperText && (
        <p
          className="font-sans text-[11px] px-0.5"
          style={{ color: 'var(--fg-3)' }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
