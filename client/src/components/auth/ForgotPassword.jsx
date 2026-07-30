import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from './api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

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
    }
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto font-sans"
    >
      <div className="shadow-premium-xl rounded-md p-8 relative overflow-hidden flex flex-col gap-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        
        {/* Glow Sphere */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: 'var(--accent-dim)' }} />

        <button
          onClick={() => onNavigate('login')}
          className="flex items-center gap-1.5 text-xs transition-colors self-start cursor-pointer group font-semibold"
          style={{ color: 'var(--fg-3)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Sign In
        </button>

        <div className="text-center relative z-10">
          <div className="w-10 h-10 rounded-md flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="hero-title text-3xl font-normal mb-1" style={{ color: 'var(--fg)' }}>
            Forgot Password
          </h2>
          <p className="text-xs font-normal" style={{ color: 'var(--fg-3)' }}>
            Enter your email to receive a 6-digit OTP code
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 relative z-10">
          <Input
            label="Email Address"
            type="text"
            placeholder="student@demo.com"
            iconLeft={Mail}
            error={errors.email?.message}
            {...register('email', {
              required: 'Email address is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address format',
              },
            })}
          />

          <Button
            type="submit"
            loading={loading}
            variant="accent"
            className="w-full font-medium rounded-md h-11 mt-2 shadow-sm"
          >
            Send Verification Code
          </Button>
        </form>

      </div>
    </motion.div>
  );
}
