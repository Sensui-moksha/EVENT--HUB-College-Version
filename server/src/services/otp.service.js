/**
 * OTP Service
 * Handles OTP generation, storage, validation, and expiry
 */

import crypto from 'crypto';
import { sendOTPEmail } from './mail.service.js';

// In-memory OTP storage (in production, use Redis or database)
const otpStore = new Map();

// OTP Configuration
const OTP_CONFIG = {
  length: 6,
  expiryMinutes: 5,
  maxAttempts: 3,
};

/**
 * Generate a random OTP
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} - Generated OTP
 */
const generateOTP = (length = OTP_CONFIG.length) => {
  // Generate cryptographically secure random digits
  const digits = '0123456789';
  let otp = '';
  
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  
  return otp;
};

/**
 * Create and store OTP for a user
 * @param {string} identifier - User email or phone
 * @param {string} purpose - Purpose of OTP ('registration', 'login', 'reset_password')
 * @returns {Object} - OTP details
 */
const createOTP = (identifier, purpose = 'verification') => {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_CONFIG.expiryMinutes * 60 * 1000);
  
  const otpData = {
    // Store only a hash of the OTP for security
    otpHash: crypto.createHash('sha256').update(otp.toString()).digest('hex'),
    purpose,
    expiresAt,
    attempts: 0,
    createdAt: new Date(),
    verified: false,
  };
  
  // Store OTP with composite key
  const key = `${identifier}:${purpose}`;
  otpStore.set(key, otpData);
  
  console.log(`🔐 OTP created for ${identifier} (${purpose}), expires at ${expiresAt.toISOString()}`);
  
  return {
    otp,
    expiresAt,
    expiryMinutes: OTP_CONFIG.expiryMinutes,
  };
};

/**
 * Verify OTP for a user
 * @param {string} identifier - User email or phone
 * @param {string} otp - OTP to verify
 * @param {string} purpose - Purpose of OTP
 * @returns {Object} - Verification result
 */
const verifyOTP = (identifier, otp, purpose = 'verification') => {
  const key = `${identifier}:${purpose}`;
  const otpData = otpStore.get(key);
  
  // Check if OTP exists
  if (!otpData) {
    return {
      success: false,
      error: 'OTP not found or expired. Please request a new one.',
      code: 'OTP_NOT_FOUND',
    };
  }
  
  // Check if already verified
  if (otpData.verified) {
    return {
      success: false,
      error: 'OTP has already been used.',
      code: 'OTP_ALREADY_USED',
    };
  }
  
  // Check expiry
  if (new Date() > otpData.expiresAt) {
    otpStore.delete(key);
    return {
      success: false,
      error: 'OTP has expired. Please request a new one.',
      code: 'OTP_EXPIRED',
    };
  }
  
  // Check max attempts
  if (otpData.attempts >= OTP_CONFIG.maxAttempts) {
    otpStore.delete(key);
    return {
      success: false,
      error: 'Maximum verification attempts exceeded. Please request a new OTP.',
      code: 'MAX_ATTEMPTS_EXCEEDED',
    };
  }
  
  // Increment attempts
  otpData.attempts++;
  
  // Verify OTP using hash comparison (constant-time)
  const incomingHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');
  const isValid = crypto.timingSafeEqual(
    Buffer.from(incomingHash),
    Buffer.from(otpData.otpHash)
  );
  
  if (!isValid) {
    const remainingAttempts = OTP_CONFIG.maxAttempts - otpData.attempts;
    return {
      success: false,
      error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
      code: 'INVALID_OTP',
      remainingAttempts,
    };
  }
  
  // Mark as verified; for password reset, keep until reset completes
  otpData.verified = true;
  if (purpose !== 'reset_password') {
    otpStore.delete(key);
  } else {
    otpStore.set(key, otpData);
  }
  
  console.log(`✅ OTP verified successfully for ${identifier} (${purpose})`);
  
  return {
    success: true,
    message: 'OTP verified successfully.',
  };
};

/**
 * Send OTP via email
 * @param {string} email - User email
 * @param {string} username - Username (optional)
 * @param {string} purpose - Purpose of OTP
 * @returns {Object} - Send result
 */
const sendOTP = async (email, username = '', purpose = 'verification') => {
  try {
    // Create new OTP
    const { otp, expiresAt, expiryMinutes } = createOTP(email, purpose);
    
    // Send email
    const emailResult = await sendOTPEmail(email, otp, username, expiryMinutes);
    
    if (!emailResult.success) {
      // Remove OTP if email fails
      otpStore.delete(`${email}:${purpose}`);
      return {
        success: false,
        error: 'Failed to send OTP email. Please try again.',
      };
    }
    
    return {
      success: true,
      message: `OTP sent to ${email}`,
      expiresAt,
      expiryMinutes,
    };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return {
      success: false,
      error: 'Failed to send OTP. Please try again.',
    };
  }
};

/**
 * Resend OTP - invalidate old and create new
 * @param {string} email - User email
 * @param {string} username - Username (optional)
 * @param {string} purpose - Purpose of OTP
 * @returns {Object} - Send result
 */
const resendOTP = async (email, username = '', purpose = 'verification') => {
  // Remove existing OTP
  const key = `${email}:${purpose}`;
  otpStore.delete(key);
  
  // Send new OTP
  return sendOTP(email, username, purpose);
};

/**
 * Check if OTP exists and is valid (without verifying)
 * @param {string} identifier - User email or phone
 * @param {string} purpose - Purpose of OTP
 * @returns {boolean}
 */
const hasValidOTP = (identifier, purpose = 'verification') => {
  const key = `${identifier}:${purpose}`;
  const otpData = otpStore.get(key);
  
  if (!otpData) return false;
  if (otpData.verified) return false;
  if (new Date() > otpData.expiresAt) {
    otpStore.delete(key);
    return false;
  }
  
  return true;
};

/**
 * Get OTP expiry time
 * @param {string} identifier - User email or phone
 * @param {string} purpose - Purpose of OTP
 * @returns {Date|null}
 */
const getOTPExpiry = (identifier, purpose = 'verification') => {
  const key = `${identifier}:${purpose}`;
  const otpData = otpStore.get(key);
  
  if (!otpData) return null;
  return otpData.expiresAt;
};

/**
 * Clean up expired OTPs (call periodically)
 */
const cleanupExpiredOTPs = () => {
  const now = new Date();
  let cleaned = 0;
  
  for (const [key, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired OTP(s)`);
  }
};

// Export functions
export {
  generateOTP,
  createOTP,
  verifyOTP,
  sendOTP,
  resendOTP,
  hasValidOTP,
  getOTPExpiry,
  cleanupExpiredOTPs,
  OTP_CONFIG,
  otpStore,
};
