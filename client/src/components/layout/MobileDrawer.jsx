import React, { useState } from 'react';
import { NAV_ITEMS } from './navConfig';
import { Avatar } from '../ui/Avatar';
import { Sheet } from '../ui/Modal';
import { AccountMenu } from './AccountMenu';

/** Bottom tab bar for phones. Account opens a bottom sheet rather than a page. */
export function MobileNav({ activeTab, setActiveTab, user, onLogout, onOpenSettings }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const role = user?.role ?? 'student';
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student;

  const tab =
    'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent';

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-canvas/95 pb-safe backdrop-blur-md md:hidden"
        style={{ zIndex: 'var(--z-nav)' }}
      >
        <div className="mx-auto flex h-[var(--mobile-nav-h)] max-w-lg items-stretch px-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.tab;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.tab)}
                aria-current={active ? 'page' : undefined}
                className={`${tab} ${active ? 'text-fg' : 'text-fg-3 active:text-fg'}`}
              >
                {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-accent" />}
                <Icon className="size-[21px]" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
                <span className={active ? 'font-semibold' : ''}>{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setAccountOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            className={`${tab} text-fg-3`}
          >
            <Avatar name={user?.username || user?.email} src={user?.avatar} size="xs" />
            <span>Account</span>
          </button>
        </div>
      </nav>

      <Sheet isOpen={accountOpen} onClose={() => setAccountOpen(false)} label="Account">
        <AccountMenu
          user={user}
          onLogout={onLogout}
          onOpenSettings={onOpenSettings}
          onClose={() => setAccountOpen(false)}
        />
      </Sheet>
    </>
  );
}
