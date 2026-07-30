import React from 'react';
import { motion } from 'framer-motion';
import { Layers, Users, Database } from 'lucide-react';

export function AdminDashboard({ setActiveTab }) {
  const stats = [
    { label: 'Active Users', value: '4', desc: '1 Admin · 1 Teacher · 2 Students', icon: Users },
    { label: 'Subjects', value: '3', desc: 'CS · Math · Physics', icon: Layers },
    { label: 'Vector Store', value: 'Live', desc: '12,403 indexed chunks', icon: Database },
  ];

  const systemServices = [
    { name: 'Django REST API', status: 'Operational', latency: '24ms' },
    { name: 'ChromaDB Vector Store', status: 'Operational', latency: '42ms' },
    { name: 'Ollama RAG Pipeline', status: 'Operational', latency: '1.2s' },
    { name: 'JWT Auth Layer', status: 'Operational', latency: '12ms' },
  ];

  const recentActivity = [
    { action: 'Vector Store Synced', detail: 'Updated context indexes for 12,403 document chunks.', time: '10 min ago' },
    { action: 'New Reference Added', detail: 'Week_4_Lecture_Notes.pdf indexed in CS-301.', time: '1 hr ago' },
    { action: 'User Provisioned', detail: 'Prof. Sarah Jenkins assigned Teacher role.', time: '3 hrs ago' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-8 font-sans max-w-[1200px] mx-auto w-full"
    >
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h1 className="hero-title" style={{ fontSize: '1.875rem' }}>
            System Overview
          </h1>
          <p className="font-sans font-normal mt-1" style={{ fontSize: '13px', color: 'var(--fg-3)' }}>
            Infrastructure health, user access, and vector store status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab && setActiveTab('accounts')}
            className="flex items-center gap-2 font-sans font-medium cursor-pointer transition-all"
            style={{
              padding: '0.5rem 1.125rem',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--fg)',
              color: 'var(--bg)',
              fontSize: '12px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users</span>
          </button>
          <button
            onClick={() => setActiveTab && setActiveTab('academic')}
            className="flex items-center gap-2 font-sans font-medium cursor-pointer transition-all"
            style={{
              padding: '0.5rem 1.125rem',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--fg-2)',
              fontSize: '12px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-subtle)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.color = 'var(--fg-2)';
            }}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Subjects</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-md flex items-center justify-between font-sans"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-premium-sm)',
              }}
            >
              <div className="flex flex-col gap-1">
                <span className="font-sans font-semibold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>
                  {stat.label}
                </span>
                <span className="font-sans font-semibold tracking-tight" style={{ fontSize: '1.5rem', color: 'var(--fg)' }}>
                  {stat.value}
                </span>
                <span className="font-sans" style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                  {stat.desc}
                </span>
              </div>
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--fg-2)' }}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Infrastructure Health */}
      <div className="flex flex-col gap-3">
        <span className="font-sans font-semibold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>
          Infrastructure Health
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {systemServices.map((svc, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl flex items-center justify-between font-sans"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: 'var(--success)' }}
                />
                <div className="flex flex-col">
                  <span className="font-medium" style={{ fontSize: '12px', color: 'var(--fg)' }}>
                    {svc.name}
                  </span>
                  <span className="font-mono" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>
                    {svc.latency}
                  </span>
                </div>
              </div>
              <span
                className="keycap"
                style={{ color: 'var(--success)', background: 'var(--success-dim)', borderColor: 'var(--success)', fontSize: '9px' }}
              >
                {svc.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col gap-3">
        <span className="font-sans font-semibold uppercase tracking-widest" style={{ fontSize: '10px', color: 'var(--fg-3)' }}>
          Recent Activity
        </span>
        <div className="flex flex-col gap-2">
          {recentActivity.map((act, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl flex items-center justify-between font-sans"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex flex-col gap-0.5 min-w-0 mr-4">
                <span className="font-medium" style={{ fontSize: '12px', color: 'var(--fg)' }}>
                  {act.action}
                </span>
                <span className="leading-relaxed" style={{ fontSize: '11px', color: 'var(--fg-3)' }}>
                  {act.detail}
                </span>
              </div>
              <span className="keycap flex-shrink-0" style={{ fontSize: '10px' }}>
                {act.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
