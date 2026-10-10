import React, { useEffect, useState } from 'react';
import { User, Lock, Palette, Monitor, LogOut } from 'lucide-react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from '../auth/api';
import { STRONG_PASSWORD } from '../auth/AuthLayout';
import { PasswordChecklist } from '../auth/Register';
import { ThemeSegmented } from './AccountMenu';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'session', label: 'Session', icon: Monitor },
];

const MIN_PASSWORD = 8; // mirrors the backend serializer (min_length=8)

function Section({ title, description, children }) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function describeDevice() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

export function SettingsPanel({ user, onLogout, onUpdateUser }) {
  const toast = useToast();
  const [tab, setTab] = useState('profile');

  const [name, setName] = useState(user?.username || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => { setName(user?.username || ''); }, [user?.username]);

  const nameChanged = name.trim() && name.trim() !== (user?.username || '');

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      const parts = name.trim().split(/\s+/);
      await mockAuthApi.updateProfile(parts[0] || '', parts.slice(1).join(' '));
      onUpdateUser?.({ ...user, username: name.trim() });
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(err.message || 'Couldn’t save your profile. Try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pw.current) errs.current = 'Enter your current password.';
    if (pw.next.length < MIN_PASSWORD) errs.next = `Use at least ${MIN_PASSWORD} characters.`;
    else if (!STRONG_PASSWORD.test(pw.next)) errs.next = 'Include upper and lowercase letters and a number.';
    if (pw.confirm !== pw.next) errs.confirm = 'Passwords don’t match.';
    setPwErrors(errs);
    if (Object.keys(errs).length) return;

    setSavingPw(true);
    try {
      await mockAuthApi.changePassword(pw.current, pw.next, pw.confirm);
      toast.success('Password updated.');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.message || 'Couldn’t change your password. Try again.');
    } finally {
      setSavingPw(false);
    }
  };

  const setField = (k) => (e) => {
    setPw((p) => ({ ...p, [k]: e.target.value }));
    if (pwErrors[k]) setPwErrors((p) => ({ ...p, [k]: undefined }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 md:flex-row md:gap-8">
      <nav
        aria-label="Settings sections"
        className="-mx-1 flex shrink-0 gap-1 overflow-x-auto scrollbar-none md:mx-0 md:w-44 md:flex-col md:overflow-visible"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={[
                'inline-flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-[13.5px] font-medium transition-colors',
                active ? 'bg-subtle text-fg' : 'text-fg-3 hover:bg-subtle/70 hover:text-fg',
              ].join(' ')}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 animate-fade-in" key={tab}>
        {tab === 'profile' && (
          <Section title="Profile" description="Your name appears in the sidebar and on content you share.">
            <div className="flex items-center gap-3.5 rounded-lg border border-border bg-subtle/50 p-3.5">
              <Avatar name={name || user?.email} src={user?.avatar} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{name || 'Unnamed'}</p>
                <p className="truncate text-[12.5px] text-fg-3">{user?.email}</p>
                {(user?.program || user?.designation) && (
                  <p className="mt-0.5 truncate text-[12.5px] text-fg-3">
                    {user.role === 'student'
                      ? [user.program, user.yearOfStudy && `Year ${user.yearOfStudy}`, user.studentNumber].filter(Boolean).join(' · ')
                      : [user.designation, user.department].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <Badge tone="accent" className="ml-auto capitalize">{user?.role}</Badge>
            </div>
            <form onSubmit={saveProfile} className="flex flex-col gap-4">
              <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              <Input label="Email" value={user?.email || ''} disabled readOnly hint="Managed by your institution." />
              <div>
                <Button type="submit" loading={savingProfile} disabled={!nameChanged}>Save changes</Button>
              </div>
            </form>
          </Section>
        )}

        {tab === 'appearance' && (
          <Section title="Appearance" description="Choose a theme, or follow your device setting.">
            <ThemeSegmented className="max-w-sm" />
          </Section>
        )}

        {tab === 'password' && (
          <Section title="Password" description={`Use at least ${MIN_PASSWORD} characters. Avoid common words and reused passwords.`}>
            <form onSubmit={savePassword} className="flex flex-col gap-4" noValidate>
              <Input label="Current password" revealable autoComplete="current-password" value={pw.current} onChange={setField('current')} error={pwErrors.current} />
              <div className="flex flex-col gap-2">
                <Input label="New password" revealable autoComplete="new-password" value={pw.next} onChange={setField('next')} error={pwErrors.next} aria-describedby="settings-pw-rules" />
                <PasswordChecklist id="settings-pw-rules" value={pw.next} />
              </div>
              <Input label="Confirm new password" revealable autoComplete="new-password" value={pw.confirm} onChange={setField('confirm')} error={pwErrors.confirm} />
              <div>
                <Button type="submit" loading={savingPw}>Update password</Button>
              </div>
            </form>
          </Section>
        )}

        {tab === 'session' && (
          <Section title="Session" description="You're signed in on this device. Signing out clears your session here.">
            <div className="flex items-center gap-3.5 rounded-lg border border-border p-3.5">
              <span className="inline-flex size-9 items-center justify-center rounded-md bg-subtle text-fg-2">
                <Monitor className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{describeDevice()}</p>
                <p className="text-[12.5px] text-fg-3">This device</p>
              </div>
              <Badge tone="success" dot>Active</Badge>
            </div>
            <div>
              <Button variant="danger-ghost" iconLeft={LogOut} onClick={onLogout} className="-ml-3">Sign out</Button>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
