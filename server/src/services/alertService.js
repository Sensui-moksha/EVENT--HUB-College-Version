/**
 * Automated Alert Service
 * 
 * Provides real-time alerting for critical system issues.
 * Features:
 * - Smart alert thresholds (no spam)
 * - Email notifications to configured recipients (from env)
 * - In-app notifications
 * - Alert history and deduplication
 * - Severity-based escalation
 * 
 * Environment Variables:
 * - HEALTH_MONITOR_EMAILS: Comma-separated list of emails to receive health alerts
 *   Example: HEALTH_MONITOR_EMAILS=admin1@example.com,admin2@example.com
 */

import { getTransporter, mailConfig } from '../config/mail.config.js';

/**
 * Get configured health monitoring email recipients from environment
 * @returns {string[]} Array of email addresses
 */
const getHealthMonitorEmails = () => {
  const emailsEnv = process.env.HEALTH_MONITOR_EMAILS || '';
  
  if (!emailsEnv.trim()) {
    console.warn('⚠️ HEALTH_MONITOR_EMAILS not configured in environment variables');
    return [];
  }
  
  // Parse comma-separated emails, trim whitespace, filter empty
  const emails = emailsEnv
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => {
      // Basic email validation
      const isValid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!isValid && email) {
        console.warn(`⚠️ Invalid email in HEALTH_MONITOR_EMAILS: ${email}`);
      }
      return isValid;
    });
  
  return emails;
};

// Alert storage
const alertHistory = [];
const MAX_ALERT_HISTORY = 500;

// Alert cooldown to prevent spam (in milliseconds)
// Max 5 alerts per day with 4-5 hour intervals
const ALERT_COOLDOWNS = {
  critical: 4 * 60 * 60 * 1000,    // 4 hours between same critical alerts
  warning: 4.5 * 60 * 60 * 1000,  // 4.5 hours between same warning alerts
  info: 5 * 60 * 60 * 1000,       // 5 hours between same info alerts
};

// Daily alert limit
const MAX_DAILY_ALERTS = 5;
const dailyAlertCount = { count: 0, date: new Date().toDateString() };

// Last alert timestamps by type
const lastAlertTimes = new Map();

// Socket.io reference (set by server)
let socketIO = null;

/**
 * Set Socket.IO instance for real-time notifications
 */
const setSocketIO = (io) => {
  socketIO = io;
};

/**
 * Reset daily alert count at midnight
 */
const resetDailyCountIfNeeded = () => {
  const today = new Date().toDateString();
  if (dailyAlertCount.date !== today) {
    dailyAlertCount.count = 0;
    dailyAlertCount.date = today;
  }
};

/**
 * Check if alert should be sent (cooldown + daily limit check)
 * Max 5 alerts per day with 4-5 hour intervals
 */
const shouldSendAlert = (alertType, severity) => {
  // Reset daily count if it's a new day
  resetDailyCountIfNeeded();
  
  // Check daily limit (max 5 emails per day)
  if (dailyAlertCount.count >= MAX_DAILY_ALERTS) {
    // Silently skip - no logging since emails are disabled anyway
    return false;
  }
  
  const key = `${alertType}-${severity}`;
  const lastTime = lastAlertTimes.get(key);
  const cooldown = ALERT_COOLDOWNS[severity] || ALERT_COOLDOWNS.warning;
  
  if (!lastTime || Date.now() - lastTime > cooldown) {
    lastAlertTimes.set(key, Date.now());
    dailyAlertCount.count++; // Increment daily count
    // Silently track count - no logging since emails are disabled
    return true;
  }
  
  // Silently skip cooldown - no logging to avoid terminal clutter
  return false;
};

/**
 * Generate alert email HTML
 */
const generateAlertEmailHTML = (alert) => {
  const severityColors = {
    critical: '#DC2626',
    warning: '#F59E0B',
    info: '#3B82F6',
  };
  
  const severityBgColors = {
    critical: '#FEE2E2',
    warning: '#FEF3C7',
    info: '#DBEAFE',
  };
  
  const color = severityColors[alert.severity] || severityColors.warning;
  const bgColor = severityBgColors[alert.severity] || severityBgColors.warning;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EventHub System Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F3F4F6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${color} 0%, ${alert.severity === 'critical' ? '#991B1B' : alert.severity === 'warning' ? '#D97706' : '#2563EB'} 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">
        ${alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'} System Alert
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">
        EventHub Monitoring System
      </p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Severity Badge -->
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="display: inline-block; background: ${bgColor}; color: ${color}; padding: 8px 16px; border-radius: 20px; font-weight: 600; text-transform: uppercase; font-size: 12px;">
          ${alert.severity}
        </span>
      </div>
      
      <!-- Alert Type -->
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #1F2937; margin: 0; font-size: 20px;">
          ${alert.type.replace(/_/g, ' ').toUpperCase()}
        </h2>
      </div>
      
      <!-- Message -->
      <div style="background: ${bgColor}; border-left: 4px solid ${color}; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">
          ${alert.message}
        </p>
      </div>
      
      <!-- Details -->
      ${alert.details ? `
      <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #6B7280; margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase;">Details</h3>
        <pre style="color: #374151; margin: 0; font-size: 13px; white-space: pre-wrap; word-break: break-word;">${JSON.stringify(alert.details, null, 2)}</pre>
      </div>
      ` : ''}
      
      <!-- Suggested Action -->
      ${alert.suggestedAction ? `
      <div style="background: #ECFDF5; border-left: 4px solid #10B981; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #065F46; margin: 0 0 10px 0; font-size: 14px;">💡 Suggested Action</h3>
        <p style="color: #047857; margin: 0; font-size: 14px;">
          ${alert.suggestedAction}
        </p>
      </div>
      ` : ''}
      
      <!-- Timestamp -->
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB;">
        <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
          Alert generated at: ${new Date(alert.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
      <p style="margin: 0;">This is an automated message from EventHub Monitoring System.</p>
      <p style="margin: 5px 0 0 0;">Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Send email alert to configured recipients (from HEALTH_MONITOR_EMAILS env)
 * Does NOT send to all admins - only to explicitly configured emails
 */
// Disabled email alerts: convert sendEmailAlert into a safe no-op.
// This prevents automated system-monitor emails from being sent while keeping
// the rest of the alerting machinery (realtime alerts/logging) intact.
const sendEmailAlert = async (alert) => {
  // Silently skip - no logging to avoid terminal clutter
  return { success: false, error: 'disabled: system monitoring emails suppressed' };
};

/**
 * Send real-time notification via Socket.IO
 * Only emits to system monitoring channel - NOT to all admins
 */
const sendRealtimeAlert = (alert) => {
  if (!socketIO) {
    console.warn('🔌 Socket.IO not configured. Real-time alert not sent.');
    return false;
  }
  
  try {
    // Only emit to system monitoring room (users must explicitly join)
    // Does NOT broadcast to all admins
    socketIO.to('system_monitors').emit('system_alert', alert);
    
    // Emit minimal info to system status channel (for dashboard widgets only)
    socketIO.to('system_monitors').emit('system_status', {
      type: 'alert',
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp,
    });
    
    console.log(`🔔 Real-time alert sent to system_monitors room: ${alert.type}`);
    return true;
  } catch (error) {
    console.error('🔔 Failed to send real-time alert:', error.message);
    return false;
  }
};

/**
 * Create and send alert
 */
const sendAlert = async (options) => {
  const {
    type,
    severity = 'warning',
    message,
    details = null,
    suggestedAction = null,
    skipCooldown = false,
  } = options;
  
  // Check cooldown
  if (!skipCooldown && !shouldSendAlert(type, severity)) {
    // Silently skip - no logging since emails are disabled
    return { sent: false, reason: 'cooldown' };
  }
  
  const alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity,
    message,
    details,
    suggestedAction,
    timestamp: new Date().toISOString(),
    emailSent: false,
    realtimeSent: false,
  };
  
  // Store in history
  alertHistory.unshift(alert);
  if (alertHistory.length > MAX_ALERT_HISTORY) {
    alertHistory.pop();
  }
  
  // Log alert
  const logLevel = severity === 'critical' ? 'error' : severity === 'warning' ? 'warn' : 'log';
  console[logLevel](`[Alert] ${severity.toUpperCase()} - ${type}: ${message}`);
  
  // Send email for critical and warning alerts
  if (severity === 'critical' || severity === 'warning') {
    const emailResult = await sendEmailAlert(alert);
    alert.emailSent = emailResult.success;
    alert.emailError = emailResult.error;
  }
  
  // Send real-time notification
  alert.realtimeSent = sendRealtimeAlert(alert);
  
  return {
    sent: true,
    alert,
  };
};

/**
 * Suggested actions for common alert types
 */
const SUGGESTED_ACTIONS = {
  cpu: 'Consider scaling up server resources or investigating high CPU processes.',
  memory: 'Check for memory leaks, consider increasing server memory or optimizing code.',
  heap: 'Restart the application if heap usage remains high. Check for memory leaks.',
  database: 'Check database connection settings, verify MongoDB service is running.',
  error_rate: 'Review error logs, check recent deployments for bugs.',
  response_time: 'Investigate slow queries, check for bottlenecks in API endpoints.',
  disk: 'Clean up old logs, temporary files, or unused data. Consider expanding storage.',
  crash: 'Review crash logs, check for unhandled exceptions in the code.',
};

/**
 * Send health-related alert with suggested action
 */
const sendHealthAlert = async (healthCheck) => {
  if (!healthCheck.alerts || healthCheck.alerts.length === 0) {
    return { sent: false, reason: 'no_alerts' };
  }
  
  const results = [];
  
  for (const alert of healthCheck.alerts) {
    const result = await sendAlert({
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      details: {
        value: alert.value,
        threshold: alert.threshold,
        timestamp: healthCheck.timestamp,
      },
      suggestedAction: SUGGESTED_ACTIONS[alert.type],
    });
    
    results.push(result);
  }
  
  return {
    sent: results.some(r => r.sent),
    alerts: results,
  };
};

/**
 * Get alert history
 */
const getAlertHistory = (options = {}) => {
  const { limit = 50, severity = null, type = null, since = null } = options;
  
  let filtered = [...alertHistory];
  
  if (severity) {
    filtered = filtered.filter(a => a.severity === severity);
  }
  
  if (type) {
    filtered = filtered.filter(a => a.type === type);
  }
  
  if (since) {
    const sinceTime = new Date(since).getTime();
    filtered = filtered.filter(a => new Date(a.timestamp).getTime() > sinceTime);
  }
  
  return filtered.slice(0, limit);
};

/**
 * Clear alert history
 */
const clearAlertHistory = () => {
  alertHistory.length = 0;
  lastAlertTimes.clear();
  return { cleared: true, timestamp: new Date().toISOString() };
};

/**
 * Get alert statistics
 */
const getAlertStats = () => {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;
  const last7d = now - 7 * 24 * 60 * 60 * 1000;
  
  const recent24h = alertHistory.filter(a => new Date(a.timestamp).getTime() > last24h);
  const recent7d = alertHistory.filter(a => new Date(a.timestamp).getTime() > last7d);
  
  return {
    total: alertHistory.length,
    last24h: {
      total: recent24h.length,
      critical: recent24h.filter(a => a.severity === 'critical').length,
      warning: recent24h.filter(a => a.severity === 'warning').length,
      info: recent24h.filter(a => a.severity === 'info').length,
    },
    last7d: {
      total: recent7d.length,
      critical: recent7d.filter(a => a.severity === 'critical').length,
      warning: recent7d.filter(a => a.severity === 'warning').length,
      info: recent7d.filter(a => a.severity === 'info').length,
    },
    byType: alertHistory.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {}),
  };
};

export {
  setSocketIO,
  sendAlert,
  sendHealthAlert,
  sendEmailAlert,
  sendRealtimeAlert,
  getAlertHistory,
  clearAlertHistory,
  getAlertStats,
  getHealthMonitorEmails,
  SUGGESTED_ACTIONS,
};
