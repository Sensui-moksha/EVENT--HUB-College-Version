/**
 * Mail Routes
 * API endpoints for email-related operations (admin use)
 */

import express from 'express';
import { sendAdminSummaryEmail, sendCustomEmail } from '../services/mail.service.js';
import { getState } from '../utils/adminMailLimiter.js';
import { getMailSystemStatus } from '../config/mail.init.js';

const router = express.Router();

/**
 * GET /api/mail/status
 * Get mail system status (admin only)
 */
router.get('/status', (req, res) => {
  try {
    const status = getMailSystemStatus();
    const limiterState = getState();
    
    res.json({
      success: true,
      status: {
        ...status,
        adminMailLimiter: limiterState,
      },
    });
  } catch (error) {
    console.error('Error getting mail status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mail system status',
    });
  }
});

/**
 * POST /api/mail/send-admin-summary
 * Manually trigger admin summary email (admin only)
 */
router.post('/send-admin-summary', async (req, res) => {
  try {
    const result = await sendAdminSummaryEmail();
    
    res.json({
      success: result.success,
      message: result.message || (result.success ? 'Admin summary sent' : 'Failed to send summary'),
      error: result.error,
    });
  } catch (error) {
    console.error('Error sending admin summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send admin summary email',
    });
  }
});

/**
 * POST /api/mail/send-custom
 * Send a custom email (admin only)
 */
router.post('/send-custom', async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;
    
    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: to, subject, html',
      });
    }
    
    const result = await sendCustomEmail(to, subject, html, text);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending custom email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
    });
  }
});

export default router;
