import React from 'react';

export function Skeleton({ className = '', width, height, rounded, style, ...props }) {
  return (
    <div
      aria-hidden
      className={`skeleton ${rounded ? 'rounded-full' : ''} ${className}`}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

/** A stack of text-line skeletons; the last line is shorter. */
export function SkeletonGroup({ rows = 3, gap = 'gap-2.5', className = '' }) {
  return (
    <div role="status" aria-label="Loading" className={`flex flex-col ${gap} ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3.5" width={i === rows - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
