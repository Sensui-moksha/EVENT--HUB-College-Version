import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, RefreshCw, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import OTPInput from './OTPInput';
import { sendOTP, verifyOTP, resendOTP } from '../utils/otpService';

interface EmailVerificationModalProps {
  isOpen: boolean;
  email: string;
  username?: string;
  purpose?: 'verification' | 'registration' | 'login' | 'reset_password';
  onVerified: () => void;
  onClose: () => void;
  onBack?: () => void;
}

const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  email,
  username,
  purpose = 'registration',
  onVerified,
  onClose,
  onBack,
}) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Send OTP when modal opens
  useEffect(() => {
    if (isOpen && email && !otpSent) {
      handleSendOTP();
    }
  }, [isOpen, email]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Expiry countdown timer
  useEffect(() => {
    if (!expiryTime) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = expiryTime.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Expired');
        setError('OTP has expired. Please request a new one.');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiryTime]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setOtp('');
      setError('');
      setSuccess(false);
      setOtpSent(false);
      setExpiryTime(null);
      setTimeLeft('');
    }
  }, [isOpen]);

  const handleSendOTP = async () => {
    setSendingOtp(true);
    setError('');

    const result = await sendOTP(email, username, purpose);
    
    setSendingOtp(false);

    if (result.success) {
      setOtpSent(true);
      setResendCooldown(30); // 30 second cooldown
      if (result.expiresAt) {
        setExpiryTime(new Date(result.expiresAt));
      }
    } else {
      setError(result.error || 'Failed to send OTP');
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setSendingOtp(true);
    setError('');
    setOtp('');

    const result = await resendOTP(email, username, purpose);
    
    setSendingOtp(false);

    if (result.success) {
      setResendCooldown(30);
      if (result.expiresAt) {
        setExpiryTime(new Date(result.expiresAt));
      }
    } else {
      setError(result.error || 'Failed to resend OTP');
    }
  };

  const handleVerifyOTP = useCallback(async (otpValue: string) => {
    if (otpValue.length !== 6) return;

    setLoading(true);
    setError('');

    const result = await verifyOTP(email, otpValue, purpose);
    
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onVerified();
      }, 1000);
    } else {
      setError(result.error || 'Invalid OTP');
      if (result.remainingAttempts !== undefined) {
        setError(`Invalid OTP. ${result.remainingAttempts} attempt(s) remaining.`);
      }
    }
  }, [email, purpose, onVerified]);

  const handleOtpChange = (newOtp: string) => {
    setOtp(newOtp);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Verify Your Email</h2>
                  <p className="text-sm text-white/70">We sent a code to your email</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Email Display */}
            <div className="text-center mb-6">
              <p className="text-neutral-600 text-sm mb-1">Enter the 6-digit code sent to</p>
              <p className="font-semibold text-neutral-900">{email}</p>
            </div>

            {/* Success State */}
            {success ? (
              <motion.div
                className="text-center py-8"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-green-700">Email Verified!</h3>
                <p className="text-neutral-600 text-sm mt-1">Redirecting...</p>
              </motion.div>
            ) : (
              <>
                {/* OTP Input */}
                <div className="mb-6">
                  <OTPInput
                    value={otp}
                    onChange={handleOtpChange}
                    onComplete={handleVerifyOTP}
                    disabled={loading || sendingOtp}
                    error={!!error}
                  />
                </div>

                {/* Timer */}
                {timeLeft && timeLeft !== 'Expired' && (
                  <div className="flex items-center justify-center gap-2 text-neutral-500 text-sm mb-4">
                    <Clock className="w-4 h-4" />
                    <span>Code expires in {timeLeft}</span>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <motion.div
                    className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </motion.div>
                )}

                {/* Verify Button */}
                <button
                  onClick={() => handleVerifyOTP(otp)}
                  disabled={otp.length !== 6 || loading}
                  className={`
                    w-full py-3 rounded-lg font-semibold text-white
                    transition-all duration-200
                    ${otp.length === 6 && !loading
                      ? 'bg-neutral-800 hover:bg-neutral-900 active:scale-[0.98]'
                      : 'bg-neutral-300 cursor-not-allowed'
                    }
                  `}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    'Verify Email'
                  )}
                </button>

                {/* Resend Link */}
                <div className="text-center mt-4">
                  <p className="text-neutral-500 text-sm">
                    Didn't receive the code?{' '}
                    {resendCooldown > 0 ? (
                      <span className="text-neutral-400">
                        Resend in {resendCooldown}s
                      </span>
                    ) : (
                      <button
                        onClick={handleResendOTP}
                        disabled={sendingOtp}
                        className="text-neutral-800 font-semibold hover:underline disabled:opacity-50"
                      >
                        {sendingOtp ? 'Sending...' : 'Resend Code'}
                      </button>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200">
            <p className="text-xs text-neutral-500 text-center">
              Check your spam folder if you don't see the email in your inbox.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmailVerificationModal;
