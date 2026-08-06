import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Monitor, Sun, Moon, Laptop, Palette, Smartphone, LogOut, Check,
  ChevronRight,
} from 'lucide-react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { useTheme } from '../ui/Theme';
import { mockAuthApi } from '../auth/api';

function SectionHeader({ title, description }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h3
        className="text-sm md:text-base font-semibold tracking-tight"
        style={{
          color: 'var(--fg)',
          fontFamily: 'var(--font-sans)',
          letterSpacing: '-0.01em',
          marginBottom: '8px',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-xs md:text-sm leading-relaxed"
          style={{
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export function SettingsPanel({ user, onLogout, onUpdateUser }) {
  const toast = useToast();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab]           = useState('profile');
  const [isMobile, setIsMobile]             = useState(() => window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [profileName, setProfileName]   = useState(user?.username || user?.full_name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currPassword, setCurrPassword]       = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword]   = useState(false);

  const [sessions, setSessions] = useState([
    { id: 1, device: 'Windows PC · Chrome',    location: 'Kerala, India',    status: 'Active now',  current: true  },
    { id: 2, device: 'MacBook Pro · Safari',    location: 'California, USA',  status: '3 days ago',  current: false },
    { id: 3, device: 'iPhone 15 · Mobile App',  location: 'Kerala, India',    status: '2 hours ago', current: false },
  ]);

  // Responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync user prop changes into form state
  useEffect(() => {
    if (user) {
      setProfileName(user.username || user.full_name || '');
      setProfileEmail(user.email || '');
    }
  }, [user]);

  const tabs = [
    { id: 'profile',  label: 'Profile',    icon: User     },
    { id: 'theme',    label: 'Appearance', icon: Palette  },
    { id: 'password', label: 'Password',   icon: Lock     },
    { id: 'sessions', label: 'Sessions',   icon: Monitor  },
    { id: 'logout',   label: 'Sign out',   icon: LogOut   },
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (isMobile) setShowMobileMenu(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.warning('Name cannot be blank.');
      return;
    }
    setSavingProfile(true);
    try {
      const parts = profileName.trim().split(' ');
      await mockAuthApi.updateProfile(parts[0] || '', parts.slice(1).join(' ') || '');
      if (onUpdateUser) onUpdateUser({ ...user, username: profileName.trim() });
      toast.success('Profile updated successfully.');
    } catch {
      toast.error('Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    if (!currPassword) { toast.warning('Enter your current password.'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    if (newPassword.length < 6) { toast.warning('Password must be at least 6 characters.'); return; }
    setSavingPassword(true);
    try {
      await mockAuthApi.changePassword(currPassword, newPassword, confirmPassword);
      toast.success('Password updated successfully.');
      setCurrPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeSession = (id, device) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.info(`Session revoked: ${device}`);
  };

  const renderContent = () => (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.14, ease: 'easeInOut' }}
        className="w-full"
      >
        {/* ── PROFILE ── */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="flex flex-col w-full" style={{ gap: '20px' }}>
            <SectionHeader
              title="Profile Information"
              description="Update your display name and personal information. Your email is managed by your institution."
            />
            <div className="flex flex-col w-full" style={{ gap: '16px' }}>
              <Input
                label="Full Name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
              <Input
                label="Email Address"
                type="email"
                value={profileEmail}
                readOnly
                disabled
                helperText="Email cannot be changed and is managed by your institution."
              />
            </div>
            <div style={{ paddingTop: '4px' }}>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingProfile}
                className="w-full sm:w-auto whitespace-nowrap"
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}

        {/* ── APPEARANCE ── */}
        {activeTab === 'theme' && (
          <div className="flex flex-col w-full" style={{ gap: '20px' }}>
            <SectionHeader
              title="Appearance Settings"
              description="Customize how the application looks on your device. Choose between light, dark, or system theme."
            />
            <div className="flex flex-col w-full" style={{ gap: '10px' }}>
              {[
                { id: 'light',  icon: Sun,    label: 'Light Mode',      desc: 'Clean and bright'   },
                { id: 'dark',   icon: Moon,   label: 'Dark Mode',       desc: 'Easy on the eyes'   },
                { id: 'system', icon: Laptop, label: 'System Default',  desc: 'Follow preferences' },
              ].map((mode) => {
                const ModeIcon   = mode.icon;
                const isSelected = theme === mode.id;

                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setTheme(mode.id)}
                    className="flex items-center rounded-lg cursor-pointer transition-all duration-150 text-left group w-full"
                    style={{
                      padding: '12px 14px',
                      gap: '12px',
                      background: isSelected ? 'var(--bg-hover)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--border-hover)' : 'var(--border)'}`,
                      color: isSelected ? 'var(--fg)' : 'var(--fg-2)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background    = 'var(--bg-subtle)';
                        e.currentTarget.style.borderColor   = 'var(--border-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background    = 'transparent';
                        e.currentTarget.style.borderColor   = 'var(--border)';
                      }
                    }}
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-md"
                      style={{
                        width: '36px',
                        height: '36px',
                        background: 'var(--bg-subtle)',
                        color: isSelected ? 'var(--fg)' : 'var(--fg-3)',
                      }}
                    >
                      <ModeIcon className="w-4 h-4" strokeWidth={2} />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1" style={{ gap: '2px' }}>
                      <span
                        className="text-xs md:text-sm font-medium"
                        style={{ fontFamily: 'var(--font-sans)' }}
                      >
                        {mode.label}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
                      >
                        {mode.desc}
                      </span>
                    </div>

                    {isSelected && (
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-full"
                        style={{
                          width: '20px',
                          height: '20px',
                          background: 'var(--fg)',
                          color: 'var(--bg)',
                        }}
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PASSWORD ── */}
        {activeTab === 'password' && (
          <form onSubmit={handleSaveSecurity} className="flex flex-col w-full" style={{ gap: '20px' }}>
            <SectionHeader
              title="Change Password"
              description="Update your password to keep your account secure. Use a strong password with at least 6 characters."
            />
            <div className="flex flex-col w-full" style={{ gap: '16px' }}>
              <Input
                label="Current Password"
                type="password"
                placeholder="Enter current password"
                value={currPassword}
                onChange={(e) => setCurrPassword(e.target.value)}
                required
              />
              <Input
                label="New Password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                helperText="Minimum 6 characters"
              />
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ paddingTop: '4px' }}>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingPassword}
                className="w-full sm:w-auto whitespace-nowrap"
              >
                Update Password
              </Button>
            </div>
          </form>
        )}

        {/* ── SESSIONS ── */}
        {activeTab === 'sessions' && (
          <div className="flex flex-col w-full" style={{ gap: '20px' }}>
            <SectionHeader
              title="Active Sessions"
              description="Manage devices and browsers currently signed in. You can revoke access from any device."
            />
            <div className="flex flex-col w-full" style={{ gap: '10px' }}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between rounded-lg gap-3"
                  style={{
                    padding: '14px 16px',
                    border: `1px solid ${session.current ? 'var(--border-hover)' : 'var(--border)'}`,
                    background: session.current ? 'var(--bg-hover)' : 'var(--bg-subtle)',
                  }}
                >
                  <div className="flex items-start min-w-0 flex-1" style={{ gap: '12px' }}>
                    {/* Device Icon */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-md"
                      style={{
                        width: '36px',
                        height: '36px',
                        background: session.current ? 'var(--bg)' : 'var(--bg-hover)',
                        color: 'var(--fg-3)',
                      }}
                    >
                      <Smartphone className="w-4 h-4" strokeWidth={2} />
                    </div>

                    {/* Session Details */}
                    <div className="flex flex-col min-w-0 flex-1" style={{ gap: '6px' }}>
                      <div className="flex items-center flex-wrap gap-2">
                        <p
                          className="text-xs md:text-sm font-medium truncate"
                          style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
                        >
                          {session.device}
                        </p>
                        {session.current && (
                          <span
                            className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider flex-shrink-0 whitespace-nowrap"
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'var(--bg)',
                              color: 'var(--fg-2)',
                              border: '1px solid var(--border)',
                              letterSpacing: '0.05em',
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <p
                        className="text-[11px] md:text-xs leading-relaxed"
                        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
                      >
                        {session.location} · {session.status}
                      </p>
                    </div>
                  </div>

                  {!session.current && (
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => handleRevokeSession(session.id, session.device)}
                      className="flex-shrink-0 whitespace-nowrap"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SIGN OUT ── */}
        {activeTab === 'logout' && (
          <div className="flex flex-col w-full" style={{ gap: '20px' }}>
            <SectionHeader
              title="Sign Out"
              description="This will end your current session. Make sure you've saved all your work."
            />
            <div
              className="rounded-lg"
              style={{
                padding: '16px 18px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-start" style={{ gap: '14px', marginBottom: '16px' }}>
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-md"
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'var(--bg-hover)',
                    color: 'var(--fg-3)',
                  }}
                >
                  <LogOut className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="flex flex-col min-w-0 flex-1" style={{ gap: '6px' }}>
                  <h4
                    className="text-xs md:text-sm font-medium"
                    style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
                  >
                    Are you sure you want to sign out?
                  </h4>
                  <p
                    className="text-xs md:text-sm leading-relaxed"
                    style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-sans)' }}
                  >
                    Any unsaved changes will be lost. You'll need to sign in again.
                  </p>
                </div>
              </div>
              <Button onClick={onLogout} variant="danger" size="sm" className="w-full">
                Confirm Sign Out
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div
      className="flex flex-col md:flex-row w-full h-full"
      style={{
        fontFamily: 'var(--font-sans)',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* ── Desktop Sidebar Navigation ── */}
      {!isMobile && (
        <nav
          className="hidden md:flex md:flex-col flex-shrink-0"
          style={{
            width: '192px',
            padding: '20px 10px',
            gap: '4px',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            style={{
              paddingLeft: '10px',
              paddingBottom: '12px',
              marginBottom: '8px',
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{
                color: 'var(--fg-3)',
                letterSpacing: '0.05em',
              }}
            >
              · Account Settings
            </p>
          </div>

          {tabs.map((tab) => {
            const Icon     = tab.icon;
            const isActive = activeTab === tab.id;
            const isDanger = tab.id === 'logout';

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className="flex items-center rounded-lg text-left transition-all duration-150 cursor-pointer w-full"
                style={{
                  padding: '9px 10px',
                  gap: '10px',
                  minHeight: '38px',
                  color: isDanger
                    ? isActive ? 'var(--error)' : 'var(--fg-3)'
                    : isActive ? 'var(--fg)' : 'var(--fg-3)',
                  background: isActive ? 'var(--bg-hover)' : 'transparent',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '500',
                  border: `1px solid ${isActive ? 'var(--border)' : 'transparent'}`,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background   = 'var(--bg-subtle)';
                    e.currentTarget.style.color        = isDanger ? 'var(--error)' : 'var(--fg-2)';
                    e.currentTarget.style.borderColor  = 'var(--border)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background   = 'transparent';
                    e.currentTarget.style.color        = isDanger ? 'var(--fg-3)' : 'var(--fg-3)';
                    e.currentTarget.style.borderColor  = 'transparent';
                  }
                }}
              >
                <Icon
                  className="flex-shrink-0"
                  style={{
                    width: '16px',
                    height: '16px',
                    color: isActive
                      ? isDanger ? 'var(--error)' : 'var(--fg)'
                      : 'var(--fg-3)',
                  }}
                  strokeWidth={2}
                />
                <span className="truncate text-[13px] min-w-0">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ── Mobile Tab Accordion ── */}
      {isMobile && (
        <div
          className="flex md:hidden flex-col w-full border-b flex-shrink-0"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--bg)',
            padding: '8px 0',
          }}
        >
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="flex items-center justify-between w-full transition-all duration-150"
            style={{
              padding: '10px 16px',
              gap: '8px',
              color: 'var(--fg)',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            <span>· Account Settings</span>
            <motion.div
              animate={{ rotate: showMobileMenu ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </motion.div>
          </button>

          <AnimatePresence>
            {showMobileMenu && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col overflow-hidden"
                style={{ gap: '4px', padding: '8px 12px 0' }}
              >
                {tabs.map((tab) => {
                  const Icon     = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isDanger = tab.id === 'logout';

                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className="flex items-center rounded-lg text-left transition-all duration-150 w-full active:scale-[0.98]"
                      style={{
                        padding: '10px 12px',
                        gap: '10px',
                        minHeight: '40px',
                        color: isDanger
                          ? isActive ? 'var(--error)' : 'var(--fg-3)'
                          : isActive ? 'var(--fg)' : 'var(--fg-3)',
                        background: isActive ? 'var(--bg-hover)' : 'transparent',
                        fontSize: '13px',
                        fontWeight: isActive ? '600' : '500',
                        border: `1px solid ${isActive ? 'var(--border)' : 'transparent'}`,
                      }}
                    >
                      <Icon
                        className="flex-shrink-0"
                        style={{
                          width: '16px',
                          height: '16px',
                          color: isActive
                            ? isDanger ? 'var(--error)' : 'var(--fg)'
                            : 'var(--fg-3)',
                        }}
                        strokeWidth={2}
                      />
                      <span className="truncate text-sm">{tab.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Content Area — scrolls independently, height is driven by parent modal ── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          padding: isMobile ? '20px 16px' : '24px 28px',
          overscrollBehavior: 'contain',
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
}