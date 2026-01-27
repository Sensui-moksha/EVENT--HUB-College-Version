/**
 * OTP Routes
 * API endpoints for OTP verification functionality
 */

import express from 'express';
import { sendOTP, verifyOTP, resendOTP, hasValidOTP } from '../services/otp.service.js';

const router = express.Router();

/**
 * POST /api/otp/send
 * Send OTP to user's email
 */
router.post('/send', async (req, res) => {
  try {
    const { email, username, purpose } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }
    
    const result = await sendOTP(email, username || '', purpose || 'verification');
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        expiresAt: result.expiresAt,
        expiryMinutes: result.expiryMinutes,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error in /api/otp/send:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP. Please try again.',
    });
  }
});

/**
 * POST /api/otp/verify
 * Verify OTP code
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and OTP are required',
      });
    }
    
    const result = verifyOTP(email, otp, purpose || 'verification');
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      // Return appropriate status code based on error
      const statusCode = result.code === 'OTP_EXPIRED' || result.code === 'MAX_ATTEMPTS_EXCEEDED' 
        ? 410 // Gone
        : 400; // Bad Request
        
      res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.code,
        remainingAttempts: result.remainingAttempts,
      });
    }
  } catch (error) {
    console.error('Error in /api/otp/verify:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP. Please try again.',
    });
  }
});

/**
 * POST /api/otp/resend
 * Resend OTP (invalidates previous OTP)
 */
router.post('/resend', async (req, res) => {
  try {
    const { email, username, purpose } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }
    
    const result = await resendOTP(email, username || '', purpose || 'verification');
    
    if (result.success) {
      res.json({
        success: true,
        message: 'New OTP sent successfully',
        expiresAt: result.expiresAt,
        expiryMinutes: result.expiryMinutes,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error in /api/otp/resend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend OTP. Please try again.',
    });
  }
});

/**
 * GET /api/otp/status
 * Check if valid OTP exists for email
 */
router.get('/status', (req, res) => {
  try {
    const { email, purpose } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }
    
    const hasOTP = hasValidOTP(email, purpose || 'verification');
    
    res.json({
      success: true,
      hasValidOTP: hasOTP,
    });
  } catch (error) {
    console.error('Error in /api/otp/status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check OTP status',
    });
  }
});

export default router;
