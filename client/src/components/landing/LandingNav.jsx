import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion';
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react';
import { Button, IconButton } from '../ui/Button';
import { Brand } from '../ui/BrandMark';
import { useTheme } from '../ui/Theme';
import { EASE } from './motion';

const LINKS = [
  ['#method', 'How it works'],
  ['#lab', 'Try it'],
  ['#teachers', 'For teachers'],
  ['#roles', 'Who it’s for'],
];

export function LandingNav({ onStart, signedIn = false }) {
  const { isDark, toggleTheme } = useTheme();
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40, mass: 0.4 });
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useMotionValueEvent(scrollY, 'change', (v) => {
    const next = v > 24;
    if (next !== scrolled) setScrolled(next);
  });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);

  return (
    <header ref={menuRef} className="fixed inset-x-0 top-0 z-[var(--z-nav)]">
      <div className={`landing-nav transition-[background-color,border-color,backdrop-filter] duration-300 ${scrolled || open ? 'landing-nav--solid' : ''}`}>
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-8">
          <a href="#top" className="rounded-md" aria-label="AuraStudy, back to top"><Brand /></a>
          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {LINKS.map(([href, label]) => (
              <a key={href} href={href} className="rounded-md px-3 py-2 text-[13.5px] font-medium text-fg-2 transition-colors hover:text-fg">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <IconButton icon={isDark ? Sun : Moon} label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme} />
            {signedIn ? (
              <Button onClick={() => onStart()} iconRight={ArrowRight} className="max-sm:hidden">Open app</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => onStart('login')} className="max-sm:hidden">Sign in</Button>
                <Button onClick={() => onStart('register')} className="max-sm:hidden">Create account</Button>
              </>
            )}
            <IconButton
              icon={open ? X : Menu}
              label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="landing-menu"
              onClick={() => setOpen((o) => !o)}
              className="md:!hidden"
            />
          </div>
        </div>
        <motion.div aria-hidden className="landing-progress h-px origin-left bg-[var(--thread)]" style={{ scaleX: progress }} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="landing-menu"
            aria-label="Menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="landing-nav--solid border-b border-border px-4 pb-5 pt-2 md:hidden"
            onClick={(e) => { if (e.target.closest('a')) setOpen(false); }}
          >
            <ul className="divide-y divide-border">
              {LINKS.map(([href, label]) => (
                <li key={href}><a href={href} className="block py-3.5 text-[16px] font-medium text-fg">{label}</a></li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden">
              {signedIn ? (
                <Button size="lg" className="col-span-2" onClick={() => onStart()}>Open app</Button>
              ) : (
                <>
                  <Button variant="secondary" size="lg" onClick={() => onStart('login')}>Sign in</Button>
                  <Button size="lg" onClick={() => onStart('register')}>Create account</Button>
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
