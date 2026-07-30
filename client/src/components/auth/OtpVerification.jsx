import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, ShieldCheck } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { mockAuthApi } from './api';
import { Button } from '../ui/Button';

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
    setTimeout(() => {
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }, 50);
  }, []);

  const handleChange = (index, val) => {
    if (isNaN(val)) return;

    const newOtp = [...otp];
    newOtp[index] = val.substring(val.length - 1);
    setOtp(newOtp);

    if (newOtp[index] && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otp];
      if (!newOtp[index] && index > 0) {
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1].focus();
      } else {
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  const handleResend = async () => {
    setTimeLeft(60);
    try {
      await mockAuthApi.forgotPassword(email);
      toast.success('A new OTP verification code was sent.');
    } catch (err) {
      toast.error(err.message || 'Resend request failed.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      toast.error('Please enter the full 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      await mockAuthApi.verifyOtp(email, otpCode);
      toast.success('OTP verified successfully!');
      if (onNavigate) onNavigate('reset-password');
    } catch (err) {
      toast.error(err.message || 'OTP verification failed.');
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
          onClick={() => onNavigate('forgot-password')}
          className="flex items-center gap-1.5 text-xs transition-colors self-start cursor-pointer group font-semibold"
          style={{ color: 'var(--fg-3)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Change Email
        </button>

        <div className="text-center relative z-10">
          <div className="w-10 h-10 rounded-md flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="hero-title text-3xl font-normal mb-1" style={{ color: 'var(--fg)' }}>
            Security Verification
          </h2>
          <div className="flex flex-col gap-1 text-xs mt-2 font-sans" style={{ color: 'var(--fg-3)' }}>
            <span>We sent a 6-digit OTP code to:</span>
            <span className="font-semibold select-all" style={{ color: 'var(--fg)' }}>{email}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
          <div className="flex justify-between items-center gap-2">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                pattern="[0-9]*"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-12 h-14 text-center rounded-md font-mono text-xl font-bold outline-none transition-all duration-150 shadow-sm"
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold">
            {timeLeft > 0 ? (
              <span className="flex items-center gap-1 font-sans" style={{ color: 'var(--fg-3)' }}>
                <Clock className="w-3.5 h-3.5" />
                Resend code in {timeLeft}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="hover:underline cursor-pointer font-sans"
                style={{ color: 'var(--accent)' }}
              >
                Resend OTP Code
              </button>
            )}
          </div>

          <Button
            type="submit"
            loading={loading}
            variant="accent"
            className="w-full font-medium rounded-md h-11 mt-2 shadow-sm"
          >
            Verify Security Code
          </Button>
        </form>

      </div>
    </motion.div>
  );
}
