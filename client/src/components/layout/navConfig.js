/**
 * navConfig.js — single source of truth for role-based navigation.
 * The sidebar, mobile tab bar, command palette and route guard all read from here.
 */

import {
  House,           // Home
  MessageCircle,   // AI Assistant
  BookOpen,        // Study Materials
  GraduationCap,   // My Courses
  NotebookPen,     // Notebook
  FolderOpen,      // My Courses (teacher)
  BarChart2,       // Class Insights
  Activity,        // System Status
  Users,           // Users
  Layers,          // Courses (admin)
} from 'lucide-react';

/*
 * Labels are what people see; `tab` is the internal route id (#/tab) and stays
 * stable so bookmarks and links keep working.
 */
export const NAV_ITEMS = {
  student: [
    { id: 'home',      label: 'Home',            icon: House,         tab: 'home',      description: 'Start here: ask, continue a chat or open your materials' },
    { id: 'assistant', label: 'AI Assistant',    short: 'Assistant', icon: MessageCircle, tab: 'assistant', description: 'Ask questions about your course materials' },
    { id: 'materials', label: 'Study Materials', short: 'Materials', icon: BookOpen,      tab: 'documents', description: 'Read the notes and files from your courses' },
    { id: 'courses',   label: 'My Courses',      short: 'Courses', icon: GraduationCap, tab: 'courses',   description: 'Your courses, and others you can join' },
    { id: 'notebook',  label: 'Notebook',        icon: NotebookPen,   tab: 'notebook',  description: 'Saved answers and flashcards' },
  ],
  teacher: [
    { id: 'courses',   label: 'My Courses',      short: 'Courses', icon: FolderOpen,    tab: 'academic',  description: 'Your courses, topics and files' },
    { id: 'insights',  label: 'Class Insights',  short: 'Insights', icon: BarChart2,     tab: 'analytics', description: 'What your students are asking' },
    { id: 'assistant', label: 'AI Assistant',    short: 'Assistant', icon: MessageCircle, tab: 'assistant', description: 'Try the assistant on your own materials' },
  ],
  admin: [
    { id: 'status',    label: 'System Status',   short: 'Status', icon: Activity,      tab: 'dashboard', description: 'Is everything working?' },
    { id: 'users',     label: 'Users',           icon: Users,         tab: 'accounts',  description: 'People, roles and access' },
    { id: 'courses',   label: 'Courses',         icon: Layers,        tab: 'academic',  description: 'Subjects, courses and teachers' },
    { id: 'insights',  label: 'Class Insights',  short: 'Insights', icon: BarChart2,     tab: 'analytics', description: 'How students use the assistant' },
    { id: 'assistant', label: 'AI Assistant',    short: 'Assistant', icon: MessageCircle, tab: 'assistant', description: 'Ask across every course' },
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
