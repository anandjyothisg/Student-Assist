import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Monitor, Sun, Moon, Laptop, Palette, Smartphone, LogOut,
} from 'lucide-react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { useTheme } from '../ui/Theme';
import { mockAuthApi } from '../auth/api';

function SectionHeader({ title, description }) {
  return (
    <div className="mb-6">
      <h3
        className="text-[15px] font-semibold tracking-tight"
        style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-[12px] mt-1"
          style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
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

  const [activeTab, setActiveTab] = useState('profile');

  const [profileName, setProfileName] = useState(user?.username || user?.full_name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currPassword, setCurrPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [sessions, setSessions] = useState([
    { id: 1, device: 'Windows PC · Chrome', location: 'Kerala, India', status: 'Active now', current: true },
    { id: 2, device: 'MacBook Pro · Safari', location: 'California, USA', status: '3 days ago', current: false },
    { id: 3, device: 'iPhone 15 · Mobile App', location: 'Kerala, India', status: '2 hours ago', current: false },
  ]);

  useEffect(() => {
    if (user) {
      setProfileName(user.username || user.full_name || '');
      setProfileEmail(user.email || '');
    }
  }, [user]);

  const tabs = [
    { id: 'profile',  label: 'Profile',  icon: User },
    { id: 'theme',    label: 'Appearance', icon: Palette },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'sessions', label: 'Sessions', icon: Monitor },
    { id: 'logout',   label: 'Sign out', icon: LogOut },
  ];

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) { toast.warning('Name cannot be blank.'); return; }
    setSavingProfile(true);
    try {
      const parts = profileName.trim().split(' ');
      await mockAuthApi.updateProfile(parts[0] || '', parts.slice(1).join(' ') || '');
      if (onUpdateUser) onUpdateUser({ ...user, username: profileName.trim() });
      toast.success('Profile updated.');
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
      toast.success('Password updated.');
      setCurrPassword(''); setNewPassword(''); setConfirmPassword('');
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

  return (
    <div
      className="flex flex-col md:flex-row min-h-[480px]"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {/* Tab List */}
      <nav
        className="md:w-48 flex-shrink-0 flex flex-row md:flex-col gap-0.5 p-1 md:p-2 overflow-x-auto border-b md:border-b-0 md:border-r"
        style={{ borderColor: 'var(--border)' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDanger = tab.id === 'logout';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-md text-left whitespace-nowrap transition-colors cursor-pointer"
              style={{
                color: isDanger
                  ? isActive ? 'var(--error)' : 'var(--error)'
                  : isActive ? 'var(--fg)' : 'var(--fg-3)',
                background: isActive
                  ? isDanger ? 'var(--error-dim)' : 'var(--bg-hover)'
                  : 'transparent',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = isDanger ? 'var(--error-dim)' : 'var(--bg-subtle)';
                  e.currentTarget.style.color = isDanger ? 'var(--error)' : 'var(--fg-2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = isDanger ? 'var(--error)' : 'var(--fg-3)';
                }
              }}
            >
              <Icon
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: isDanger ? 'var(--error)' : isActive ? 'var(--fg)' : 'var(--fg-3)' }}
              />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content Pane */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto" style={{ minHeight: '320px', maxHeight: '520px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
          >

            {/* PROFILE */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-5 max-w-sm">
                <SectionHeader
                  title="Profile"
                  description="Update your display name. Your email is managed by your institution."
                />
                <Input
                  label="Full Name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                  required
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={profileEmail}
                  readOnly
                  disabled
                  helperText="Email cannot be changed."
                />
                <div>
                  <Button type="submit" variant="primary" size="sm" loading={savingProfile}>
                    Save changes
                  </Button>
                </div>
              </form>
            )}

            {/* THEME */}
            {activeTab === 'theme' && (
              <div className="flex flex-col gap-5">
                <SectionHeader
                  title="Appearance"
                  description="Choose how SmartStudent looks on your device."
                />
                <div className="flex flex-col gap-2 max-w-xs">
                  {[
                    { id: 'light', icon: Sun, label: 'Light' },
                    { id: 'dark', icon: Moon, label: 'Dark' },
                    { id: 'system', icon: Laptop, label: 'System' },
                  ].map((mode) => {
                    const ModeIcon = mode.icon;
                    const isSelected = theme === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setTheme(mode.id)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          background: isSelected ? 'var(--bg-hover)' : 'transparent',
                          border: `1px solid ${isSelected ? 'var(--border-hover)' : 'var(--border)'}`,
                          color: isSelected ? 'var(--fg)' : 'var(--fg-2)',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'var(--bg-subtle)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <ModeIcon
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: isSelected ? 'var(--accent)' : 'var(--fg-3)' }}
                        />
                        <span className="text-[13px] font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
                          {mode.label}
                        </span>
                        {isSelected && (
                          <div
                            className="ml-auto w-1.5 h-1.5 rounded-full"
                            style={{ background: 'var(--accent)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PASSWORD */}
            {activeTab === 'password' && (
              <form onSubmit={handleSaveSecurity} className="flex flex-col gap-5 max-w-sm">
                <SectionHeader
                  title="Password"
                  description="Change the password used to access your account."
                />
                <Input
                  label="Current Password"
                  type="password"
                  placeholder="••••••••"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  required
                />
                <Input
                  label="New Password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <div>
                  <Button type="submit" variant="primary" size="sm" loading={savingPassword}>
                    Update password
                  </Button>
                </div>
              </form>
            )}

            {/* SESSIONS */}
            {activeTab === 'sessions' && (
              <div className="flex flex-col gap-5 max-w-md">
                <SectionHeader
                  title="Sessions"
                  description="Manage devices that have access to your account."
                />
                <div className="flex flex-col gap-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl gap-4"
                      style={{
                        border: '1px solid var(--border)',
                        background: session.current ? 'var(--bg-subtle)' : 'transparent',
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--fg-3)' }} />
                          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--fg)' }}>
                            {session.device}
                          </p>
                          {session.current && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                              style={{
                                background: 'var(--accent-dim)',
                                color: 'var(--accent)',
                                border: '1px solid var(--accent)',
                                opacity: 0.85,
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 ml-6" style={{ color: 'var(--fg-3)' }}>
                          {session.location} · {session.status}
                        </p>
                      </div>
                      {!session.current && (
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => handleRevokeSession(session.id, session.device)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LOGOUT */}
            {activeTab === 'logout' && (
              <div className="flex flex-col gap-5 max-w-sm">
                <SectionHeader
                  title="Sign out"
                  description="This will end your current session and invalidate your access tokens."
                />
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: 'var(--error-dim)',
                    border: '1px solid var(--error-dim)',
                  }}
                >
                  <p className="text-[13px] mb-4" style={{ color: 'var(--fg-2)' }}>
                    Any unsaved work will be lost. Are you sure you want to sign out?
                  </p>
                  <Button onClick={onLogout} variant="danger" size="sm">
                    Confirm sign out
                  </Button>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
