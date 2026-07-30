import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Tooltip — Blueprint spec:
 * - Fade only. NO scale. 120ms ease-out.
 * - Dark bg (#09090B) white text, 11px, Inter medium.
 * - Triggered on hover + focus (keyboard accessible).
 */
export function Tooltip({
  children,
  content,
  position  = 'top',
  delay     = 300,
  className = '',
}) {
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef(null);

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), delay); };
  const hide = () => { clearTimeout(timerRef.current); setVisible(false); };

  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  const positions = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full  left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full  top-1/2 -translate-y-1/2 ml-2',
  };

  const motionY = { top: 3, bottom: -3, left: 0, right: 0 };
  const motionX = { left: 3, right: -3, top: 0, bottom: 0 };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {visible && content && (
          <motion.div
            initial={{ opacity: 0, y: motionY[position], x: motionX[position] }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{    opacity: 0, y: motionY[position], x: motionX[position] }}
            transition={{ duration: 0.12, ease: [0.0, 0, 0.2, 1] }}
            className={[
              'absolute z-50 px-2.5 py-1.5 rounded-md',
              'bg-[#09090B] dark:bg-[#FAFAFA] text-white dark:text-[#09090B]',
              'text-[11px] font-medium font-sans whitespace-nowrap',
              'shadow-[var(--shadow-lg)] pointer-events-none select-none',
              positions[position],
              className,
            ].join(' ')}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
