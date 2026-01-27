/**
 * Production-safe Logger Utility
 * 
 * Wraps console methods to only log in development environment.
 * In production, logs are suppressed to improve performance and security.
 * 
 * Usage:
 *   import logger from './utils/logger.js';
 *   logger.log('This only shows in development');
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error - always shows'); // Errors always log
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  /**
   * Log message (development only)
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info message (development only)
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Warning message (development only)
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Error message (always logs - important for debugging)
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Debug message (development only, with [DEBUG] prefix)
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Production log - logs even in production (use sparingly)
   * For critical startup messages, health checks, etc.
   */
  production: (...args) => {
    console.log(...args);
  },

  /**
   * Check if we're in development mode
   */
  isDev: isDevelopment,
};

export default logger;
