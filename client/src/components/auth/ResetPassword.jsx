import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ErrorState } from '../ui/ErrorState';
import { AuthStep, STRONG_PASSWORD } from './AuthLayout';
import { PasswordChecklist } from './Register';
import { mockAuthApi } from './api';

export function ResetPassword({ onNavigate, email = '', otp = '' }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { password: '', confirmPassword: '' },
  });
  const passwordVal = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    setFormError('');
    try {
      await mockAuthApi.confirmPasswordReset(email, otp, data.password);
      toast.success('Password updated. Sign in with your new password.');
      onNavigate?.('login');
    } catch (err) {
      setFormError(err.message || 'The code may have expired. Request a new one and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStep
      title="Choose a new password"
      description={<>For <span className="font-medium text-fg">{email}</span></>}
      onBack={() => onNavigate?.('login')}
      backLabel="Back to sign in"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {formError && (
          <ErrorState
            variant="inline"
            title="Couldn’t reset password"
            description={formError}
            onRetry={() => onNavigate?.('forgot-password')}
            retryLabel="New code"
          />
        )}
        <div className="flex flex-col gap-2">
          <Input
            label="New password"
            size="lg"
            revealable
            autoComplete="new-password"
            aria-describedby="reset-pw-rules"
            error={errors.password?.message}
            {...register('password', {
              required: 'Create a new password.',
              minLength: { value: 8, message: 'Use at least 8 characters.' },
              pattern: { value: STRONG_PASSWORD, message: 'Include upper and lowercase letters and a number.' },
            })}
          />
          <PasswordChecklist id="reset-pw-rules" value={passwordVal} />
        </div>
        <Input
          label="Confirm new password"
          size="lg"
          revealable
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Confirm your new password.',
            validate: (val) => val === passwordVal || 'Passwords don’t match.',
          })}
        />
        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-2">
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthStep>
  );
}
