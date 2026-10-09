import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ErrorState } from '../ui/ErrorState';
import { AuthStep, EMAIL_PATTERN } from './AuthLayout';
import { mockAuthApi } from './api';

export function ForgotPassword({ onNavigate, setEmailState, defaultEmail = '' }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { email: defaultEmail } });

  const onSubmit = async (data) => {
    setLoading(true);
    setFormError('');
    try {
      await mockAuthApi.requestPasswordReset(data.email);
      // Generic message regardless of whether the email exists — never reveal account existence.
      toast.success('If an account exists for that email, we’ve sent a code.');
      setEmailState?.(data.email.trim());
      onNavigate?.('otp-verification');
    } catch (err) {
      setFormError(err.message || 'We couldn’t send a code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStep
      title="Reset your password"
      description="Enter the email you signed up with and we’ll send a 6‑digit code."
      onBack={() => onNavigate?.('login')}
      backLabel="Back to sign in"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {formError && <ErrorState variant="inline" title="Request failed" description={formError} />}
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
        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
          {loading ? 'Sending code…' : 'Send code'}
        </Button>
      </form>
    </AuthStep>
  );
}
