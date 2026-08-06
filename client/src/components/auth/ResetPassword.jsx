import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from './api';

export function ResetPassword({ onNavigate, email = 'admin@demo.com' }) {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const passwordVal = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await mockAuthApi.resetPassword(email, data.password);
      toast.success('Password updated successfully! Please sign in.');
      if (onNavigate) onNavigate('login');
    } catch (err) {
      toast.error(err.message || 'Password reset failed.');
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
          Reset Password
        </h1>
        <p
          className="text-[14px]"
          style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
        >
          Enter and confirm your new secure password
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        {/* New Password */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[11px] font-medium uppercase tracking-widest"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
          >
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full h-11 px-4 pr-11 rounded-md text-[14px] outline-none transition-all"
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${
                  errors.password ? 'var(--error)' : 'var(--border)'
                }`,
                color: 'var(--fg)',
                fontFamily: 'var(--font-sans)',
              }}
              onFocus={(e) => {
                if (!errors.password)
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = errors.password
                  ? 'var(--error)'
                  : 'var(--border)';
              }}
              {...register('password', {
                required: 'New password is required',
                minLength: {
                  value: 8,
                  message: 'At least 8 characters',
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Must include uppercase, lowercase, and a number',
                },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
              style={{ color: 'var(--fg-3)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = 'var(--fg-2)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = 'var(--fg-3)')
              }
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <span
              className="text-[11px]"
              style={{ color: 'var(--error)', fontFamily: 'var(--font-sans)' }}
            >
              {errors.password.message}
            </span>
          )}
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[11px] font-medium uppercase tracking-widest"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
          >
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full h-11 px-4 pr-11 rounded-md text-[14px] outline-none transition-all"
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${
                  errors.confirmPassword ? 'var(--error)' : 'var(--border)'
                }`,
                color: 'var(--fg)',
                fontFamily: 'var(--font-sans)',
              }}
              onFocus={(e) => {
                if (!errors.confirmPassword)
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = errors.confirmPassword
                  ? 'var(--error)'
                  : 'var(--border)';
              }}
              {...register('confirmPassword', {
                required: 'Please confirm your new password',
                validate: (val) =>
                  val === passwordVal || 'Passwords do not match',
              })}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
              style={{ color: 'var(--fg-3)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = 'var(--fg-2)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = 'var(--fg-3)')
              }
            >
              {showConfirm ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <span
              className="text-[11px]"
              style={{ color: 'var(--error)', fontFamily: 'var(--font-sans)' }}
            >
              {errors.confirmPassword.message}
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
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      {/* Footer */}
      <p
        className="mt-6 text-[13px] text-center"
        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
      >
        Remembered your password?{' '}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('login')}
          className="font-medium cursor-pointer hover:underline transition-opacity hover:opacity-80"
          style={{
            color: 'var(--fg-2)',
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Back to Sign In
        </button>
      </p>
    </motion.div>
  );
}