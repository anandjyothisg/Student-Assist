import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button — the one button geometry for the whole app.
 * Hover / press / focus feedback is pure CSS so it works for mouse, touch and keyboard.
 */
const base = [
  'inline-flex items-center justify-center whitespace-nowrap select-none',
  'font-sans font-medium tracking-[-0.005em]',
  'transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out',
  'active:translate-y-px',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  'disabled:pointer-events-none disabled:opacity-45',
].join(' ');

const buttonVariants = {
  primary:   'bg-fg text-canvas hover:bg-fg/88 shadow-xs',
  accent:    'bg-accent text-accent-fg hover:bg-accent-hover shadow-xs',
  secondary: 'bg-surface text-fg border border-border hover:border-border-strong hover:bg-subtle shadow-xs',
  outline:   'bg-transparent text-fg border border-border hover:border-border-strong hover:bg-subtle',
  ghost:     'bg-transparent text-fg-2 hover:bg-subtle hover:text-fg',
  subtle:    'bg-subtle text-fg hover:bg-hover',
  danger:    'bg-error text-white hover:bg-error/90 shadow-xs',
  'danger-ghost': 'bg-transparent text-error hover:bg-error-dim',
  link:      'bg-transparent text-accent hover:underline underline-offset-4 !h-auto !px-0',
};

const buttonSizes = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-sm',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-md',
  xl: 'h-12 px-6 text-[15px] gap-2.5 rounded-lg',
};

const iconSizes = { xs: 'size-3.5', sm: 'size-3.5', md: 'size-4', lg: 'size-4', xl: 'size-[18px]' };

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    iconLeft: IconLeft,
    iconRight: IconRight,
    fullWidth = false,
    children,
    className = '',
    type = 'button',
    ...props
  },
  ref,
) {
  const ic = iconSizes[size] ?? iconSizes.md;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        base,
        buttonVariants[variant] ?? buttonVariants.secondary,
        buttonSizes[size] ?? buttonSizes.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 className={`${ic} animate-spin shrink-0`} aria-hidden />
      ) : (
        IconLeft && <IconLeft className={`${ic} shrink-0`} aria-hidden />
      )}
      {children != null && <span className="truncate">{children}</span>}
      {!loading && IconRight && <IconRight className={`${ic} shrink-0`} aria-hidden />}
    </button>
  );
});

const iconButtonSizes = {
  sm: 'size-8 rounded-md [&>svg]:size-4',
  md: 'size-9 rounded-md [&>svg]:size-[18px]',
  lg: 'size-11 rounded-lg [&>svg]:size-5',
};

/** Square icon-only button. `label` is required for accessibility. */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, size = 'md', variant = 'ghost', active = false, className = '', type = 'button', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={[
        'inline-flex items-center justify-center shrink-0',
        'transition-[background-color,color,border-color] duration-150 ease-out active:translate-y-px',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'outline'
          ? 'border border-border bg-surface text-fg-2 hover:text-fg hover:border-border-strong'
          : 'text-fg-3 hover:text-fg hover:bg-subtle',
        active ? '!bg-subtle !text-fg' : '',
        iconButtonSizes[size] ?? iconButtonSizes.md,
        className,
      ].join(' ')}
      {...props}
    >
      {Icon ? <Icon aria-hidden /> : children}
    </button>
  );
});
