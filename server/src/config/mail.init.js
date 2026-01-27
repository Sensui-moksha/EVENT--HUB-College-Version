/**
 * Mail System Initialization
 * Initialize mail transporter and schedule cleanup jobs
 */

import { initializeMailTransporter } from '../config/mail.config.js';
import { cleanupExpiredOTPs } from '../services/otp.service.js';
import { sendAdminSummaryEmail } from '../services/mail.service.js';
import { hasPendingNotifications, getState } from '../utils/adminMailLimiter.js';

let otpCleanupInterval = null;
let adminSummaryInterval = null;

/**
 * Initialize the mail system
 * Call this function when the server starts
 */
const initializeMailSystem = async () => {
  // ...removed console log for production...
  
  // Initialize mail transporter
  await initializeMailTransporter();
  
  // Set up OTP cleanup interval (every 10 minutes)
  if (otpCleanupInterval) clearInterval(otpCleanupInterval);
  otpCleanupInterval = setInterval(cleanupExpiredOTPs, 10 * 60 * 1000);
  // ...removed console log for production...
  
  // Set up admin summary email interval (every 6 hours)
  // This sends pending notifications as a summary if any exist
  if (adminSummaryInterval) clearInterval(adminSummaryInterval);
  adminSummaryInterval = setInterval(async () => {
    if (hasPendingNotifications()) {
      // ...removed console log for production...
      await sendAdminSummaryEmail();
    }
  }, 6 * 60 * 60 * 1000); // 6 hours
  // ...removed console log for production...
  
  // ...removed console log for production...
  
  return {
    otpCleanupInterval,
    adminSummaryInterval,
  };
};

/**
 * Graceful shutdown - clear all intervals
 */
const shutdownMailSystem = () => {
  // ...removed console log for production...
  
  if (otpCleanupInterval) {
    clearInterval(otpCleanupInterval);
    otpCleanupInterval = null;
  }
  
  if (adminSummaryInterval) {
    clearInterval(adminSummaryInterval);
    adminSummaryInterval = null;
  }
  
  // ...removed console log for production...
};

/**
 * Get mail system status
 */
const getMailSystemStatus = () => {
  return {
    otpCleanupActive: otpCleanupInterval !== null,
    adminSummaryActive: adminSummaryInterval !== null,
    adminMailLimiterState: getState(),
  };
};

export {
  initializeMailSystem,
  shutdownMailSystem,
  getMailSystemStatus,
};
