import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './ui/Toast';
import OTPInput from './OTPInput';
import { API_BASE_URL } from '../utils/api';

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ open, onClose }) => {
  const { addToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const resetState = () => {
    setStep(1);
    setEmail('');
    setOtp('');
    setNewPassword('');
    setLoading(false);
    setExpiresAt(null);
  };

  const closeModal = () => {
    resetState();
    onClose();
  };

  const requestReset = async () => {
    if (!email.trim()) {
      addToast({ type: 'error', title: 'Email required', message: 'Please enter your registered email.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send OTP');
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
      addToast({ type: 'success', title: 'OTP Sent', message: 'We sent a verification code to your email.' });
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send OTP. Check email and try again.';
      addToast({ type: 'error', title: 'Request Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      addToast({ type: 'error', title: 'Invalid OTP', message: 'Please enter the 6-digit code.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/password-reset/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Invalid or expired OTP');
      addToast({ type: 'success', title: 'OTP Verified', message: 'Please set a new password.' });
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired OTP.';
      addToast({ type: 'error', title: 'Verification Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPwd.test(newPassword)) {
      addToast({ type: 'error', title: 'Weak Password', message: 'Use at least 8 chars with upper, lower, and a number.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/password-reset/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Password reset failed');
      addToast({ type: 'success', title: 'Password Updated', message: 'You can now log in with your new password.' });
      closeModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reset password. Try again.';
      addToast({ type: 'error', title: 'Reset Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white w-full max-w-md mx-4 rounded-xl shadow-xl border border-neutral-200"
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Forgot Password</h3>
              <p className="text-sm text-neutral-600 mb-4">Reset your password securely using an OTP sent to your email.</p>

              {step === 1 && (
                <div className="space-y-4">
                  <label htmlFor="fp-email" className="block text-sm font-semibold text-neutral-800">Registered Email</label>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent bg-white"
                    placeholder="you@example.com"
                  />
                  <button
                    onClick={requestReset}
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-900 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Send OTP'}
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-neutral-800">Enter OTP</label>
                  <OTPInput length={6} value={otp} onChange={setOtp} onComplete={(code) => setOtp(code)} />
                  {expiresAt && (
                    <p className="text-xs text-neutral-500">Code expires at {expiresAt.toLocaleTimeString()}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 px-3 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50"
                    >Back</button>
                    <button
                      onClick={verifyOtp}
                      disabled={loading}
                      className="flex-1 py-2.5 px-3 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-900 disabled:opacity-50"
                    >{loading ? 'Verifying…' : 'Verify'}</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <label htmlFor="fp-newpwd" className="block text-sm font-semibold text-neutral-800">New Password</label>
                  <input
                    id="fp-newpwd"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-400 focus:border-transparent bg-white"
                    placeholder="••••••••"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 px-3 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50"
                    >Back</button>
                    <button
                      onClick={resetPassword}
                      disabled={loading}
                      className="flex-1 py-2.5 px-3 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-900 disabled:opacity-50"
                    >{loading ? 'Updating…' : 'Reset Password'}</button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={closeModal}
                className="w-full py-2.5 px-3 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50"
                aria-label="Close forgot password"
              >Cancel</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;
