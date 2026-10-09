import React from 'react';

/**
 * Card — a quiet surface. Border + surface colour; elevation is reserved for overlays.
 * `interactive` adds hover/press feedback and renders a <button> when `onClick` is provided.
 */
export function Card({ as, children, className = '', interactive = false, padded = true, onClick, ...props }) {
  const Tag = as || (interactive && onClick ? 'button' : 'div');
  return (
    <Tag
      onClick={onClick}
      type={Tag === 'button' ? 'button' : undefined}
      className={[
        'rounded-lg border border-border bg-surface text-left',
        padded ? 'p-5' : '',
        interactive
          ? 'transition-[border-color,background-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent'
          : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, icon: Icon, actions, className = '', children }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-2">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          {title && <h3 className="text-sm font-semibold text-fg">{title}</h3>}
          {description && <p className="mt-0.5 text-[13px] text-fg-3">{description}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`text-sm font-semibold text-fg ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }) {
  return <p className={`text-[13px] text-fg-3 ${className}`}>{children}</p>;
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`mt-4 flex items-center gap-2 border-t border-border pt-4 ${className}`}>{children}</div>;
}
