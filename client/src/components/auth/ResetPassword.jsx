import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from './api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function ResetPassword({ onNavigate, email = 'admin@demo.com' }) {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  });

  const passwordVal = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await mockAuthApi.resetPassword(email, data.password);
      toast.success('Password updated successfully! Please login.');
      if (onNavigate) onNavigate('login');
    } catch (err) {
      toast.error(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto font-sans"
    >
      <div className="shadow-premium-xl rounded-md p-8 relative overflow-hidden flex flex-col gap-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        
        {/* Glow Sphere */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: 'var(--accent-dim)' }} />

        <div className="text-center relative z-10">
          <div className="w-10 h-10 rounded-md flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--success-dim)', border: '1px solid var(--success)', color: 'var(--success)' }}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h2 className="hero-title text-3xl font-normal mb-1" style={{ color: 'var(--fg)' }}>
            Reset Password
          </h2>
          <p className="text-xs font-normal" style={{ color: 'var(--fg-3)' }}>
            Enter your new secure password credential
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 relative z-10">
          <div className="flex flex-col gap-1 relative">
            <Input
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              iconLeft={Lock}
              error={errors.password?.message}
              {...register('password', {
                required: 'New password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Must include uppercase, lowercase, and numbers',
                }
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-9 cursor-pointer"
              style={{ color: 'var(--fg-3)' }}
              tabIndex="-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Input
            label="Confirm New Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            iconLeft={Lock}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword', {
              required: 'Please confirm your new password',
              validate: (val) => val === passwordVal || 'Passwords do not match',
            })}
          />

          <Button
            type="submit"
            loading={loading}
            variant="accent"
            className="w-full font-medium rounded-md h-11 mt-2 shadow-sm"
          >
            Update & Reset Password
          </Button>
        </form>

      </div>
    </motion.div>
  );
}
