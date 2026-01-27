/**
 * Mail Service
 * Centralized mail utility for all email operations
 */

import { getTransporter, mailConfig } from '../config/mail.config.js';
import {
  otpTemplate,
  welcomeTemplate,
  eventRegistrationTemplate,
  adminNotificationTemplate,
  accountApprovalTemplate,
  accountRejectionTemplate,
  notificationEmailTemplate,
} from '../templates/email/index.js';
import {
  canSendAdminEmail,
  recordAdminEmailSent,
  queueNotification,
  getPendingNotifications,
  hasPendingNotifications,
} from '../utils/adminMailLimiter.js';
import { getAdminEmails } from '../utils/adminEmailService.js';

/**
 * Send email with error handling
 * @param {Object} mailOptions - Nodemailer mail options
 * @returns {Object} - Result with success status
 */
const sendEmail = async (mailOptions) => {
  const transporter = getTransporter();
  
  if (!transporter) {
    console.warn('📧 Mail transporter not available. Email not sent.');
    return {
      success: false,
      error: 'Mail service not configured',
    };
  }
  
  try {
    const info = await transporter.sendMail({
      from: mailConfig.fromString,
      ...mailOptions,
    });
    
    console.log(`✅ Email sent successfully: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
    };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send OTP verification email
 * @param {string} to - Recipient email
 * @param {string} otp - OTP code
 * @param {string} username - Username (optional)
 * @param {number} expiryMinutes - OTP expiry time in minutes
 * @returns {Object} - Send result
 */
const sendOTPEmail = async (to, otp, username = '', expiryMinutes = 5) => {
  const template = otpTemplate(otp, username, expiryMinutes);
  
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * Send welcome email after registration
 * @param {string} to - Recipient email
 * @param {string} username - Username
 * @returns {Object} - Send result
 */
const sendWelcomeEmail = async (to, username) => {
  const template = welcomeTemplate(username, to);
  
  const result = await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
  
  // Also notify admin about new registration (respecting rate limits)
  await notifyAdmin({
    type: 'user_registration',
    data: {
      username,
      email: to,
      registeredAt: new Date().toISOString(),
    },
  });
  
  return result;
};

/**
 * Send event registration confirmation email
 * @param {string} to - Recipient email
 * @param {string} username - Username
 * @param {Object} eventDetails - Event details object
 * @returns {Object} - Send result
 */
const sendEventRegistrationEmail = async (to, username, eventDetails) => {
  const template = eventRegistrationTemplate(username, eventDetails);
  
  const result = await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
  
  // Also notify admin about event registration (respecting rate limits)
  await notifyAdmin({
    type: 'event_registration',
    data: {
      username,
      email: to,
      eventName: eventDetails.eventName,
      eventId: eventDetails.eventId,
      registeredAt: new Date().toISOString(),
    },
  });
  
  return result;
};

/**
 * Send notification to admin with rate limiting
 * Dynamically fetches admin emails from database
 * @param {Object} notification - Notification object with type and data
 * @returns {Object} - Send result
 */
const notifyAdmin = async (notification) => {
  // Dynamically get admin emails from database
  const adminEmails = await getAdminEmails();
  
  if (!adminEmails || adminEmails.length === 0) {
    console.warn('📧 No admin users found. Admin notification skipped.');
    return { success: false, error: 'No admin users in database' };
  }
  
  // Check if we can send email
  if (canSendAdminEmail()) {
    // Send to all admins
    const template = adminNotificationTemplate(notification);
    const results = await Promise.all(
      adminEmails.map(adminEmail => 
        sendEmail({
          to: adminEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
        })
      )
    );
    
    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      recordAdminEmailSent();
    }
    
    console.log(`📧 Admin notification sent to ${successCount}/${adminEmails.length} admin(s)`);
    
    return {
      success: successCount > 0,
      sentTo: successCount,
      totalAdmins: adminEmails.length,
    };
  } else {
    // Queue the notification
    queueNotification(notification);
    console.log('📧 Admin email limit reached. Notification queued for summary.');
    return {
      success: true,
      queued: true,
      message: 'Notification queued for summary email',
    };
  }
};

/**
 * Send aggregated summary email to admin
 * Called by a scheduled job when there are pending notifications
 * Dynamically fetches admin emails from database
 * @returns {Object} - Send result
 */
const sendAdminSummaryEmail = async () => {
  // Dynamically get admin emails from database
  const adminEmails = await getAdminEmails();
  
  if (!adminEmails || adminEmails.length === 0) {
    console.warn('📧 No admin users found. Summary email skipped.');
    return { success: false, error: 'No admin users in database' };
  }
  
  if (!hasPendingNotifications()) {
    return { success: true, message: 'No pending notifications' };
  }
  
  if (!canSendAdminEmail()) {
    console.log('📧 Cannot send summary email. Daily limit reached.');
    return { success: false, error: 'Daily email limit reached' };
  }
  
  const pendingNotifications = getPendingNotifications();
  
  const template = adminNotificationTemplate({
    type: 'summary',
    summary: pendingNotifications,
  });
  
  // Send to all admins
  const results = await Promise.all(
    adminEmails.map(adminEmail => 
      sendEmail({
        to: adminEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
    )
  );
  
  const successCount = results.filter(r => r.success).length;
  if (successCount > 0) {
    recordAdminEmailSent();
  }
  
  console.log(`📧 Admin summary sent to ${successCount}/${adminEmails.length} admin(s)`);
  
  return {
    success: successCount > 0,
    sentTo: successCount,
    totalAdmins: adminEmails.length,
  };
};

/**
 * Send custom email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text content (optional)
 * @returns {Object} - Send result
 */
const sendCustomEmail = async (to, subject, html, text = '') => {
  return sendEmail({
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
  });
};

/**
 * Send email to multiple recipients
 * @param {Array} recipients - Array of email addresses
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text content (optional)
 * @returns {Object} - Send results
 */
const sendBulkEmail = async (recipients, subject, html, text = '') => {
  const results = await Promise.allSettled(
    recipients.map(to => sendEmail({
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    }))
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;
  
  console.log(`📧 Bulk email: ${successful} sent, ${failed} failed`);
  
  return {
    success: failed === 0,
    total: recipients.length,
    successful,
    failed,
    results,
  };
};

/**
 * Send account approval email
 * @param {string} to - Recipient email
 * @param {string} username - Username
 * @returns {Object} - Send result
 */
const sendAccountApprovalEmail = async (to, username) => {
  const template = accountApprovalTemplate(username, to);
  
  console.log(`📧 Sending account approval email to ${to}`);
  
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * Send account rejection email
 * @param {string} to - Recipient email
 * @param {string} username - Username
 * @param {string} reason - Rejection reason (optional)
 * @returns {Object} - Send result
 */
const sendAccountRejectionEmail = async (to, username, reason = null) => {
  const template = accountRejectionTemplate(username, to, reason);
  
  console.log(`📧 Sending account rejection email to ${to}`);
  
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

/**
 * Send notification email
 * @param {string} to - Recipient email
 * @param {string} username - Username
 * @param {Object} notification - Notification object with type, message, title, data, priority
 * @returns {Object} - Send result
 */
const sendNotificationEmail = async (to, username, notification) => {
  const template = notificationEmailTemplate(username, notification);
  
  console.log(`📧 Sending notification email to ${to}: ${notification.type}`);
  
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

export {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendEventRegistrationEmail,
  notifyAdmin,
  sendAdminSummaryEmail,
  sendCustomEmail,
  sendBulkEmail,
  sendAccountApprovalEmail,
  sendAccountRejectionEmail,
  sendNotificationEmail,
};
