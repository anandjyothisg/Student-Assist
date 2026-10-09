import React, { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll } from 'framer-motion';
import { useTheme } from '../ui/Theme';
import { EASE, useRange } from './motion';
import studentDark from '../../assets/landing/student-dark.jpg';
import studentLight from '../../assets/landing/student-light.jpg';
import teacherDark from '../../assets/landing/teacher-dark.jpg';
import teacherLight from '../../assets/landing/teacher-light.jpg';
import adminDark from '../../assets/landing/admin-dark.jpg';
import adminLight from '../../assets/landing/admin-light.jpg';

/*
 * Act five, deliberately calm: the same library seen by the three demo roles.
 * Screens are real captures of the running app with the seeded demo data.
 */
const ROLES = [
  {
    id: 'student',
    label: 'Students',
    title: 'Ask, check the page, keep what helps.',
    points: [
      'Ask across all your courses',
      'Open the cited page in one click',
      'Save answers, study flashcards',
    ],
    alt: 'The Ask screen: an answer about A* search with five cited lecture-note pages.',
    img: { dark: studentDark, light: studentLight },
  },
  {
    id: 'teacher',
    label: 'Teachers',
    title: 'Publish once. See what lands.',
    points: [
      'Upload by unit and topic',
      'See what students ask, and when',
      'Spot gaps in your materials',
    ],
    alt: 'The Insights screen: questions asked, active students, a weekday heatmap and the most asked questions.',
    img: { dark: teacherDark, light: teacherLight },
  },
  {
    id: 'admin',
    label: 'Admins',
    title: 'One place to see that it all works.',
    points: [
      'Manage users and courses',
      'Live health of model and index',
      'Permissions enforced by the server',
    ],
    alt: 'The Status screen: 29 users, 6 courses, 52 documents and every service operational.',
    img: { dark: adminDark, light: adminLight },
  },
];

export function Vantage() {
  const reduce = !!useReducedMotion();
  const { isDark } = useTheme();
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useRange(scrollYProgress, [0, 1], [reduce ? 0 : 40, reduce ? 0 : -40]);
  const role = ROLES[active];

  const onKey = (e) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (active + dir + ROLES.length) % ROLES.length;
    setActive(next);
    document.getElementById(`role-tab-${ROLES[next].id}`)?.focus();
  };

  return (
    <section id="roles" ref={ref} aria-labelledby="roles-title" className="scroll-mt-16 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="roles-title" className="hero-title max-w-[14ch] text-[2.4rem] sm:text-[3.25rem] lg:text-[3.6rem]">
            One library, three ways in.
          </h2>
          <div role="tablist" aria-label="Roles" className="relative flex gap-1 self-start lg:self-auto" onKeyDown={onKey}>
            {ROLES.map((r, i) => (
              <button
                key={r.id}
                id={`role-tab-${r.id}`}
                role="tab"
                type="button"
                aria-selected={i === active}
                aria-controls="role-panel"
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                className={`relative px-4 pb-3 pt-2 text-[15px] font-medium transition-colors ${i === active ? 'text-fg' : 'text-fg-3 hover:text-fg-2'}`}
              >
                {r.label}
                {i === active && (
                  <motion.span layoutId="role-thread" className="absolute inset-x-3 bottom-0 h-[1.5px] rounded-full bg-[var(--thread)]" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div id="role-panel" role="tabpanel" aria-labelledby={`role-tab-${role.id}`} className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] lg:gap-14">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={role.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="lg:pt-6"
            >
              <h3 className="text-[22px] font-semibold leading-snug tracking-[-0.02em] text-fg">{role.title}</h3>
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {role.points.map((p) => (
                  <li key={p} className="py-3.5 text-[14.5px] leading-relaxed text-fg-2">{p}</li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          <motion.div style={{ y }} className="relative">
            <div className="vantage-frame relative overflow-hidden">
              <div className="relative aspect-[1440/900] w-full">
                <AnimatePresence initial={false}>
                  <motion.img
                    key={`${role.id}-${isDark ? 'd' : 'l'}`}
                    src={isDark ? role.img.dark : role.img.light}
                    alt={role.alt}
                    width={1440}
                    height={900}
                    loading="lazy"
                    decoding="async"
                    initial={reduce ? false : { opacity: 0, scale: 1.015 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="absolute inset-0 size-full object-cover object-left-top"
                  />
                </AnimatePresence>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-fg-3">Real screens, demo accounts.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
