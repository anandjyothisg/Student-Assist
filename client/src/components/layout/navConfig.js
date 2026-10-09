/**
 * navConfig.js — single source of truth for role-based navigation.
 * The sidebar, mobile tab bar, command palette and route guard all read from here.
 */

import {
  MessageCircle,   // Ask
  BookOpen,        // Sources
  GraduationCap,   // Courses
  NotebookPen,     // Notebook
  FolderOpen,      // Content
  BarChart2,       // Insights
  Activity,        // Status
  Users,           // Users
  Layers,          // Catalog
} from 'lucide-react';

export const NAV_ITEMS = {
  student: [
    { id: 'ask',      label: 'Ask',      icon: MessageCircle, tab: 'assistant', description: 'Ask questions about your course materials' },
    { id: 'sources',  label: 'Sources',  icon: BookOpen,      tab: 'documents', description: 'Browse and read course materials' },
    { id: 'courses',  label: 'Courses',  icon: GraduationCap, tab: 'courses',   description: 'Your courses and the course catalog' },
    { id: 'notebook', label: 'Notebook', icon: NotebookPen,   tab: 'notebook',  description: 'Saved answers and flashcards' },
  ],
  teacher: [
    { id: 'content',  label: 'Content',  icon: FolderOpen,    tab: 'academic',  description: 'Your courses, units, topics and materials' },
    { id: 'insights', label: 'Insights', icon: BarChart2,     tab: 'analytics', description: 'What your students are asking' },
    { id: 'ask',      label: 'Ask',      icon: MessageCircle, tab: 'assistant', description: 'Check answers grounded in your materials' },
  ],
  admin: [
    { id: 'status',   label: 'Status',   icon: Activity,      tab: 'dashboard', description: 'Platform health and activity' },
    { id: 'users',    label: 'Users',    icon: Users,         tab: 'accounts',  description: 'People, roles and access' },
    { id: 'catalog',  label: 'Catalog',  icon: Layers,        tab: 'academic',  description: 'Subjects, courses and teachers' },
    { id: 'insights', label: 'Insights', icon: BarChart2,     tab: 'analytics', description: 'Assistant usage across every course' },
    { id: 'ask',      label: 'Ask',      icon: MessageCircle, tab: 'assistant', description: 'Query the whole course library' },
  ],
};

export function getDefaultTab(role) {
  const items = NAV_ITEMS[role];
  if (!items || items.length === 0) return 'assistant';
  return items[0].tab;
}

export function getNavIdFromTab(role, tab) {
  const items = NAV_ITEMS[role] ?? [];
  return items.find((i) => i.tab === tab)?.id ?? items[0]?.id ?? '';
}

export function isTabAllowedForRole(role, tab) {
  const items = NAV_ITEMS[role];
  return !!items && items.some((i) => i.tab === tab);
}

/* ─── Hash routes: #/tab?key=value ─────────────────────────────────────────── */

export function readRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { tab: path.split('/')[0] || null, params: Object.fromEntries(new URLSearchParams(query)) };
}

export function routeHref(tab, params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return `#/${tab}${q ? `?${q}` : ''}`;
}

/** Navigate within the app (pushes history; App listens to hashchange). */
export function navigate(tab, params = {}) {
  const next = routeHref(tab, params);
  if (window.location.hash !== next) window.location.hash = next;
}

/** Replace the current route's params without adding a history entry. */
export function replaceParams(params = {}) {
  const { tab } = readRoute();
  if (!tab) return;
  window.history.replaceState(null, '', routeHref(tab, params));
  window.dispatchEvent(new Event('routechange'));
}
