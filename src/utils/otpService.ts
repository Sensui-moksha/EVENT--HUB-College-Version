/**
 * OTP API Service
 * Frontend service for OTP-related API calls
 */

import { getApiBaseUrl } from './api';

const API_BASE_URL = getApiBaseUrl();

export interface OTPResponse {
  success: boolean;
  message?: string;
  error?: string;
  expiresAt?: string;
  expiryMinutes?: number;
  code?: string;
  remainingAttempts?: number;
  hasValidOTP?: boolean;
}

/**
 * Send OTP to user's email
 */
export const sendOTP = async (
  email: string,
  username?: string,
  purpose: 'verification' | 'registration' | 'login' | 'reset_password' = 'verification'
): Promise<OTPResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, purpose }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending OTP:', error);
    return {
      success: false,
      error: 'Failed to send OTP. Please check your connection.',
    };
  }
};

/**
 * Verify OTP code
 */
export const verifyOTP = async (
  email: string,
  otp: string,
  purpose: 'verification' | 'registration' | 'login' | 'reset_password' = 'verification'
): Promise<OTPResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, purpose }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      error: 'Failed to verify OTP. Please try again.',
    };
  }
};

/**
 * Resend OTP (invalidates previous OTP)
 */
export const resendOTP = async (
  email: string,
  username?: string,
  purpose: 'verification' | 'registration' | 'login' | 'reset_password' = 'verification'
): Promise<OTPResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/otp/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, purpose }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error resending OTP:', error);
    return {
      success: false,
      error: 'Failed to resend OTP. Please try again.',
    };
  }
};

/**
 * Check if valid OTP exists for email
 */
export const checkOTPStatus = async (
  email: string,
  purpose: 'verification' | 'registration' | 'login' | 'reset_password' = 'verification'
): Promise<OTPResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/otp/status?email=${encodeURIComponent(email)}&purpose=${purpose}`
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking OTP status:', error);
    return {
      success: false,
      error: 'Failed to check OTP status.',
    };
  }
};
