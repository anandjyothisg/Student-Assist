/**
 * navConfig.js — Single source of truth for all role-based navigation.
 *
 * Blueprint nav spec:
 *   Student:  Ask | Sources | Notebook | Account
 *   Teacher:  Content | Insights | Account
 *   Admin:    Status | Users | Subjects | Account
 *
 * "Account" is NOT a page. It opens the Account slide-over from the avatar.
 * It is listed here so mobile tab bars can render it correctly, but the
 * shell treats it as a special action, not a route.
 */

import {
  MessageCircle,   // Ask
  BookOpen,        // Sources
  NotebookPen,     // Notebook
  FolderOpen,      // Content
  BarChart2,       // Insights
  Activity,        // Status
  Users,           // Users
  Layers,          // Subjects
  UserCircle,      // Account
} from 'lucide-react';

/** @type {Record<string, import('./navConfig').NavItem[]>} */
export const NAV_ITEMS = {
  student: [
    { id: 'ask',      label: 'Ask',      icon: MessageCircle, tab: 'assistant' },
    { id: 'sources',  label: 'Sources',  icon: BookOpen,      tab: 'documents' },
    { id: 'notebook', label: 'Notebook', icon: NotebookPen,   tab: 'notebook'  },
  ],
  teacher: [
    { id: 'content',  label: 'Content',  icon: FolderOpen,    tab: 'academic'  },
    { id: 'insights', label: 'Insights', icon: BarChart2,      tab: 'analytics' },
  ],
  admin: [
    { id: 'status',   label: 'Status',   icon: Activity,      tab: 'dashboard' },
    { id: 'users',    label: 'Users',    icon: Users,         tab: 'accounts'  },
    { id: 'subjects', label: 'Subjects', icon: Layers,        tab: 'academic'  },
  ],
};

/**
 * Returns the default (first) tab ID for a given role.
 */
export function getDefaultTab(role) {
  const items = NAV_ITEMS[role];
  if (!items || items.length === 0) return 'dashboard';
  return items[0].tab;
}

/**
 * Resolves the nav item ID from a tab string.
 */
export function getNavIdFromTab(role, tab) {
  const items = NAV_ITEMS[role] ?? [];
  return items.find((i) => i.tab === tab)?.id ?? items[0]?.id ?? '';
}
