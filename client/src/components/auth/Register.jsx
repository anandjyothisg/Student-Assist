import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from './api';

function AuthInput({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          className="text-[11px] font-medium uppercase tracking-widest"
          style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
        >
          {label}
        </label>
      )}
      {children}
      {error && (
        <span className="text-[11px]" style={{ color: 'var(--error)' }}>
          {error}
        </span>
      )}
    </div>
  );
}

function StyledInput({ hasError, extraClass = '', ...props }) {
  return (
    <input
      className={`w-full h-11 px-4 rounded-md text-[14px] outline-none transition-all ${extraClass}`}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${hasError ? 'var(--error)' : 'var(--border)'}`,
        color: 'var(--fg)',
        fontFamily: 'var(--font-sans)',
      }}
      onFocus={(e) => {
        if (!hasError) e.currentTarget.style.borderColor = 'var(--border-hover)';
      }}
      onBlur={(e) => {
        if (!hasError) e.currentTarget.style.borderColor = hasError ? 'var(--error)' : 'var(--border)';
      }}
      {...props}
    />
  );
}

export function Register({ onNavigate }) {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' }
  });

  const passwordVal = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await mockAuthApi.register(data.username, data.email, data.password);
      toast.success('Account created. Please sign in.');
      if (onNavigate) onNavigate('login');
    } catch (err) {
      toast.error(err.message || 'Registration failed.');
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
          Create account
        </h1>
        <p
          className="text-[14px]"
          style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
        >
          Join your AI-powered learning workspace
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Username */}
        <AuthInput label="Username" error={errors.username?.message}>
          <StyledInput
            type="text"
            placeholder=" your username"
            hasError={!!errors.username}
            {...register('username', {
              required: 'Username is required',
              minLength: { value: 3, message: 'At least 3 characters' },
            })}
          />
        </AuthInput>

        {/* Email */}
        <AuthInput label="Email" error={errors.email?.message}>
          <StyledInput
            type="text"
            placeholder="you@university.edu"
            hasError={!!errors.email}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />
        </AuthInput>

        {/* Password */}
        <AuthInput label="Password" error={errors.password?.message}>
          <div className="relative">
            <StyledInput
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              hasError={!!errors.password}
              extraClass="pr-11"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'At least 8 characters' },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Must include uppercase, lowercase, and a number',
                },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer"
              style={{ color: 'var(--fg-3)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--fg-2)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-3)'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </AuthInput>

        {/* Confirm Password */}
        <AuthInput label="Confirm Password" error={errors.confirmPassword?.message}>
          <StyledInput
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            hasError={!!errors.confirmPassword}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (val) => val === passwordVal || 'Passwords do not match',
            })}
          />
        </AuthInput>

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
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      {/* Footer */}
      <p
        className="mt-6 text-[13px] text-center"
        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
      >
        Already have an account?{' '}
        <button
          onClick={() => onNavigate && onNavigate('login')}
          className="font-medium cursor-pointer hover:underline"
          style={{ color: 'var(--fg-2)' }}
        >
          Sign in
        </button>
      </p>
    </motion.div>
  );
}