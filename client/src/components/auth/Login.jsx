import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ErrorState } from '../ui/ErrorState';
import { AuthStep, TextLink, EMAIL_PATTERN } from './AuthLayout';
import { mockAuthApi } from './api';

export function Login({ onNavigate, onLoginSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setFormError('');
    try {
      const result = await mockAuthApi.login(data.email, data.password);
      toast.success(`Welcome back, ${result.user.username}.`);
      onLoginSuccess?.(result.user);
    } catch (err) {
      setFormError(err.message || 'We couldn’t sign you in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStep
      title="Welcome back"
      description="Sign in to continue to your study workspace."
      footer={<>New to AuraStudy? <TextLink onClick={() => onNavigate?.('register')}>Create an account</TextLink></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {formError && <ErrorState variant="inline" title="Sign-in failed" description={formError} />}
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
        <Input
          label="Password"
          size="lg"
          revealable
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          action={
            <button
              type="button"
              onClick={() => onNavigate?.('forgot-password')}
              className="rounded-sm text-[13px] font-medium text-fg-3 transition-colors hover:text-fg"
            >
              Forgot password?
            </button>
          }
          {...register('password', { required: 'Enter your password.' })}
        />
        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthStep>
  );
}
