import React from 'react';

/** The AuraStudy "A" mark — matches /favicon.svg. */
export function BrandMark({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <rect width="64" height="64" rx="16" className="fill-fg" />
      <path d="M32 13 L47 50 H40.5 L37.2 41.5 H26.8 L23.5 50 H17 Z M29 35.5 H35 L32 27.5 Z" className="fill-canvas" />
    </svg>
  );
}

export function Brand({ collapsed = false, className = '' }) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <BrandMark size={30} />
      {!collapsed && <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-fg">AuraStudy</span>}
    </div>
  );
}
