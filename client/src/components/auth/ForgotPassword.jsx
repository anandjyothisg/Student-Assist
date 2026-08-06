import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from './api';

export function ForgotPassword({ onNavigate, setEmailState }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await mockAuthApi.forgotPassword(data.email);
      toast.success('Verification code sent to your email.');
      if (setEmailState) setEmailState(data.email);
      if (onNavigate) onNavigate('otp-verification');
    } catch (err) {
      toast.error(err.message || 'Failed to request reset.');
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
          Forgot Password
        </h1>
        <p
          className="text-[14px]"
          style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
        >
          Enter your email to receive a 6-digit verification code
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[11px] font-medium uppercase tracking-widest"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
          >
            Email
          </label>
          <input
            type="email"
            placeholder="you@university.edu"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full h-11 px-4 rounded-md text-[14px] outline-none transition-all"
            style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${errors.email ? 'var(--error)' : 'var(--border)'}`,
              color: 'var(--fg)',
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={(e) => {
              if (!errors.email)
                e.currentTarget.style.borderColor = 'var(--border-hover)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = errors.email
                ? 'var(--error)'
                : 'var(--border)';
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
            <span
              className="text-[11px]"
              style={{ color: 'var(--error)', fontFamily: 'var(--font-sans)' }}
            >
              {errors.email.message}
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
          {loading ? 'Sending...' : 'Send Verification Code'}
        </button>
      </form>

      {/* Footer */}
      <p
        className="mt-6 text-[13px] text-center"
        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
      >
        Remember your password?{' '}
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