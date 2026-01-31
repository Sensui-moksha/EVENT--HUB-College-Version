/**
 * Authentication Middleware - Session Based
 * Validates user sessions and protects routes that require authentication
 */

/**
 * Optional auth middleware - sets req.user if logged in, but doesn't require auth
 * Use this for public routes that behave differently for authenticated users
 */
export const optionalAuth = (req, res, next) => {
  if (req.session && req.session.user) {
import logger from '../utils/logger.js';

    req.user = {
      id: req.session.user._id || req.session.user.id,
      userId: req.session.user._id || req.session.user.id,
      email: req.session.user.email,
      role: req.session.user.role
    };
  }
  next();
};

/**
 * Middleware to verify user is authenticated via session
 * 
 * Usage:
 * app.get('/api/protected-route', authenticateToken, (req, res) => {
 *   // User is authenticated, req.user contains the user data
 * });
 */
/**
 * Middleware to verify user is authenticated via session
 * 
 * Usage:
 * app.get('/api/protected-route', authenticateToken, (req, res) => {
 *   // User is authenticated, req.user contains the user data
 * });
 */
export const authenticateToken = (req, res, next) => {
  // Check if user is in session (set during login)
  if (!req.session || !req.session.user) {
    // Log details so we can inspect cookie/origin issues in production logs
    logger.production('[Auth] Unauthorized access attempt', 'SessionID:', req.sessionID, 'HasSession:', !!req.session, 'Origin:', req.headers.origin || 'none', 'CookiePresent:', !!req.headers.cookie);
    return res.status(401).json({
      error: 'Access denied. Please log in.',
      code: 'NOT_AUTHENTICATED'
    });
  }

  // Attach user data to request
  req.user = {
    id: req.session.user._id || req.session.user.id,
    userId: req.session.user._id || req.session.user.id,
    email: req.session.user.email,
    role: req.session.user.role
  };
  
  next();
};

/**
 * Middleware to check if user has required role
 * 
 * Usage:
 * app.delete('/api/admin/users/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
 *   // Only admins can access
 * });
 */
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'User not authenticated.',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Middleware to check if user owns the resource
 * Used for verifying ownership before allowing updates/deletes
 * 
 * Usage (in route handler):
 * if (!isResourceOwner(req.user.userId, resourceOwnerId) && req.user.role !== 'admin') {
 *   return res.status(403).json({ error: 'You can only modify your own data' });
 * }
 */
export const isResourceOwner = (userId, resourceOwnerId) => {
  if (!userId || !resourceOwnerId) return false;
  return userId === resourceOwnerId || userId.toString() === resourceOwnerId.toString();
};

export default {
  optionalAuth,
  authenticateToken,
  authorizeRole,
  isResourceOwner
};

