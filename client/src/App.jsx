import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

import api, { mockAuthApi } from './components/auth/api';
import { ThemeProvider } from './components/ui/Theme';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Layout } from './components/layout/Layout';
import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { ForgotPassword } from './components/auth/ForgotPassword';
import { OtpVerification } from './components/auth/OtpVerification';
import { ResetPassword } from './components/auth/ResetPassword';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { TeacherDashboard } from './components/dashboard/TeacherDashboard';
import { AskScreen } from './components/ask/AskScreen';
import { DocumentViewer } from './components/viewer/DocumentViewer';
import { AnalyticsPage } from './components/dashboard/AnalyticsPage';
import { Notebook } from './components/notebook/Notebook';
import { SettingsPanel } from './components/layout/SettingsPanel';
import { Modal } from './components/ui/Modal';

/* ─── Shared Input/Cell Styles ───────────────────────────────────────────── */
const inputBase = {
  width: '100%',
  height: '36px',
  padding: '0 0.875rem 0 2.25rem',
  borderRadius: '4px',
  border: '1px solid var(--border)',
  background: 'var(--bg-surface)',
  color: 'var(--fg)',
  fontFamily: 'var(--font-sans)',
  fontSize: '12px',
  outline: 'none',
};

/* ─── Admin: Users ───────────────────────────────────────────────────────── */
function AdminUsersPlaceholder() {
  const [query, setQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const initialUsers = [
    { id: 1, name: 'Anand Jyothis G', email: 'admin@demo.com', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Prof. Sarah Jenkins', email: 'sarah@university.edu', role: 'Teacher', status: 'Active' },
    { id: 3, name: 'Alex Rivera', email: 'alex.r@student.edu', role: 'Student', status: 'Active' },
    { id: 4, name: 'Elena Rostova', email: 'elena.r@student.edu', role: 'Student', status: 'Active' },
    { id: 5, name: 'Marcus Vance', email: 'marcus.v@student.edu', role: 'Student', status: 'Inactive' },
  ];

  const filtered = initialUsers
    .filter(u =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.role.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h2 className="hero-title" style={{ fontSize: '1.875rem' }}>User Directory</h2>
          <p className="font-sans font-normal mt-1" style={{ fontSize: '13px', color: 'var(--fg-3)' }}>
            Manage platform authorization, roles, and active sessions.
          </p>
        </div>
        <span className="keycap">{filtered.length} Users</span>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-3)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or role…"
            style={inputBase}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-2 cursor-pointer transition-all font-sans"
          style={{
            padding: '0.375rem 0.875rem',
            borderRadius: '9999px',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            color: 'var(--fg-2)',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Name ({sortAsc ? 'A–Z' : 'Z–A'})</span>
        </button>
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-xl"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-premium-sm)' }}
      >
        <table className="w-full text-left" style={{ fontSize: '12px' }}>
          <thead style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              {['Name', 'Email', 'Role', 'Status'].map(h => (
                <th key={h} className="p-4 font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-3)', fontSize: '10px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center" style={{ color: 'var(--fg-3)' }}>
                  No users matching "{query}".
                </td>
              </tr>
            ) : (
              filtered.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--fg)' }}>
                  <td className="p-4 font-medium" style={{ color: 'var(--fg)' }}>{u.name}</td>
                  <td className="p-4 font-mono" style={{ color: 'var(--fg-3)' }}>{u.email}</td>
                  <td className="p-4">
                    <span className="keycap">{u.role}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className="keycap"
                      style={{
                        color: u.status === 'Active' ? 'var(--success)' : 'var(--fg-3)',
                        background: u.status === 'Active' ? 'var(--success-dim)' : 'var(--bg-subtle)',
                        borderColor: u.status === 'Active' ? 'var(--success)' : 'var(--border)',
                      }}
                    >
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '11px', color: 'var(--fg-3)' }}
        >
          <span>Showing {filtered.length} of {initialUsers.length}</span>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--fg-3)' }}
              disabled
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono" style={{ color: 'var(--fg-2)' }}>1</span>
            <button
              className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
              style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--fg-3)' }}
              disabled
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Admin: Subjects ────────────────────────────────────────────────────── */
function AdminSubjectsPlaceholder() {
  const [query, setQuery] = useState('');

  const subjects = [
    { id: 'CS-301',   title: 'Data Structures & Algorithms', department: 'Computer Science', docs: 12 },
    { id: 'MATH-202', title: 'Numerical Analysis',           department: 'Mathematics',       docs: 8 },
    { id: 'PHY-101',  title: 'Introductory Physics',         department: 'Physics',           docs: 4 },
  ];

  const filtered = subjects.filter(s =>
    s.id.toLowerCase().includes(query.toLowerCase()) ||
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.department.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h2 className="hero-title" style={{ fontSize: '1.875rem' }}>Curriculum Catalog</h2>
          <p className="font-sans font-normal mt-1" style={{ fontSize: '13px', color: 'var(--fg-3)' }}>
            Course index, vector collections, and syllabus registry.
          </p>
        </div>
        <span className="keycap">{filtered.length} Courses</span>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-72">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-3)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter courses…"
          style={inputBase}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-xl"
        style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-premium-sm)' }}
      >
        <table className="w-full text-left" style={{ fontSize: '12px' }}>
          <thead style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              {['Code', 'Title', 'Department', 'Indexed Files'].map(h => (
                <th key={h} className="p-4 font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-3)', fontSize: '10px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center" style={{ color: 'var(--fg-3)' }}>No courses found.</td>
              </tr>
            ) : (
              filtered.map(s => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--fg)' }}>
                  <td className="p-4">
                    <span className="keycap font-mono" style={{ color: 'var(--accent)', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
                      {s.id}
                    </span>
                  </td>
                  <td className="p-4 font-medium" style={{ color: 'var(--fg)' }}>{s.title}</td>
                  <td className="p-4" style={{ color: 'var(--fg-3)' }}>{s.department}</td>
                  <td className="p-4 font-mono" style={{ color: 'var(--fg-3)' }}>{s.docs} files</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── App Content ────────────────────────────────────────────────────────── */
function AppContent() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authScreen, setAuthScreen] = useState('login');
  const [authEmail, setAuthEmail] = useState('admin@demo.com');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUser(null);
        setLoadingUser(false);
        setActiveTab('auth');
        setAuthScreen('login');
        return;
      }

      try {
        const res = await api.get('/auth/me/');
        setUser({
          username: res.data.full_name || res.data.username || res.data.email.split('@')[0],
          email: res.data.email,
          role: res.data.role || 'student',
          avatar: res.data.avatar || null,
        });
      } catch (err) {
        if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
          setUser({ username: 'DemoAdmin', email: 'admin@demo.com', role: 'admin' });
        } else {
          setUser(null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setActiveTab('auth');
          setAuthScreen('login');
        }
      } finally {
        setLoadingUser(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setActiveTab('auth');
      setAuthScreen('login');
      toast.error('Session expired. Please sign in again.');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [toast]);

  useEffect(() => {
    const handleOpenSettings = () => setIsModalOpen(true);
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);

  const handleLogout = async () => {
    setLoadingUser(true);
    try {
      await mockAuthApi.logout();
      setUser(null);
      setActiveTab('auth');
      setAuthScreen('login');
      toast.success('Logged out successfully.');
    } catch {
      toast.error('Failed to log out.');
    } finally {
      setLoadingUser(false);
    }
  };

  /* ── Loading Screen ─────────────────────────────────────────────────── */
  if (loadingUser) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'var(--bg)' }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--accent)',
              animation: 'status-pulse 2s ease-in-out infinite',
            }}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-sans font-medium" style={{ fontSize: '12px', color: 'var(--fg-3)' }}>
            Authenticating…
          </span>
        </div>
      </div>
    );
  }

  const currentTab = user ? (activeTab === 'auth' ? 'assistant' : activeTab) : 'auth';

  return (
    <>
      {currentTab === 'auth' ? (
        <div className="py-12 flex items-center justify-center min-h-screen p-6" style={{ background: 'var(--bg)' }}>
          <div className="w-full max-w-md">
            {authScreen === 'login' && (
              <Login
                onNavigate={setAuthScreen}
                onLoginSuccess={(loggedInUser) => {
                  setUser(loggedInUser);
                  const roleDefaults = { student: 'assistant', teacher: 'academic', admin: 'dashboard' };
                  setActiveTab(roleDefaults[loggedInUser?.role] ?? 'assistant');
                }}
              />
            )}
            {authScreen === 'register' && <Register onNavigate={setAuthScreen} />}
            {authScreen === 'forgot-password' && <ForgotPassword onNavigate={setAuthScreen} setEmailState={setAuthEmail} />}
            {authScreen === 'otp-verification' && <OtpVerification onNavigate={setAuthScreen} email={authEmail} />}
            {authScreen === 'reset-password' && <ResetPassword onNavigate={setAuthScreen} email={authEmail} />}
          </div>
        </div>
      ) : (
        <Layout
          activeTab={currentTab}
          setActiveTab={user ? setActiveTab : () => {}}
          user={user}
          onLogout={handleLogout}
        >
          {currentTab === 'dashboard' ? (
            <AdminDashboard setActiveTab={setActiveTab} />
          ) : currentTab === 'academic' ? (
            user?.role === 'admin' ? <AdminSubjectsPlaceholder /> : <TeacherDashboard />
          ) : currentTab === 'assistant' ? (
            <AskScreen user={user} />
          ) : currentTab === 'documents' ? (
            <DocumentViewer />
          ) : currentTab === 'accounts' ? (
            <AdminUsersPlaceholder />
          ) : currentTab === 'analytics' ? (
            <AnalyticsPage />
          ) : currentTab === 'notebook' ? (
            <Notebook />
          ) : null}

          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Account Settings"
            size="lg"
          >
            <SettingsPanel
              user={user}
              onLogout={() => {
                setIsModalOpen(false);
                handleLogout();
              }}
              onUpdateUser={setUser}
            />
          </Modal>
        </Layout>
      )}
    </>
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
