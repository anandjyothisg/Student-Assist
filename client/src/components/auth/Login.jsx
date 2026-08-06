import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from './api';

export function Login({ onNavigate, onLoginSuccess }) {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: '', password: '' }
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const result = await mockAuthApi.login(data.email, data.password);
      toast.success(`Welcome back, ${result.user.username}.`);
      if (onLoginSuccess) {
        onLoginSuccess(result.user);
      } else if (onNavigate) {
        onNavigate('dashboard');
      }
    } catch (err) {
      toast.error(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      {/* Wordmark */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--fg)',
              color: 'var(--bg)',
              fontFamily: 'var(--font-serif)',
              fontSize: '15px',
            }}
          >
            A
          </div>
          <span
            className="text-[15px] font-medium"
            style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
          >
            AuraStudy AI
          </span>
        </div>

        <h1
          className="hero-title text-[32px] sm:text-[40px] mb-2"
          style={{ color: 'var(--fg)' }}
        >
          Welcome back
        </h1>
        <p
          className="text-[14px]"
          style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
        >
          Sign in to your AI learning workspace
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[11px] font-medium uppercase tracking-widest"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
          >
            Email
          </label>
          <input
            type="text"
            placeholder="you@university.edu"
            className="w-full h-11 px-4 rounded-md text-[14px] outline-none transition-all"
            style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${errors.email ? 'var(--error)' : 'var(--border)'}`,
              color: 'var(--fg)',
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={(e) => {
              if (!errors.email) {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
              }
            }}
            onBlur={(e) => {
              if (!errors.email) {
                e.currentTarget.style.borderColor = 'var(--border)';
              }
            }}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />
          {errors.email && (
            <span className="text-[11px]" style={{ color: 'var(--error)' }}>
              {errors.email.message}
            </span>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('forgot-password')}
              className="text-[12px] cursor-pointer hover:underline transition-opacity hover:opacity-80"
              style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="w-full h-11 px-5 pr-11 rounded-md text-[14px] outline-none transition-all"
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${errors.password ? 'var(--error)' : 'var(--border)'}`,
                color: 'var(--fg)',
                fontFamily: 'var(--font-sans)',
              }}
              onFocus={(e) => {
                if (!errors.password) e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onBlur={(e) => {
                if (!errors.password) e.currentTarget.style.borderColor = 'var(--border)';
              }}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Minimum 6 characters' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
              style={{ color: 'var(--fg-3)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg-2)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <span className="text-[11px]" style={{ color: 'var(--error)' }}>
              {errors.password.message}
            </span>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-md text-[14px] font-medium mt-1 transition-all cursor-pointer disabled:opacity-50"
          style={{
            background: 'var(--fg)',
            color: 'var(--bg)',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* Footer link */}
      <p
        className="mt-6 text-[13px] text-center"
        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
      >
        Don&rsquo;t have an account?{' '}
        <button
          onClick={() => onNavigate && onNavigate('register')}
          className="font-medium cursor-pointer hover:underline"
          style={{ color: 'var(--fg-2)' }}
        >
          Create account
        </button>
      </p>
    </motion.div>
  );
}