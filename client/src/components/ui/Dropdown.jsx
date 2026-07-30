import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

export function Dropdown({
  trigger,
  items         = [],
  onSelect,
  selected,
  align         = 'left',
  className     = '',
}) {
  const [open, setOpen]     = useState(false);
  const [focused, setFocused] = useState(-1);
  const containerRef        = useRef(null);
  const listRef             = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setFocused(-1); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setFocused(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused((f) => Math.min(f + 1, items.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused((f) => Math.max(f - 1, 0)); }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const item = items[focused];
      if (item && !item.disabled) { onSelect?.(item); setOpen(false); setFocused(-1); }
    }
  };

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onKeyDown={handleKeyDown}
    >
      <div onClick={() => { setOpen((o) => !o); setFocused(-1); }}>
        {trigger}
      </div>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0   }}
            exit={{    opacity: 0, y: -4  }}
            transition={{ duration: 0.15, ease: [0.0, 0, 0.2, 1] }}
            className={[
              'absolute z-50 mt-1.5 min-w-[200px] max-h-60 overflow-y-auto',
              'rounded-md border border-white/[0.05] bg-[#111113]',
              'shadow-premium-lg py-1.5 select-none',
              alignClass,
            ].join(' ')}
          >
            {items.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = item.id === selected;
              const isFocused  = focused === idx;

              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (!item.disabled) { onSelect?.(item); setOpen(false); setFocused(-1); }
                  }}
                  className={[
                    'flex items-center gap-2.5 px-3 py-2 mx-1 rounded-md',
                    'font-sans text-[13px] cursor-pointer select-none',
                    'transition-colors duration-100',
                    item.disabled
                      ? 'text-[#71717A] opacity-40 cursor-not-allowed pointer-events-none'
                      : isFocused || isSelected
                      ? 'bg-[#18181B] text-[#FAFAFA]'
                      : 'text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]',
                  ].join(' ')}
                >
                  {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0 text-[#71717A]" />}
                  <span className="flex-1 font-medium">{item.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownTrigger({ children, open = false, className = '' }) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center gap-2 h-9 px-3.5 rounded-md border border-white/[0.05]',
        'bg-[#111113] text-[#A1A1AA] text-[13px] font-medium font-sans',
        'hover:border-white/20 hover:text-[#FAFAFA]',
        'transition-colors duration-150 cursor-pointer',
        className,
      ].join(' ')}
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      {children}
      <ChevronDown
        className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
}
