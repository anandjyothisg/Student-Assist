import React from 'react';

/**
 * Skeleton — Blueprint spec:
 * - Single left-to-right shimmer pass. NOT pulsing opacity.
 * - One shimmer animation cycle, not staggered.
 * - Colors: bg-subtle (light) / bg-subtle (dark) — via CSS var.
 */
export function Skeleton({
  variant   = 'text',  // 'text' | 'circle' | 'rect'
  width,
  height,
  className = '',
  ...props
}) {
  const base = [
    'relative overflow-hidden bg-bg-subtle',
    'after:absolute after:inset-0',
    'after:bg-gradient-to-r after:from-transparent after:via-white/[0.07] dark:after:via-white/[0.04] after:to-transparent',
    'after:animate-[shimmer_1.6s_ease-in-out_infinite]',
    'after:bg-[length:200%_100%]',
    'after:translate-x-[-100%]',
  ].join(' ');

  const shapes = {
    text:   'h-[14px] w-full rounded-md',
    circle: 'rounded-full',
    rect:   'rounded-lg',
  };

  return (
    <div
      className={`${base} ${shapes[variant]} ${className}`}
      style={{
        width:  width  || undefined,
        height: height || (variant === 'circle' ? width : undefined),
        ...props.style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * SkeletonGroup — convenience wrapper for a column of skeleton rows.
 */
export function SkeletonGroup({ rows = 3, gap = 'gap-3', className = '' }) {
  return (
    <div className={`flex flex-col ${gap} ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          style={{ width: i % 3 === 2 ? '65%' : '100%' }}
        />
      ))}
    </div>
  );
}
