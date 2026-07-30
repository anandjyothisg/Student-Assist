import React, { useState } from 'react';

export function Avatar({
  src,
  alt       = '',
  fallback  = 'U',
  name,
  size      = 'md',
  shape     = 'circle',
  status,
  className = '',
  ...props
}) {
  const [imgError, setImgError] = useState(false);

  // Generate initials from name prop if provided
  const initials = name
    ? name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : String(fallback).slice(0, 2).toUpperCase();

  const sizes = {
    xs:  'w-6  h-6  text-[9px]',
    sm:  'w-8  h-8  text-[11px]',
    md:  'w-9  h-9  text-[12px]',
    lg:  'w-11 h-11 text-[14px]',
    xl:  'w-14 h-14 text-[16px]',
    '2xl':'w-20 h-20 text-[20px]',
  };

  const shapes = {
    circle: 'rounded-full',
    square: 'rounded-lg',
  };

  const statusColors = {
    online:  'var(--success)',
    offline: 'var(--fg-3)',
    away:    'var(--warning)',
    busy:    'var(--error)',
  };

  const dotSizes = {
    xs:  'w-1.5 h-1.5',
    sm:  'w-2   h-2',
    md:  'w-2.5 h-2.5',
    lg:  'w-3   h-3',
    xl:  'w-3.5 h-3.5',
    '2xl':'w-4  h-4',
  };

  return (
    <div
      className={[
        'relative inline-flex items-center justify-center flex-shrink-0',
        sizes[size] ?? sizes.md,
        shapes[shape] ?? shapes.circle,
        className,
      ].join(' ')}
      style={{
        background: 'var(--bg-hover)',
        border: '1px solid var(--border)',
      }}
      {...props}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover ${shapes[shape]}`}
        />
      ) : (
        <span
          className="font-sans font-semibold uppercase select-none"
          style={{ color: 'var(--fg-2)' }}
        >
          {initials}
        </span>
      )}

      {status && statusColors[status] && (
        <span
          className={[
            'absolute rounded-full bottom-0 right-0',
            'status-dot',
            dotSizes[size] ?? dotSizes.md,
          ].join(' ')}
          style={{
            background: statusColors[status],
            boxShadow: `0 0 0 2px var(--bg-surface)`,
          }}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}
