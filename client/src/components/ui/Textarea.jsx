import React, { useId } from 'react';

export function Textarea({
  label,
  error,
  helperText,
  className = '',
  id,
  fullWidth = true,
  disabled  = false,
  rows      = 4,
  ...props
}) {
  const generatedId = useId();
  const textareaId = id || generatedId;

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : 'w-auto'}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="font-sans text-[12px] font-medium text-[#A1A1AA] select-none tracking-wide"
        >
          {label}
        </label>
      )}

      <textarea
        id={textareaId}
        disabled={disabled}
        rows={rows}
        className={[
          'w-full px-4 py-3 rounded-md border bg-[#111113]',
          'font-sans text-[13px] text-[#FAFAFA] placeholder:text-[#71717A]',
          'transition-all duration-150 ease-out outline-none shadow-sm',
          'resize-y min-h-[80px]',
          'disabled:opacity-40 disabled:bg-[#18181B] disabled:cursor-not-allowed',
          'focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] focus:bg-[#141417]',
          error
            ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20'
            : 'border-white/[0.05] hover:border-white/20',
          className,
        ].join(' ')}
        {...props}
      />

      {error && (
        <p className="font-sans text-[11px] text-[#EF4444] px-1">{error}</p>
      )}
      {!error && helperText && (
        <p className="font-sans text-[11px] text-[#71717A] px-1">{helperText}</p>
      )}
    </div>
  );
}
