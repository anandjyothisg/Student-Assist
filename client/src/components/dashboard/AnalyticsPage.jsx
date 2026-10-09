import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart2, ChevronDown, MessageCircleQuestion, SearchX } from 'lucide-react';
import api from '../auth/api';
import { PageHeader } from '../ui/PageHeader';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';

/*
 * Insights — computed by the backend from stored student conversations
 * (GET /api/v1/ai/insights/). Teachers see their own courses; admins see all.
 */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pct(v) { return v == null ? '—' : `${Math.round(v * 100)}%`; }

function Panel({ title, description, children, className = '', aside }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-border bg-surface ${className}`}>
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-fg-3">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="flex flex-1 flex-col px-5 pb-5">{children}</div>
    </section>
  );
}

function Kpi({ label, value, detail }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-surface px-4 py-4 sm:px-5">
      <dt className="truncate text-[13px] text-fg-3">{label}</dt>
      <dd className="text-[24px] font-semibold leading-tight tracking-tight tabular text-fg sm:text-[28px]">{value}</dd>
      {detail && <dd className="truncate text-xs text-fg-3">{detail}</dd>}
    </div>
  );
}

function Heatmap({ rows }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.flatMap((r) => r.counts));
  const cell = (v) => (v ? { background: `color-mix(in srgb, var(--accent) ${Math.round(14 + (v / max) * 86)}%, var(--bg-subtle))` } : { background: 'var(--bg-subtle)' });
  if (!rows.length) return <p className="text-[13px] text-fg-3">No questions in this period.</p>;
  return (
    <div>
      <table className="w-full table-fixed border-separate border-spacing-1 text-[12.5px]">
        <caption className="sr-only">Questions per course and weekday</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[5.5rem] sm:w-28"><span className="sr-only">Course</span></th>
            {DAYS.map((d) => (
              <th key={d} scope="col" className="pb-1 text-center text-xs font-medium text-fg-3">
                <span className="sm:hidden" aria-hidden>{d[0]}</span><span className="max-sm:sr-only">{d}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.course_code}>
              <th scope="row" className="truncate pr-2 text-left font-mono text-[11.5px] font-medium text-fg-2">{r.course_code}</th>
              {r.counts.map((v, c) => (
                <td key={c} className="p-0">
                  <button
                    onMouseEnter={() => setHover({ r: r.course_code, c, v })} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ r: r.course_code, c, v })} onBlur={() => setHover(null)}
                    aria-label={`${r.course_code}, ${DAYS[c]}: ${v} questions`}
                    className={`block h-8 w-full rounded-sm outline-none sm:h-9 ${hover?.r === r.course_code && hover?.c === c ? 'ring-2 ring-fg ring-offset-1 ring-offset-surface' : ''}`}
                    style={cell(v)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-fg-3">
        <div className="flex items-center gap-2" aria-hidden>
          <span>Fewer</span>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => <span key={t} className="h-2.5 w-5 rounded-xs" style={cell(Math.round(t * max))} />)}
          <span>More</span>
        </div>
        <p className="tabular" aria-live="polite">
          {hover ? <><span className="font-medium text-fg">{hover.r}</span> · {DAYS[hover.c]} · <span className="font-medium text-fg">{hover.v}</span> questions</> : 'Hover a cell for details'}
        </p>
      </div>
    </div>
  );
}

function DailyBars({ daily }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...daily.map((d) => d.count));
  const label = (iso, short) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, short ? { weekday: 'narrow' } : { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 h-4 text-xs text-fg-3 tabular" aria-live="polite">
        {hover != null ? <><span className="font-medium text-fg">{daily[hover].count}</span> questions · {label(daily[hover].date)}</> : `${daily.reduce((n, d) => n + d.count, 0)} questions in the last ${daily.length} days`}
      </p>
      <div className="flex min-h-36 flex-1 items-end gap-1 border-b border-border" role="list" aria-label="Questions per day">
        {daily.map((d, i) => (
          <div key={d.date} role="listitem" className="flex h-full flex-1 flex-col justify-end">
            <button
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              aria-label={`${label(d.date)}: ${d.count} questions`}
              className={`w-full rounded-t-[3px] outline-none transition-colors ${hover === i ? 'bg-fg' : 'bg-accent/70'}`}
              style={{ height: `${d.count ? Math.max(4, (d.count / max) * 100) : 1.5}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {daily.map((d) => <span key={d.date} className="flex-1 text-center text-[10.5px] text-fg-3">{label(d.date, true)}</span>)}
      </div>
    </div>
  );
}

export function AnalyticsPage({ user }) {
  const [course, setCourse] = useState('');
  const [days, setDays] = useState(28);
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [courseOptions, setCourseOptions] = useState([]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await api.get('/ai/insights/', { params: { course: course || undefined, days } });
      setData(res.data);
      if (!course) setCourseOptions(res.data.courses);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [course, days]);
  useEffect(() => { load(); }, [load]);

  const t = data?.totals;
  const perCourse = useMemo(() => (data?.per_course || []).slice().sort((a, b) => b.questions - a.questions), [data]);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Insights"
        description={isAdmin ? 'How students use the assistant across every course — computed from real conversations.' : 'What your students ask, when they study, and where your materials leave gaps.'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative inline-flex items-center">
              <span className="sr-only">Course</span>
              <select value={course} onChange={(e) => setCourse(e.target.value)} className="h-9 max-w-[16rem] appearance-none truncate rounded-md border border-border bg-surface pr-8 pl-3 text-[13px] font-medium text-fg hover:border-border-strong">
                <option value="">{isAdmin ? 'All courses' : 'All my courses'}</option>
                {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-fg-3" aria-hidden />
            </label>
            <div role="radiogroup" aria-label="Period" className="flex rounded-md bg-subtle p-0.5">
              {[7, 28, 90].map((d) => (
                <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)}
                  className={`h-8 rounded-sm px-2.5 text-[12.5px] font-medium transition-colors ${days === d ? 'bg-surface text-fg shadow-xs' : 'text-fg-3 hover:text-fg'}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>
        }
      />

      {state === 'loading' && !data ? (
        <div className="flex flex-col gap-6"><Skeleton className="h-28 !rounded-lg" /><div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-72 !rounded-lg" /><Skeleton className="h-72 !rounded-lg" /></div></div>
      ) : state === 'error' ? (
        <div className="rounded-lg border border-border bg-surface"><ErrorState title="Couldn’t load insights" onRetry={load} /></div>
      ) : t.questions === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong">
          <EmptyState icon={BarChart2} title="No questions yet" description={`Nothing has been asked in ${course ? 'this course' : 'your courses'} in the last ${days} days. Insights appear as students use the assistant.`} />
        </div>
      ) : (
        <div className={`flex flex-col gap-6 transition-opacity ${state === 'loading' ? 'opacity-60' : ''}`}>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
            <Kpi label="Questions asked" value={t.questions} detail={`last ${data.period_days} days`} />
            <Kpi label="Active students" value={t.active_students} detail="asked at least one question" />
            <Kpi label="Answered from materials" value={pct(t.answered_rate)} detail={`${t.answered} of ${t.questions} questions`} />
            <Kpi label="Not covered by materials" value={t.not_found} detail={`${t.saved_answers} answers saved to notebooks`} />
          </dl>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <Panel title="When students ask" description="Questions by course and weekday">
              <Heatmap rows={data.heatmap} />
            </Panel>
            <Panel title="Daily questions" description="Selected courses, most recent days">
              <DailyBars daily={data.daily} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel title="Most asked" description="Questions students ask most often">
              {data.top_questions.length ? (
                <ol className="flex flex-col divide-y divide-border">
                  {data.top_questions.map((q, i) => (
                    <li key={q.question} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="w-5 shrink-0 text-right font-mono text-xs tabular text-fg-3">{i + 1}</span>
                      <p className="min-w-0 flex-1 text-[14px] text-fg">{q.question}</p>
                      <span className="shrink-0 font-mono text-[11px] text-fg-3">{q.course_code}</span>
                      <span className="w-6 shrink-0 text-right text-[14px] font-semibold tabular text-fg">{q.count}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-[13px] text-fg-3">No questions yet.</p>}
            </Panel>

            <Panel title="Gaps in the materials" description="Recent questions the assistant couldn’t answer from your documents"
              aside={<MessageCircleQuestion className="size-4 shrink-0 text-fg-3" aria-hidden />}>
              {data.unanswered.length ? (
                <ul className="flex flex-col gap-2">
                  {data.unanswered.map((q, i) => (
                    <li key={`${q.question}-${i}`} className="flex items-start gap-3 rounded-md bg-subtle/60 px-3.5 py-2.5">
                      <SearchX className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] text-fg">{q.question}</p>
                        <p className="mt-0.5 text-xs text-fg-3">{q.course_code} · {new Date(q.asked_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-fg-3">Every question in this period was answered from the materials.</p>}
            </Panel>
          </div>

          <Panel title="By course" description="Activity and how often answers came from the materials">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13.5px]">
                <thead className="border-y border-border bg-subtle/60 text-xs text-fg-3">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Course</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Questions</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Students</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Answered from materials</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Materials</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {perCourse.map((c) => (
                    <tr key={c.course_id}>
                      <td className="px-5 py-3"><Badge tone="accent" mono>{c.course_code}</Badge> <span className="ml-2 text-fg">{c.course_title}</span></td>
                      <td className="px-3 py-3 text-right font-medium tabular text-fg">{c.questions}</td>
                      <td className="px-3 py-3 text-right tabular text-fg-2">{c.students}</td>
                      <td className="px-3 py-3">
                        {c.answered_rate == null ? <span className="text-fg-3">—</span> : (
                          <div className="flex items-center gap-2.5">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-subtle" role="meter" aria-valuenow={Math.round(c.answered_rate * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.course_code} answered rate`}>
                              <div className={`h-full rounded-full ${c.answered_rate < 0.6 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${c.answered_rate * 100}%` }} />
                            </div>
                            <span className="tabular text-fg-2">{pct(c.answered_rate)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular text-fg-2">{c.documents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
