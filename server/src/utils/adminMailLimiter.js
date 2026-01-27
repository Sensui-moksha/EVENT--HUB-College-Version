/**
 * Admin Mail Limiter
 * Rate-limiting system to ensure admin receives no more than 3 emails per day
 * Aggregates multiple notifications into a single email when limit is reached
 */

// In-memory storage for rate limiting (in production, use Redis or database)
const adminMailState = {
  emailsSentToday: 0,
  lastResetDate: new Date().toDateString(),
  pendingNotifications: [],
  maxEmailsPerDay: 3,
};

/**
 * Reset daily counter if it's a new day
 */
const checkAndResetDailyLimit = () => {
  const today = new Date().toDateString();
  
  if (adminMailState.lastResetDate !== today) {
    // ...removed console log for production...
    adminMailState.emailsSentToday = 0;
    adminMailState.lastResetDate = today;
    adminMailState.pendingNotifications = [];
  }
};

/**
 * Check if admin can receive more emails today
 * @returns {boolean}
 */
const canSendAdminEmail = () => {
  checkAndResetDailyLimit();
  return adminMailState.emailsSentToday < adminMailState.maxEmailsPerDay;
};

/**
 * Get remaining email quota for today
 * @returns {number}
 */
const getRemainingQuota = () => {
  checkAndResetDailyLimit();
  return Math.max(0, adminMailState.maxEmailsPerDay - adminMailState.emailsSentToday);
};

/**
 * Record that an email was sent to admin
 */
const recordAdminEmailSent = () => {
  checkAndResetDailyLimit();
  adminMailState.emailsSentToday++;
  // ...removed console log for production...
};

/**
 * Add notification to pending queue
 * @param {Object} notification - The notification to queue
 */
const queueNotification = (notification) => {
  checkAndResetDailyLimit();
  adminMailState.pendingNotifications.push({
    ...notification,
    timestamp: new Date().toISOString(),
  });
  // ...removed console log for production...
};

/**
 * Get all pending notifications and clear the queue
 * @returns {Array}
 */
const getPendingNotifications = () => {
  checkAndResetDailyLimit();
  const notifications = [...adminMailState.pendingNotifications];
  adminMailState.pendingNotifications = [];
  return notifications;
};

/**
 * Check if there are pending notifications
 * @returns {boolean}
 */
const hasPendingNotifications = () => {
  checkAndResetDailyLimit();
  return adminMailState.pendingNotifications.length > 0;
};

/**
 * Get current state (for debugging/monitoring)
 * @returns {Object}
 */
const getState = () => {
  checkAndResetDailyLimit();
  return {
    emailsSentToday: adminMailState.emailsSentToday,
    maxEmailsPerDay: adminMailState.maxEmailsPerDay,
    remainingQuota: getRemainingQuota(),
    pendingNotificationsCount: adminMailState.pendingNotifications.length,
    lastResetDate: adminMailState.lastResetDate,
  };
};

/**
 * Set max emails per day (for configuration)
 * @param {number} max
 */
const setMaxEmailsPerDay = (max) => {
  if (typeof max === 'number' && max > 0) {
    adminMailState.maxEmailsPerDay = max;
    // ...removed console log for production...
  }
};

export {
  canSendAdminEmail,
  getRemainingQuota,
  recordAdminEmailSent,
  queueNotification,
  getPendingNotifications,
  hasPendingNotifications,
  getState,
  setMaxEmailsPerDay,
};
