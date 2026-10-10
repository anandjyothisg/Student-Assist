import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';

import api, { mockAuthApi } from './components/auth/api';
import { ThemeProvider } from './components/ui/Theme';
import { ToastProvider, useToast } from './components/ui/Toast';
import { BrandMark } from './components/ui/BrandMark';
import { Layout } from './components/layout/Layout';
import { getDefaultTab, isTabAllowedForRole, readRoute, routeHref } from './components/layout/navConfig';
import { AuthLayout } from './components/auth/AuthLayout';
import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { ForgotPassword } from './components/auth/ForgotPassword';
import { OtpVerification } from './components/auth/OtpVerification';
import { ResetPassword } from './components/auth/ResetPassword';

// Screens are split per route so the sign-in page doesn't download the whole app.
const AdminDashboard = lazy(() => import('./components/dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const TeacherDashboard = lazy(() => import('./components/dashboard/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })));
const AnalyticsPage = lazy(() => import('./components/dashboard/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const AskScreen = lazy(() => import('./components/ask/AskScreen').then((m) => ({ default: m.AskScreen })));
const DocumentViewer = lazy(() => import('./components/viewer/DocumentViewer').then((m) => ({ default: m.DocumentViewer })));
const Notebook = lazy(() => import('./components/notebook/Notebook').then((m) => ({ default: m.Notebook })));
const AdminUsers = lazy(() => import('./components/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminCatalog = lazy(() => import('./components/admin/AdminCatalog').then((m) => ({ default: m.AdminCatalog })));
const CoursesPage = lazy(() => import('./components/courses/CoursesPage').then((m) => ({ default: m.CoursesPage })));
const StudentHome = lazy(() => import('./components/home/StudentHome').then((m) => ({ default: m.StudentHome })));
const Landing = lazy(() => import('./components/landing/Landing'));

/* ─── Hash routing (#/notebook, #/documents?doc=…) — survives refresh & back/forward ─── */
const readHashTab = () => readRoute().tab;

function writeHashTab(tab, { replace = false, params } = {}) {
  const next = routeHref(tab, params ?? (readRoute().tab === tab ? readRoute().params : {}));
  if (window.location.hash === next) return;
  if (replace) window.history.replaceState(null, '', next);
  else window.history.pushState(null, '', next);
  window.dispatchEvent(new Event('routechange'));
}

/* Signed-out routes: each auth step has its own hash so back/forward work; anything else is the landing page. */
const AUTH_SLUGS = {
  login: 'signin',
  register: 'register',
  'forgot-password': 'forgot-password',
  'otp-verification': 'verify',
  'reset-password': 'reset-password',
};
const SLUG_TO_SCREEN = Object.fromEntries(Object.entries(AUTH_SLUGS).map(([screen, slug]) => [slug, screen]));
const APP_TABS = new Set(['home', 'dashboard', 'academic', 'assistant', 'documents', 'courses', 'accounts', 'analytics', 'notebook']);

function guestScreen(tab, hasEmail) {
  const screen = SLUG_TO_SCREEN[tab] ?? (APP_TABS.has(tab) ? 'login' : null); // deep link into the app → sign in first
  if ((screen === 'otp-verification' || screen === 'reset-password') && !hasEmail) return 'forgot-password';
  return screen;
}

function mapUser(data) {
  return {
    id: data.id,
    username: data.full_name || data.username || data.email.split('@')[0],
    email: data.email,
    role: data.role || 'student',
    avatar: data.avatar_url || null,
    program: data.program || '',
    yearOfStudy: data.year_of_study || null,
    studentNumber: data.student_number || '',
    department: data.department || '',
    designation: data.designation || '',
  };
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        <BrandMark size={40} className="animate-[status-pulse_1.6s_ease-in-out_infinite]" />
        <span className="text-[13px] text-fg-3">Loading your workspace…</span>
      </div>
    </div>
  );
}

function ScreenFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" role="status" aria-label="Loading">
      <span className="ai-dot" /><span className="ai-dot mx-1" /><span className="ai-dot" />
    </div>
  );
}

function AppContent() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTabState] = useState(readHashTab);
  const [guestTab, setGuestTab] = useState(readHashTab);
  const [bootError, setBootError] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authOtp, setAuthOtp] = useState('');

  /* Resolve which tab to show: hash request if allowed, else the role's home. */
  const resolveTab = useCallback((role, requested) =>
    requested && isTabAllowedForRole(role, requested) ? requested : getDefaultTab(role), []);

  const setActiveTab = useCallback((tab, params) => {
    setActiveTabState(tab);
    writeHashTab(tab, { params: params ?? {} });
  }, []);

  const signIn = useCallback((u) => {
    // Tokens were just issued — fetch the full profile (academic fields, avatar).
    api.get('/auth/me/').then((r) => setUser(mapUser(r.data))).catch(() => {});
    setUser(u);
    const tab = resolveTab(u.role, readHashTab());
    setActiveTabState(tab);
    writeHashTab(tab, { replace: true });
  }, [resolveTab]);

  /* Boot: restore the session if there is a token. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!localStorage.getItem('accessToken')) { setLoadingUser(false); return; }
      try {
        const res = await api.get('/auth/me/');
        if (cancelled) return;
        const u = mapUser(res.data);
        setUser(u);
        const requested = readHashTab();
        const tab = resolveTab(u.role, requested);
        setActiveTabState(tab);
        // The bare URL always opens the landing page, signed in or not.
        if (requested) {
          if (requested !== tab && APP_TABS.has(requested)) toast.error("You don't have access to that section.");
          writeHashTab(tab, { replace: true, params: requested === tab ? readRoute().params : {} });
        }
      } catch (err) {
        // Only an explicit rejection ends the session. If the server is
        // unreachable (restarting, offline), keep the tokens and offer a retry.
        const code = err?.response?.status;
        if (code === 401 || code === 403) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        } else if (!cancelled) {
          setBootError(true);
        }
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Back/forward buttons. */
  useEffect(() => {
    const onHash = () => {
      if (!user) return;
      const requested = readHashTab();
      if (!requested) return; // back to the landing page
      const tab = resolveTab(user.role, requested);
      if (requested && requested !== tab) {
        if (APP_TABS.has(requested)) toast.error("You don't have access to that section.");
        writeHashTab(tab, { replace: true });
      }
      setActiveTabState(tab);
    };
    window.addEventListener('popstate', onHash);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('routechange', onHash);
    return () => {
      window.removeEventListener('popstate', onHash);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('routechange', onHash);
    };
  }, [user, resolveTab, toast]);

  /* Signed-out navigation follows the hash too. */
  useEffect(() => {
    const onRoute = () => setGuestTab(readHashTab());
    window.addEventListener('popstate', onRoute);
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('routechange', onRoute);
    return () => {
      window.removeEventListener('popstate', onRoute);
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('routechange', onRoute);
    };
  }, []);

  const setAuthScreen = useCallback((screen, { replace = false } = {}) => {
    const next = `#/${AUTH_SLUGS[screen] ?? 'signin'}`;
    if (window.location.hash !== next) {
      if (replace) window.history.replaceState(null, '', next);
      else window.history.pushState(null, '', next);
    }
    setGuestTab(readHashTab());
  }, []);

  const openFromLanding = useCallback((screen) => {
    setAuthScreen(screen);
    window.scrollTo(0, 0);
  }, [setAuthScreen]);

  const goHome = useCallback((e) => {
    e?.preventDefault();
    window.history.pushState(null, '', window.location.pathname);
    setGuestTab(null);
    window.scrollTo(0, 0);
  }, []);

  /* Token refresh failed somewhere — drop back to sign-in. */
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setAuthScreen('login', { replace: true });
      toast.error('Your session expired. Please sign in again.');
    };
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, [toast, setAuthScreen]);

  const handleLogout = async () => {
    try {
      await mockAuthApi.logout();
    } finally {
      setUser(null);
      // Signing out returns to the landing page.
      window.history.replaceState(null, '', window.location.pathname);
      setGuestTab(null);
      window.scrollTo(0, 0);
      toast.success('You’ve been signed out.');
    }
  };

  if (loadingUser) return <FullScreenLoader />;

  if (bootError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-6" role="alert">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <BrandMark size={40} />
          <h1 className="text-[17px] font-semibold text-fg">Can’t reach AuraStudy right now</h1>
          <p className="text-[14px] leading-relaxed text-fg-3">The server didn’t respond. You’re still signed in; try again in a moment.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-10 rounded-md bg-fg px-4 text-[14px] font-medium text-canvas transition-colors hover:bg-fg/88"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    const authScreen = guestScreen(guestTab, !!authEmail);
    if (!authScreen) {
      return (
        <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
          <Landing onStart={openFromLanding} />
        </Suspense>
      );
    }
    return (
      <AuthLayout onHome={goHome}>
        {authScreen === 'login' && <Login onNavigate={setAuthScreen} onLoginSuccess={signIn} />}
        {authScreen === 'register' && <Register onNavigate={setAuthScreen} onRegistered={signIn} />}
        {authScreen === 'forgot-password' && (
          <ForgotPassword onNavigate={setAuthScreen} setEmailState={setAuthEmail} defaultEmail={authEmail} />
        )}
        {authScreen === 'otp-verification' && (
          <OtpVerification onNavigate={setAuthScreen} email={authEmail} setOtpState={setAuthOtp} />
        )}
        {authScreen === 'reset-password' && (
          <ResetPassword onNavigate={setAuthScreen} email={authEmail} otp={authOtp} />
        )}
      </AuthLayout>
    );
  }

  if (!guestTab) {
    const openApp = () => { setActiveTab(resolveTab(user.role, null)); window.scrollTo(0, 0); };
    return (
      <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
        <Landing onStart={openApp} signedIn />
      </Suspense>
    );
  }

  const currentTab = resolveTab(user.role, activeTab);

  const screen = {
    dashboard: <AdminDashboard setActiveTab={setActiveTab} />,
    academic: user.role === 'admin' ? <AdminCatalog user={user} /> : <TeacherDashboard user={user} />,
    assistant: <AskScreen user={user} onNavigate={setActiveTab} />,
    documents: <DocumentViewer user={user} onNavigate={setActiveTab} />,
    home: <StudentHome user={user} onNavigate={setActiveTab} />,
    courses: <CoursesPage user={user} onNavigate={setActiveTab} />,
    accounts: <AdminUsers user={user} />,
    analytics: <AnalyticsPage user={user} />,
    notebook: <Notebook onNavigate={setActiveTab} />,
  }[currentTab];

  return (
    <Layout
      activeTab={currentTab}
      setActiveTab={setActiveTab}
      user={user}
      onLogout={handleLogout}
      onUpdateUser={setUser}
    >
      <Suspense fallback={<ScreenFallback />}>{screen}</Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
