import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, HelpCircle, Award, Activity, Grid } from 'lucide-react';
import { useToast } from '../ui/Toast';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const heatmapRows = [
  { id: 'algo',    name: 'Algorithms' },
  { id: 'ml',      name: 'Machine Learning' },
  { id: 'digital', name: 'Digital Logic' },
  { id: 'db',      name: 'Database Systems' },
  { id: 'ethics',  name: 'AI Ethics' },
];

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const heatmapData = [
  [1, 2, 4, 3, 2, 1, 0],
  [3, 1, 2, 4, 3, 0, 1],
  [2, 3, 1, 2, 1, 0, 0],
  [1, 2, 3, 2, 4, 1, 0],
  [0, 1, 1, 2, 1, 0, 0],
];

const popularQuestions = [
  { text: 'Quicksort worst-case bound recurrence relations', pct: 88, count: 4230 },
  { text: 'How do support vector machine slack variables resolve overlap?', pct: 64, count: 2840 },
  { text: 'Simplify 4-variable boolean gate maps with wraps', pct: 45, count: 1912 },
  { text: 'Explain the difference between SQL and NoSQL database layers', pct: 30, count: 1240 },
];

// Monochromatic heatmap — intensity levels using CSS var opacity tricks
function getCellBg(level) {
  // Returns inline style objects using accent color with opacity
  switch (level) {
    case 1: return { background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' };
    case 2: return { background: 'color-mix(in srgb, var(--accent) 30%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)' };
    case 3: return { background: 'color-mix(in srgb, var(--accent) 55%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 60%, transparent)' };
    case 4: return { background: 'var(--accent)', border: '1px solid var(--accent-hover)' };
    default: return { background: 'var(--bg-subtle)', border: '1px solid var(--border)' };
  }
}

function getLevelLabel(level) {
  switch (level) {
    case 1: return 'Low — 1–3 queries';
    case 2: return 'Medium — 4–8 queries';
    case 3: return 'High — 9–14 queries';
    case 4: return 'Critical — 15+ queries';
    default: return 'No activity';
  }
}

/* ─── Panel Card ─────────────────────────────────────────────────────────── */
function Panel({ children, className = '' }) {
  return (
    <div
      className={`rounded-md flex flex-col gap-0 overflow-hidden ${className}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-premium-sm)',
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="px-5 pt-5 pb-4 flex flex-col gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />}
        <span className="font-sans font-semibold tracking-tight" style={{ fontSize: '13px', color: 'var(--fg)' }}>
          {title}
        </span>
      </div>
      {subtitle && (
        <p className="font-sans" style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ─── Analytics Page ─────────────────────────────────────────────────────── */
export function AnalyticsPage() {
  const toast = useToast();
  const [hoveredCell, setHoveredCell] = useState(null);

  const handleCellClick = (subj, day, val) => {
    toast.info(`${subj} on ${day}: ${getLevelLabel(val)}`);
  };

  return (
    <div className="flex flex-col gap-8 font-sans pb-8">

      {/* Header */}
      <div className="pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="hero-title" style={{ fontSize: '1.875rem' }}>Analytics</h1>
        <p className="font-sans font-normal mt-1" style={{ fontSize: '13px', color: 'var(--fg-3)' }}>
          Curriculum coverage, AI usage patterns, and student performance metrics.
        </p>
      </div>

      {/* Row 1: Heatmap + Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Heatmap (2/3) */}
        <Panel className="lg:col-span-2 relative">
          <PanelHeader
            icon={Grid}
            title="Difficulty Heatmap"
            subtitle="Curriculum difficulty levels by subject and weekday based on AI query volume"
          />
          <div className="p-5 flex flex-col gap-5">
            <div className="flex flex-col gap-2.5 overflow-x-auto pb-1">
              {/* Day headers */}
              <div className="flex items-center gap-2 pl-28">
                {weekdays.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    className="w-10 text-center font-sans font-semibold uppercase tracking-wider"
                    style={{ fontSize: '9px', color: 'var(--fg-3)' }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Subject rows */}
              {heatmapRows.map((row, rIdx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <div
                    className="w-28 font-sans font-medium truncate pr-2"
                    style={{ fontSize: '11px', color: 'var(--fg-2)' }}
                  >
                    {row.name}
                  </div>
                  <div className="flex items-center gap-2">
                    {heatmapData[rIdx].map((val, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => handleCellClick(row.name, weekdays[cIdx], val)}
                        onMouseEnter={() => setHoveredCell({
                          subject: row.name,
                          day: weekdays[cIdx],
                          level: val,
                          count: val === 0 ? 0 : val * 4 + Math.floor(Math.random() * 3),
                        })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className="w-10 h-10 rounded-lg transition-all duration-150 cursor-pointer"
                        style={getCellBg(val)}
                        aria-label={`${row.name} — ${weekdays[cIdx]}: level ${val}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 flex-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <span className="font-sans font-semibold uppercase tracking-wider" style={{ fontSize: '9px', color: 'var(--fg-3)' }}>
                Intensity:
              </span>
              {[0, 1, 2, 3, 4].map(level => (
                <div key={level} className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md" style={getCellBg(level)} />
                  <span className="font-sans" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>
                    {['None', 'Low', 'Med', 'High', 'Critical'][level]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          <AnimatePresence>
            {hoveredCell && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.1 }}
                className="absolute bottom-28 right-5 pointer-events-none z-10 flex flex-col gap-1.5 rounded-xl p-3.5"
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-premium-lg)',
                  width: '220px',
                }}
              >
                <span className="font-sans font-semibold uppercase tracking-wider" style={{ fontSize: '9px', color: 'var(--accent)' }}>
                  {hoveredCell.subject}
                </span>
                <span className="font-sans font-medium" style={{ fontSize: '12px', color: 'var(--fg)' }}>
                  {hoveredCell.day}
                </span>
                <span className="font-sans" style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                  {getLevelLabel(hoveredCell.level)}
                </span>
                <span className="font-mono" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>
                  {hoveredCell.count} queries
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        {/* Most Asked Questions (1/3) */}
        <Panel className="flex flex-col">
          <PanelHeader
            icon={HelpCircle}
            title="Top Queries"
            subtitle="Most searched syllabus questions this week"
          />
          <div className="p-5 flex flex-col gap-4 flex-1">
            {popularQuestions.map((q, idx) => (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-start gap-3">
                  <p className="font-sans leading-snug line-clamp-2" style={{ fontSize: '11px', color: 'var(--fg)', fontWeight: 500 }}>
                    {q.text}
                  </p>
                  <span className="keycap flex-shrink-0" style={{ fontSize: '9px' }}>
                    {q.count}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${q.pct}%`, background: 'var(--accent)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Learning Progress */}
        <Panel>
          <PanelHeader
            icon={TrendingUp}
            title="Learning Progress"
            subtitle="Syllabus coverage (Week 1–5)"
          />
          <div className="p-5 flex flex-col gap-3">
            <div className="w-full relative" style={{ height: '140px' }}>
              <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="progGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[20, 50, 80].map(y => (
                  <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                ))}
                <path d="M 0 95 Q 50 75 100 55 T 200 15 L 200 100 L 0 100 Z" fill="url(#progGrad)" />
                <path d="M 0 95 Q 50 75 100 55 T 200 15" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
                <circle cx="200" cy="15" r="3" fill="var(--accent)" />
              </svg>
            </div>
            <div className="flex justify-between" style={{ fontSize: '9px', color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}>
              <span>Week 1</span>
              <span className="keycap" style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>85% Complete</span>
              <span>Week 5</span>
            </div>
          </div>
        </Panel>

        {/* Grade Distribution */}
        <Panel>
          <PanelHeader
            icon={Award}
            title="Grade Distribution"
            subtitle="Class performance curve"
          />
          <div className="p-5 flex flex-col gap-3">
            <div className="w-full relative" style={{ height: '140px' }}>
              <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="bellGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--fg-3)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="var(--fg-3)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="100" y1="0" x2="100" y2="100" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2,2" />
                <path d="M 0 98 Q 50 98 100 10 Q 150 98 200 98 L 200 100 L 0 100 Z" fill="url(#bellGrad)" />
                <path d="M 0 98 Q 50 98 100 10 Q 150 98 200 98" fill="none" stroke="var(--fg-3)" strokeWidth="1.5" />
                <line x1="130" y1="40" x2="130" y2="100" stroke="var(--accent)" strokeWidth="1.5" />
                <circle cx="130" cy="40" r="3" fill="var(--accent)" />
              </svg>
            </div>
            <div className="flex justify-between" style={{ fontSize: '9px', color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}>
              <span>Fail</span>
              <div className="flex gap-2">
                <span className="keycap" style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>Your: 88%</span>
                <span className="keycap">Avg: 78%</span>
              </div>
              <span>A+</span>
            </div>
          </div>
        </Panel>

        {/* AI Usage */}
        <Panel>
          <PanelHeader
            icon={Activity}
            title="AI Usage"
            subtitle="Total queries Mon–Sun"
          />
          <div className="p-5 flex flex-col gap-3">
            <div className="w-full relative" style={{ height: '140px' }}>
              <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                {[
                  { x: 15, h: 40, o: 0.3 },
                  { x: 42, h: 60, o: 0.45 },
                  { x: 69, h: 45, o: 0.5 },
                  { x: 96, h: 80, o: 1 },
                  { x: 123, h: 70, o: 0.75 },
                  { x: 150, h: 20, o: 0.22 },
                  { x: 177, h: 30, o: 0.28 },
                ].map((b, i) => (
                  <rect key={i} x={b.x} y={100 - b.h} width="14" height={b.h} fill="var(--accent)" opacity={b.o} rx="2" />
                ))}
              </svg>
            </div>
            <div className="flex justify-between" style={{ fontSize: '9px', color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}>
              <span>Mon</span>
              <span className="keycap" style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>Peak: Thu 164</span>
              <span>Sun</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
