import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Check } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ErrorState } from '../ui/ErrorState';
import { AuthStep, TextLink, EMAIL_PATTERN, STRONG_PASSWORD } from './AuthLayout';
import { mockAuthApi } from './api';

export function PasswordChecklist({ value = '', id }) {
  const rules = [
    { ok: value.length >= 8, label: '8+ characters' },
    { ok: /[A-Z]/.test(value) && /[a-z]/.test(value), label: 'Upper & lowercase' },
    { ok: /\d/.test(value), label: 'A number' },
  ];
  return (
    <ul id={id} className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Password requirements">
      {rules.map((r) => (
        <li key={r.label} className={`flex items-center gap-1.5 text-xs transition-colors ${r.ok ? 'text-success' : 'text-fg-3'}`}>
          <span className={`inline-flex size-3.5 items-center justify-center rounded-full ${r.ok ? 'bg-success-dim' : 'border border-border-strong'}`}>
            {r.ok && <Check className="size-2.5" strokeWidth={3} aria-hidden />}
          </span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}

export function Register({ onNavigate, onRegistered }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });
  const passwordVal = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    setFormError('');
    try {
      const res = await mockAuthApi.register(data.username, data.email, data.password);
      if (res?.access && res?.user && onRegistered) {
        toast.success('Your account is ready.');
        onRegistered({
          username: res.user.full_name || data.username.trim(),
          email: res.user.email,
          role: res.user.role || 'student',
          avatar: res.user.avatar || null,
        });
      } else {
        toast.success('Account created. Please sign in.');
        onNavigate?.('login');
      }
    } catch (err) {
      setFormError(err.message || 'We couldn’t create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStep
      title="Create your account"
      description="Students can sign up with their university email."
      footer={<>Already have an account? <TextLink onClick={() => onNavigate?.('login')}>Sign in</TextLink></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {formError && <ErrorState variant="inline" title="Couldn’t create account" description={formError} />}
        <Input
          label="Full name"
          size="lg"
          autoComplete="name"
          placeholder="Maya Okafor"
          error={errors.username?.message}
          {...register('username', {
            required: 'Enter your name.',
            minLength: { value: 3, message: 'Use at least 3 characters.' },
          })}
        />
        <Input
          label="Email"
          type="email"
          size="lg"
          autoComplete="email"
          inputMode="email"
          placeholder="you@university.edu"
          error={errors.email?.message}
          {...register('email', {
            required: 'Enter your email address.',
            pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address.' },
          })}
        />
        <div className="flex flex-col gap-2">
          <Input
            label="Password"
            size="lg"
            revealable
            autoComplete="new-password"
            placeholder="Create a password"
            aria-describedby="register-pw-rules"
            error={errors.password?.message}
            {...register('password', {
              required: 'Create a password.',
              minLength: { value: 8, message: 'Use at least 8 characters.' },
              pattern: { value: STRONG_PASSWORD, message: 'Include upper and lowercase letters and a number.' },
            })}
          />
          <PasswordChecklist id="register-pw-rules" value={passwordVal} />
        </div>
        <Input
          label="Confirm password"
          size="lg"
          revealable
          autoComplete="new-password"
          placeholder="Repeat your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Confirm your password.',
            validate: (val) => val === passwordVal || 'Passwords don’t match.',
          })}
        />
        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthStep>
  );
}
