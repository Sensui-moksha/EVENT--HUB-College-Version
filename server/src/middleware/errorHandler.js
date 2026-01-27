/**
 * Global Error Handler Middleware
 * 
 * Provides centralized error handling for the Express application.
 * Features:
 * - Structured error responses
 * - Error logging
 * - Different handling for production/development
 * - Integration with alert service
 */

import { sendAlert } from '../services/alertService.js';

// Track error counts for monitoring
let errorCounts = {
  total: 0,
  byType: {},
  lastReset: Date.now(),
};

// Reset error counts every hour
setInterval(() => {
  errorCounts = {
    total: 0,
    byType: {},
    lastReset: Date.now(),
  };
}, 60 * 60 * 1000);

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message, fields = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

/**
 * Log error for monitoring
 */
const logError = (error, req) => {
  // Track error counts
  errorCounts.total++;
  const errorType = error.code || error.name || 'UnknownError';
  errorCounts.byType[errorType] = (errorCounts.byType[errorType] || 0) + 1;
  
  // Log to console
  console.error(`[ERROR] ${new Date().toISOString()}`);
  console.error(`  Path: ${req.method} ${req.path}`);
  console.error(`  Code: ${error.code || 'N/A'}`);
  console.error(`  Message: ${error.message}`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.error(`  Stack: ${error.stack}`);
  }
  
  // Log request details for debugging
  if (req.body && Object.keys(req.body).length > 0) {
    // Remove sensitive fields
    const sanitizedBody = { ...req.body };
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.otp;
    console.error(`  Body: ${JSON.stringify(sanitizedBody).substring(0, 500)}`);
  }
};

/**
 * Send error alert for critical errors
 */
const sendErrorAlert = async (error, req) => {
  // Only send alerts for server errors, not client errors
  if (error.statusCode && error.statusCode < 500) {
    return;
  }
  
  // Check if we've had too many errors recently
  if (errorCounts.total > 100) {
    await sendAlert({
      type: 'high_error_rate',
      severity: 'critical',
      message: `High error rate detected: ${errorCounts.total} errors in the last hour`,
      details: {
        errorCounts,
        lastError: {
          message: error.message,
          path: `${req.method} ${req.path}`,
        },
      },
      suggestedAction: 'Review error logs immediately. Consider rolling back recent deployments.',
    });
  }
};

/**
 * Format error response
 */
const formatErrorResponse = (error, req) => {
  const response = {
    error: true,
    message: error.message || 'An unexpected error occurred',
    code: error.code || 'INTERNAL_ERROR',
    statusCode: error.statusCode || 500,
    timestamp: new Date().toISOString(),
    path: req.path,
  };
  
  // Add validation fields if present
  if (error.fields && error.fields.length > 0) {
    response.fields = error.fields;
  }
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    response.stack = error.stack;
  }
  
  return response;
};

/**
 * Handle MongoDB errors
 */
const handleMongoError = (error) => {
  if (error.name === 'MongoServerError') {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyValue || {})[0];
      return new ValidationError(
        `A record with this ${field || 'value'} already exists`,
        [field]
      );
    }
  }
  
  if (error.name === 'ValidationError') {
    const fields = Object.keys(error.errors || {});
    const messages = Object.values(error.errors || {}).map(e => e.message);
    return new ValidationError(messages.join(', '), fields);
  }
  
  if (error.name === 'CastError') {
    return new ValidationError(`Invalid ${error.path}: ${error.value}`);
  }
  
  return new DatabaseError(error.message);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route not found: ${req.method} ${req.path}`);
  next(error);
};

/**
 * Global error handler middleware
 */
export const errorHandler = async (error, req, res, next) => {
  // Handle MongoDB/Mongoose errors
  if (error.name === 'MongoServerError' || 
      error.name === 'ValidationError' || 
      error.name === 'CastError') {
    error = handleMongoError(error);
  }
  
  // Default to 500 if no status code
  error.statusCode = error.statusCode || 500;
  
  // Log error
  logError(error, req);
  
  // Send alert for server errors
  if (error.statusCode >= 500) {
    await sendErrorAlert(error, req);
  }
  
  // Format and send response
  const response = formatErrorResponse(error, req);
  
  res.status(error.statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Get error statistics
 */
export const getErrorStats = () => {
  return {
    ...errorCounts,
    windowStart: new Date(errorCounts.lastReset).toISOString(),
  };
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  DatabaseError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  getErrorStats,
};
