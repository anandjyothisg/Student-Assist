import React, { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, MoreHorizontal, Search, UserPlus, Users } from 'lucide-react';
import api, { extractErrorMessage } from '../auth/api';
import { useToast } from '../ui/Toast';
import { PageHeader } from '../ui/PageHeader';
import { Field, Input, SearchInput } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Modal, Sheet } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { fetchAll, useAsync } from './useAdminData';

const ROLE_TONE = { admin: 'accent', teacher: 'neutral', student: 'outline' };
const ROLES = [
  { id: 'all', label: 'Everyone' },
  { id: 'student', label: 'Students' },
  { id: 'teacher', label: 'Teachers' },
  { id: 'admin', label: 'Admins' },
];
const selectCls = 'field-control appearance-none !pr-9';
const ROLE_NAME = { student: 'Student', teacher: 'Teacher', admin: 'Admin' };
const ROLE_EFFECT = {
  student: 'They’ll only see the courses they’re enrolled in.',
  teacher: 'They’ll be able to manage and upload files for the courses they teach.',
  admin: 'They’ll get full access to every course, user and setting.',
};

function joined(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; }
}
function lastSeen(iso) {
  if (!iso) return 'Never signed in';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return 'Active today';
  if (d < 2) return 'Active yesterday';
  if (d < 30) return `Active ${Math.floor(d)} days ago`;
  return `Last active ${joined(iso)}`;
}
const displayName = (u) => u.full_name?.trim() || u.email.split('@')[0];
const subtitle = (u) => (u.role === 'student'
  ? [u.student_number, u.year_of_study && `Year ${u.year_of_study}`].filter(Boolean).join(' · ')
  : u.designation) || u.email;

function SelectField({ label, value, onChange, children, error }) {
  return (
    <Field label={label} error={error}>
      {(p) => (
        <div className="relative">
          <select {...p} value={value} onChange={onChange} className={selectCls}>{children}</select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
        </div>
      )}
    </Field>
  );
}

/* ─── Create user ─────────────────────────────────────────────────────── */
function NewUserDialog({ open, onClose, onCreated }) {
  const toast = useToast();
  const empty = { first_name: '', last_name: '', email: '', role: 'student', password: '', program: '', year_of_study: '', student_number: '', designation: '', department: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  React.useEffect(() => { if (open) { setForm(empty); setErrors({}); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Required.';
    if (!form.last_name.trim()) errs.last_name = 'Required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errs.email = 'Enter a valid email.';
    if (form.password.length < 8) errs.password = 'Use at least 8 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { ...form, confirm_password: form.password, year_of_study: form.year_of_study ? Number(form.year_of_study) : null };
      await api.post('/accounts/users/', body);
      toast.success(`${form.first_name} ${form.last_name} can now sign in.`);
      onCreated();
      onClose();
    } catch (err) {
      const d = err.response?.data?.error?.details || {};
      const fe = {};
      Object.entries(d).forEach(([k, v]) => { fe[k] = [].concat(v).join(' '); });
      if (Object.keys(fe).length) setErrors(fe); else toast.error(extractErrorMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Add a user" description="They can sign in immediately with the email and password you set." size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="new-user" loading={saving}>Create user</Button></>}>
      <form id="new-user" onSubmit={submit} className="flex flex-col gap-4 pt-1" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={form.first_name} onChange={set('first_name')} error={errors.first_name} data-autofocus />
          <Input label="Last name" value={form.last_name} onChange={set('last_name')} error={errors.last_name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
          <SelectField label="Role" value={form.role} onChange={set('role')} error={errors.role}>
            <option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
          </SelectField>
        </div>
        <Input label="Temporary password" revealable value={form.password} onChange={set('password')} error={errors.password} hint="Share it securely; they can change it in Settings." />
        {form.role === 'student' ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_110px_150px]">
            <Input label="Program" value={form.program} onChange={set('program')} placeholder="B.Tech CSE (AI & ML)" />
            <SelectField label="Year" value={form.year_of_study} onChange={set('year_of_study')}>
              <option value="">—</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </SelectField>
            <Input label="Student no." value={form.student_number} onChange={set('student_number')} error={errors.student_number} className="font-mono" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Designation" value={form.designation} onChange={set('designation')} placeholder="Assistant Professor" />
            <Input label="Department" value={form.department} onChange={set('department')} />
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ─── Manage one user ─────────────────────────────────────────────────── */
function UserSheet({ user, me, onClose, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  if (!user) return <Sheet isOpen={false} onClose={onClose} />;
  const isMe = user.id === me?.id;

  const patch = async (body, msg) => {
    setBusy(true);
    try {
      await api.patch(`/accounts/users/${user.id}/`, body);
      toast.success(msg);
      onChanged();
    } catch (err) { toast.error(extractErrorMessage(err)); }
    finally { setBusy(false); setConfirmDeactivate(false); setPendingRole(null); }
  };

  return (
    <Sheet isOpen={!!user} onClose={onClose} title="User" label="Manage user" width="md:w-[420px]">
      <div className="flex flex-col gap-6 p-5">
        <div className="flex items-center gap-3.5">
          <Avatar name={displayName(user)} size="xl" />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-fg">{displayName(user)}</p>
            <p className="truncate text-[13px] text-fg-3">{user.email}</p>
            <div className="mt-1.5 flex gap-1.5">
              <Badge tone={ROLE_TONE[user.role]} className="capitalize">{user.role}</Badge>
              <Badge tone={user.is_active ? 'success' : 'neutral'} dot>{user.is_active ? 'Active' : 'Deactivated'}</Badge>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          {user.role === 'student' ? (
            <>
              <div className="col-span-2"><dt className="text-fg-3">Program</dt><dd className="mt-0.5 font-medium text-fg">{user.program || '—'}</dd></div>
              <div><dt className="text-fg-3">Student no.</dt><dd className="mt-0.5 font-mono text-fg">{user.student_number || '—'}</dd></div>
              <div><dt className="text-fg-3">Year</dt><dd className="mt-0.5 font-medium text-fg">{user.year_of_study ? `Year ${user.year_of_study}` : '—'}</dd></div>
            </>
          ) : (
            <>
              <div className="col-span-2"><dt className="text-fg-3">Designation</dt><dd className="mt-0.5 font-medium text-fg">{user.designation || '—'}</dd></div>
              <div className="col-span-2"><dt className="text-fg-3">Department</dt><dd className="mt-0.5 font-medium text-fg">{user.department || '—'}</dd></div>
            </>
          )}
          <div><dt className="text-fg-3">Joined</dt><dd className="mt-0.5 font-medium text-fg">{joined(user.date_joined)}</dd></div>
          <div><dt className="text-fg-3">Activity</dt><dd className="mt-0.5 font-medium text-fg">{lastSeen(user.last_login)}</dd></div>
        </dl>

        <div className="flex flex-col gap-4 border-t border-border pt-5">
          <SelectField label="Role" value={user.role} onChange={(e) => { if (e.target.value !== user.role) setPendingRole(e.target.value); }}>
            <option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
          </SelectField>
          {isMe && <p className="-mt-2 text-xs text-fg-3">You can’t change your own role or deactivate yourself.</p>}
          {user.is_active ? (
            <Button variant="danger-ghost" disabled={isMe || busy} onClick={() => setConfirmDeactivate(true)} className="self-start">Deactivate account</Button>
          ) : (
            <Button variant="secondary" loading={busy} onClick={() => patch({ is_active: true }, 'Account reactivated.')} className="self-start">Reactivate account</Button>
          )}
        </div>
      </div>
      <Modal isOpen={confirmDeactivate} onClose={() => setConfirmDeactivate(false)} title={`Deactivate ${displayName(user)}?`} size="sm"
        description="They’ll be signed out everywhere and won’t be able to sign in until reactivated. Their data is kept."
        footer={<><Button variant="ghost" onClick={() => setConfirmDeactivate(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => patch({ is_active: false }, 'Account deactivated.')}>Deactivate</Button></>} />
      <Modal isOpen={!!pendingRole} onClose={() => setPendingRole(null)} title={`Make ${displayName(user)} ${pendingRole === 'admin' ? 'an' : 'a'} ${ROLE_NAME[pendingRole]?.toLowerCase()}?`} size="sm"
        description={ROLE_EFFECT[pendingRole]}
        footer={<><Button variant="ghost" onClick={() => setPendingRole(null)}>Cancel</Button><Button loading={busy} onClick={() => patch({ role: pendingRole }, `Role changed to ${ROLE_NAME[pendingRole]}.`)}>Change role</Button></>} />
    </Sheet>
  );
}

export function AdminUsers({ user: me }) {
  const { data, state, reload } = useAsync(() => fetchAll('/accounts/users/'), []);
  const users = useMemo(() => data || [], [data]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [asc, setAsc] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = users.find((u) => u.id === selectedId) || null;

  const counts = useMemo(() => users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, { all: users.length }), [users]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => role === 'all' || u.role === role)
      .filter((u) => !q || `${displayName(u)} ${u.email} ${u.student_number || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (asc ? 1 : -1) * displayName(a).localeCompare(displayName(b)));
  }, [users, query, role, asc]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Users" description="Everyone with an account, the role they sign in with, and whether the account is active."
        actions={<Button iconLeft={UserPlus} onClick={() => setCreating(true)}>Add user</Button>} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Filter by role" className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none">
            {ROLES.map((r) => (
              <button key={r.id} role="tab" aria-selected={role === r.id} onClick={() => setRole(r.id)}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors ${role === r.id ? 'bg-subtle text-fg' : 'text-fg-3 hover:text-fg'}`}>
                {r.label}{state === 'ready' && <span className="tabular text-fg-3">{counts[r.id] || 0}</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <SearchInput icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or student no." aria-label="Search users" className="min-w-0 flex-1 lg:w-72" />
            <Button variant="secondary" iconLeft={asc ? ArrowDownAZ : ArrowUpZA} onClick={() => setAsc((v) => !v)} aria-label={`Sort by name, ${asc ? 'A to Z' : 'Z to A'}`}>
              <span className="hidden sm:inline">Name</span>
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {state === 'loading' && !data ? (
            <ul className="divide-y divide-border">{Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3.5"><Skeleton className="size-8" rounded /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3.5" width="30%" /><Skeleton className="h-3" width="45%" /></div></li>
            ))}</ul>
          ) : state === 'error' ? (
            <ErrorState title="Couldn’t load users" description="You may not have permission, or the server is unreachable." onRetry={reload} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Users} compact title="No matching users" description="Try a different name, email or role." />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((u) => (
                <li key={u.id}>
                  <button onClick={() => setSelectedId(u.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle/50 focus-visible:outline-offset-[-2px]">
                    <Avatar name={displayName(u)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-fg">{displayName(u)}{u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-fg-3">(you)</span>}</p>
                      <p className="truncate text-[12.5px] text-fg-3">{u.email}</p>
                    </div>
                    <span className="hidden w-48 truncate text-[12.5px] text-fg-3 lg:block">{subtitle(u)}</span>
                    <span className="hidden w-36 text-[12.5px] text-fg-3 md:block">{lastSeen(u.last_login)}</span>
                    <span className="hidden sm:contents"><Badge tone={ROLE_TONE[u.role]} className="capitalize">{u.role}</Badge></span>
                    <Badge tone={u.is_active ? 'success' : 'neutral'} dot>{u.is_active ? 'Active' : 'Deactivated'}</Badge>
                    <MoreHorizontal className="size-4 shrink-0 text-fg-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state !== 'error' && data && (
            <div className="border-t border-border px-4 py-2.5 text-xs text-fg-3">Showing <span className="tabular">{rows.length}</span> of <span className="tabular">{users.length}</span></div>
          )}
        </div>
      </section>

      <NewUserDialog open={creating} onClose={() => setCreating(false)} onCreated={reload} />
      <UserSheet user={selected} me={me} onClose={() => setSelectedId(null)} onChanged={reload} />
    </div>
  );
}
