import React from 'react';
import { LogOut, Settings, Sun, Moon, Monitor } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { useTheme } from '../ui/Theme';

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export function ThemeSegmented({ className = '' }) {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={`grid grid-cols-3 gap-1 rounded-md bg-subtle p-1 ${className}`}>
      {THEMES.map(({ id, label, icon: Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(id)}
            className={[
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-sm text-[12.5px] font-medium transition-colors',
              active ? 'bg-surface text-fg shadow-xs' : 'text-fg-3 hover:text-fg',
            ].join(' ')}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Shared account summary + actions, rendered inside a popover (desktop) or sheet (mobile). */
export function AccountMenu({ user, onOpenSettings, onLogout, onClose }) {
  const name = user?.username || 'Your account';
  const item =
    'flex w-full items-center gap-3 rounded-md px-3 min-h-10 text-[13.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3.5">
        <Avatar name={name} src={user?.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{name}</p>
          {user?.email && <p className="truncate text-[12.5px] text-fg-3">{user.email}</p>}
        </div>
        <Badge tone="accent" className="capitalize">{user?.role || 'student'}</Badge>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="mb-2 text-xs font-medium text-fg-3">Appearance</p>
        <ThemeSegmented />
      </div>

      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        <button
          className={`${item} text-fg-2 hover:bg-subtle hover:text-fg`}
          onClick={() => { onClose?.(); onOpenSettings?.(); }}
        >
          <Settings className="size-4 text-fg-3" aria-hidden />
          Settings
        </button>
        <button
          className={`${item} text-error hover:bg-error-dim`}
          onClick={() => { onClose?.(); onLogout?.(); }}
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );
}
