import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from './api';

export function OtpVerification({ onNavigate, email = 'admin@demo.com' }) {
  const toast = useToast();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, []);

  const handleChange = (index, val) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[index] = val.substring(val.length - 1);
    setOtp(newOtp);
    if (newOtp[index] && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otp];
      if (!newOtp[index] && index > 0) {
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }

    // Allow arrow key navigation
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle paste — fill all 6 digits at once
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!pasted) return;
    const newOtp = ['', '', '', '', '', ''];
    pasted.split('').forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);
    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleResend = async () => {
    setTimeLeft(60);
    try {
      await mockAuthApi.forgotPassword(email);
      toast.success('A new verification code was sent.');
    } catch (err) {
      toast.error(err.message || 'Resend request failed.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      toast.error('Please enter the full 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await mockAuthApi.verifyOtp(email, otpCode);
      toast.success('Verified successfully!');
      if (onNavigate) onNavigate('reset-password');
    } catch (err) {
      toast.error(err.message || 'Verification failed.');
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
          Verify Email
        </h1>
        <p
          className="text-[14px]"
          style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
        >
          We sent a 6-digit code to{' '}
          <span
            className="font-medium select-all"
            style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-sans)' }}
          >
            {email}
          </span>
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
        noValidate
      >
        {/* OTP Label */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[11px] font-medium uppercase tracking-widest"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
          >
            One-Time Code
          </label>

          {/* OTP Input Grid */}
          <div className="flex items-center gap-2 sm:gap-3">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={idx === 0 ? handlePaste : undefined}
                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                className="flex-1 min-w-0 h-14 text-center rounded-md text-[20px] font-semibold outline-none transition-all"
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${digit ? 'var(--border-hover)' : 'var(--border)'}`,
                  color: 'var(--fg)',
                  fontFamily: 'var(--font-mono, monospace)',
                  caretColor: 'var(--fg)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = digit
                    ? 'var(--border-hover)'
                    : 'var(--border)';
                }}
              />
            ))}
          </div>
        </div>

        {/* Timer / Resend */}
        <div className="flex items-center justify-center h-6">
          {timeLeft > 0 ? (
            <span
              className="flex items-center gap-1.5 text-[13px]"
              style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
            >
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              Resend code in {timeLeft}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-[13px] cursor-pointer hover:underline transition-opacity hover:opacity-80"
              style={{
                color: 'var(--fg-2)',
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--font-sans)',
              }}
            >
              Resend verification code
            </button>
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
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>
      </form>

      {/* Footer */}
      <p
        className="mt-6 text-[13px] text-center"
        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}
      >
        Wrong email address?{' '}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('forgot-password')}
          className="font-medium cursor-pointer hover:underline transition-opacity hover:opacity-80"
          style={{
            color: 'var(--fg-2)',
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Change email
        </button>
      </p>
    </motion.div>
  );
}