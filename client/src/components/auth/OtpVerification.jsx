import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { AuthStep } from './AuthLayout';
import { mockAuthApi } from './api';

const LENGTH = 6;
const RESEND_SECONDS = 60;

export function OtpVerification({ onNavigate, email = '', setOtpState }) {
  const toast = useToast();
  const [digits, setDigits] = useState(Array(LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(RESEND_SECONDS);
  const inputs = useRef([]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  useEffect(() => {
    const t = setTimeout(() => inputs.current[0]?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const focus = (i) => inputs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  const fill = (startIndex, text) => {
    const clean = text.replace(/\D/g, '');
    if (!clean) return;
    const next = [...digits];
    clean.split('').slice(0, LENGTH - startIndex).forEach((ch, k) => { next[startIndex + k] = ch; });
    setDigits(next);
    setError('');
    focus(Math.min(startIndex + clean.length, LENGTH - 1));
  };

  const onChange = (i, value) => {
    if (!/^\d*$/.test(value)) return;
    if (value.length > 1) { fill(i, value); return; } // autofill / fast typing
    const next = [...digits];
    next[i] = value;
    setDigits(next);
    setError('');
    if (value && i < LENGTH - 1) focus(i + 1);
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      focus(i - 1);
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1); }
  };

  const onPaste = (i, e) => {
    e.preventDefault();
    fill(i, e.clipboardData.getData('text'));
  };

  const resend = async () => {
    setTimeLeft(RESEND_SECONDS);
    try {
      await mockAuthApi.requestPasswordReset(email);
      toast.success('If an account exists for that email, a new code is on its way.');
    } catch (err) {
      toast.error(err.message || 'We couldn’t resend the code.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < LENGTH) { setError('Enter all 6 digits.'); return; }
    setLoading(true);
    setError('');
    try {
      await mockAuthApi.verifyResetOtp(email, code);
      setOtpState?.(code);
      onNavigate?.('reset-password');
    } catch (err) {
      setError(err.message || 'That code didn’t work. Check it and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStep
      title="Check your email"
      description={
        <>We sent a 6-digit code to <span className="font-medium text-fg">{email || 'your email'}</span>. It expires in a few minutes.</>
      }
      onBack={() => onNavigate?.('forgot-password')}
      backLabel="Use a different email"
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <fieldset>
          <legend className="sr-only">Verification code</legend>
          <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                value={d}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={LENGTH}
                aria-label={`Digit ${i + 1}`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'otp-error' : undefined}
                className="field-control !h-14 !px-0 text-center font-mono text-xl font-medium tabular"
              />
            ))}
          </div>
        </fieldset>

        {error && <div id="otp-error"><ErrorState variant="inline" title="That code didn’t work" description={error} /></div>}

        <Button type="submit" size="lg" fullWidth loading={loading}>
          {loading ? 'Verifying…' : 'Verify code'}
        </Button>

        <p className="text-center text-[13.5px] text-fg-3">
          Didn’t get it?{' '}
          {timeLeft > 0 ? (
            <span className="tabular">Resend in 0:{String(timeLeft).padStart(2, '0')}</span>
          ) : (
            <button type="button" onClick={resend} className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              Resend code
            </button>
          )}
        </p>
      </form>
    </AuthStep>
  );
}
