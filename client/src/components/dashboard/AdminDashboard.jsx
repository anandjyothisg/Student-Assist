import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, FileText, Layers, RefreshCw, Users } from 'lucide-react';
import api from '../auth/api';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { fetchAll, useAsync } from '../admin/useAdminData';

async function timed(fn) {
  const t = performance.now();
  try { await fn(); return { ok: true, ms: Math.round(performance.now() - t) }; }
  catch { return { ok: false, ms: Math.round(performance.now() - t) }; }
}

async function loadStatus() {
  const [health, auth, users, courses, docs] = await Promise.all([
    api.get('/ai/health/', { params: { refresh: 'true' } }).then((r) => r.data).catch(() => null),
    timed(() => api.get('/auth/me/')),
    fetchAll('/accounts/users/'),
    fetchAll('/academic/courses/'),
    timed(() => api.get('/documents/', { params: { page_size: 1 } })),
  ]);
  const allDocs = await fetchAll('/documents/');
  return { health, auth, docsProbe: docs, users, courses, docs: allDocs, checkedAt: new Date() };
}

const STATE = {
  completed: { label: 'Ready', bar: 'bg-success', tone: 'success' },
  pending: { label: 'Queued', bar: 'bg-fg-3', tone: 'neutral' },
  processing: { label: 'Processing', bar: 'bg-warning', tone: 'warning' },
  failed: { label: 'Failed', bar: 'bg-error', tone: 'error' },
};

function Stat({ label, value, detail, icon: Icon }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <dt className="flex items-center gap-1.5 text-[13px] text-fg-3"><Icon className="size-3.5" aria-hidden />{label}</dt>
      <dd className="text-[28px] font-semibold leading-tight tracking-tight tabular text-fg">{value}</dd>
      {detail && <dd className="truncate text-xs text-fg-3">{detail}</dd>}
    </div>
  );
}

function ServiceRow({ name, status, detail }) {
  const map = {
    ok: { Icon: CheckCircle2, cls: 'text-success', label: 'Operational' },
    warn: { Icon: AlertTriangle, cls: 'text-warning', label: 'Attention' },
    down: { Icon: AlertTriangle, cls: 'text-error', label: 'Unreachable' },
    unknown: { Icon: CircleDashed, cls: 'text-fg-3', label: 'Not monitored' },
  }[status];
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <map.Icon className={`size-4 shrink-0 ${map.cls}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-fg">{name}</p>
        <p className="truncate text-xs text-fg-3">{detail}</p>
      </div>
      <span className={`shrink-0 text-[13px] font-medium ${map.cls}`}>{map.label}</span>
    </li>
  );
}

export function AdminDashboard({ setActiveTab }) {
  const { data, state, reload } = useAsync(loadStatus, []);

  const byRole = (data?.users || []).reduce((a, u) => { a[u.role] = (a[u.role] || 0) + 1; return a; }, {});
  const docCounts = (data?.docs || []).reduce((a, d) => { a[d.processing_status] = (a[d.processing_status] || 0) + 1; return a; }, {});
  const totalDocs = data?.docs.length || 0;
  const attention = (data?.docs || []).filter((d) => d.processing_status === 'failed' || d.processing_status === 'pending').slice(0, 5);
  const published = (data?.courses || []).filter((c) => c.is_published).length;
  const queued = (docCounts.pending || 0) + (docCounts.processing || 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Status"
        description="Live counts and health checks for the workspace, measured from your browser."
        actions={
          <>
            <Button variant="secondary" iconLeft={RefreshCw} onClick={reload} loading={state === 'loading'}>Refresh</Button>
            <Button iconLeft={Users} onClick={() => setActiveTab?.('accounts')}>Manage users</Button>
          </>
        }
      />

      {state === 'error' ? (
        <div className="rounded-lg border border-border bg-surface">
          <ErrorState title="Couldn’t load workspace status" description="The API didn’t respond. Check that the server is running." onRetry={reload} />
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4 [&>*]:bg-surface">
            {state === 'loading' ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 px-5 py-4"><Skeleton className="h-3.5" width="50%" /><Skeleton className="h-7" width="40%" /><Skeleton className="h-3" width="70%" /></div>
              ))
            ) : (
              <>
                <Stat icon={Users} label="Users" value={data.users.length} detail={`${byRole.student || 0} students · ${byRole.teacher || 0} teachers · ${byRole.admin || 0} admins`} />
                <Stat icon={Layers} label="Courses" value={data.courses.length} detail={`${published} published · ${data.courses.length - published} ${data.courses.length - published === 1 ? 'draft' : 'drafts'}`} />
                <Stat icon={FileText} label="Documents" value={totalDocs} detail={`${docCounts.completed || 0} ready to answer from`} />
                <Stat icon={RefreshCw} label="Indexing queue" value={queued} detail={docCounts.failed ? `${docCounts.failed} failed` : 'No failures'} />
              </>
            )}
          </dl>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-3" aria-labelledby="services-h">
              <div className="flex items-baseline justify-between">
                <h2 id="services-h" className="text-[15px] font-semibold text-fg">Services</h2>
                {data && <span className="text-xs text-fg-3">Checked {data.checkedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {state === 'loading' ? (
                  Array.from({ length: 4 }).map((_, i) => <li key={i} className="px-5 py-4"><Skeleton className="h-4" width={`${60 - i * 8}%`} /></li>)
                ) : (
                  <>
                    <ServiceRow name="API" status={data.docsProbe.ok ? (data.docsProbe.ms > 1500 ? 'warn' : 'ok') : 'down'} detail={`Document list responded in ${data.docsProbe.ms} ms`} />
                    <ServiceRow name="Authentication" status={data.auth.ok ? 'ok' : 'down'} detail={`Session check responded in ${data.auth.ms} ms`} />
                    <ServiceRow
                      name="Document processing"
                      status={docCounts.failed ? 'warn' : queued && !docCounts.processing ? 'warn' : 'ok'}
                      detail={queued ? `${queued} waiting to be indexed` : 'Every upload is indexed'}
                    />
                    <ServiceRow
                      name={`Language model (${data.health?.llm?.model || 'Ollama'})`}
                      status={!data.health ? 'unknown' : data.health.ready ? 'ok' : 'down'}
                      detail={!data.health ? 'Health endpoint unavailable' : data.health.ready
                        ? (data.health.llm.loaded ? 'Loaded in memory and ready to answer' : 'Available — loads on the first question')
                        : data.health.llm.error}
                    />
                    <ServiceRow
                      name="Vector store"
                      status={!data.health?.vector_store ? 'unknown' : data.health.vector_store.vectors > 0 ? 'ok' : 'warn'}
                      detail={data.health?.vector_store
                        ? `${data.health.vector_store.vectors.toLocaleString()} passages across ${data.health.vector_store.collections} course indexes · ${data.health.embedding_model}`
                        : 'Unavailable'}
                    />
                  </>
                )}
              </ul>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="index-h">
              <h2 id="index-h" className="text-[15px] font-semibold text-fg">Index health</h2>
              <div className="rounded-lg border border-border bg-surface p-5">
                {state === 'loading' ? (
                  <div className="flex flex-col gap-3"><Skeleton className="h-2.5" /><Skeleton className="h-3" width="60%" /></div>
                ) : totalDocs === 0 ? (
                  <p className="text-[13px] text-fg-3">No documents have been uploaded yet.</p>
                ) : (
                  <>
                    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={Object.entries(docCounts).map(([k, v]) => `${v} ${STATE[k]?.label || k}`).join(', ')}>
                      {['completed', 'processing', 'pending', 'failed'].filter((k) => docCounts[k]).map((k) => (
                        <span key={k} title={`${STATE[k].label}: ${docCounts[k]}`} className={`${STATE[k].bar} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(docCounts[k] / totalDocs) * 100}%` }} />
                      ))}
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
                      {['completed', 'processing', 'pending', 'failed'].map((k) => (
                        <li key={k} className="flex items-center gap-2 text-fg-2">
                          <span aria-hidden className={`size-2 rounded-full ${STATE[k].bar}`} />
                          {STATE[k].label}
                          <span className="tabular font-medium text-fg">{docCounts[k] || 0}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {state === 'ready' && attention.length > 0 && (
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="mb-2 text-xs font-medium text-fg-3">Needs attention</p>
                    <ul className="flex flex-col gap-2">
                      {attention.map((d) => (
                        <li key={d.id} className="flex items-center gap-3 text-[13px]">
                          <FileText className="size-3.5 shrink-0 text-fg-3" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-fg">{d.title}</span>
                          <span className="hidden font-mono text-[11px] text-fg-3 sm:inline">{d.course_code}</span>
                          <Badge tone={STATE[d.processing_status]?.tone}>{STATE[d.processing_status]?.label}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button onClick={() => setActiveTab?.('academic')} className="inline-flex w-fit items-center gap-1.5 rounded-sm text-[13px] font-medium text-fg-2 transition-colors hover:text-fg">
                Browse subjects and courses <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
