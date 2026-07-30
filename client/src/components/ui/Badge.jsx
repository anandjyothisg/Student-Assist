import React from 'react';

export function Badge({
  children,
  variant = 'subtle',
  color   = 'neutral',
  icon: Icon,
  dot     = false,
  className = '',
  ...props
}) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium font-sans tracking-wide select-none transition-colors duration-150';

  const palette = {
    solid: {
      neutral: 'bg-[#18181B] text-[#FAFAFA]',
      accent:  'bg-[#2563EB] text-white',
      success: 'bg-[#10B981] text-white',
      warning: 'bg-[#F59E0B] text-white',
      error:   'bg-[#EF4444] text-white',
      info:    'bg-[#2563EB] text-white',
      primary: 'bg-[#2563EB] text-white',
    },
    subtle: {
      neutral: 'bg-[#18181B] text-[#A1A1AA] border border-white/[0.05]',
      accent:  'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/30',
      success: 'bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30',
      warning: 'bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30',
      error:   'bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30',
      info:    'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/30',
      primary: 'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/30',
    },
    outline: {
      neutral: 'bg-transparent text-[#A1A1AA] border border-white/10',
      accent:  'bg-transparent text-[#60A5FA] border border-[#2563EB]/30',
      success: 'bg-transparent text-[#34D399] border border-[#10B981]/30',
      warning: 'bg-transparent text-[#FBBF24] border border-[#F59E0B]/30',
      error:   'bg-transparent text-[#F87171] border border-[#EF4444]/30',
      info:    'bg-transparent text-[#60A5FA] border border-[#2563EB]/30',
      primary: 'bg-transparent text-[#60A5FA] border border-[#2563EB]/30',
    },
  };

  const variantClasses = (palette[variant] ?? palette.subtle)[color] ?? palette.subtle.neutral;

  return (
    <span className={`${base} ${variantClasses} ${className}`} {...props}>
      {dot && (
        <span
          className={[
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            color === 'success' ? 'bg-[#10B981]' :
            color === 'warning' ? 'bg-[#F59E0B]' :
            color === 'error'   ? 'bg-[#EF4444]' :
            'bg-[#2563EB]',
          ].join(' ')}
        />
      )}
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
      {children}
    </span>
  );
}
