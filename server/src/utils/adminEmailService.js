/**
 * Admin Email Service
 * Dynamically fetches admin emails from the database
 */

// This will be set by the main server after User model is defined
let UserModel = null;

/**
 * Set the User model reference
 * Must be called after mongoose models are defined
 * @param {Object} model - Mongoose User model
 */
const setUserModel = (model) => {
  UserModel = model;
  // ...removed console log for production...
};

/**
 * Get all admin emails from the database
 * @returns {Promise<string[]>} - Array of admin email addresses
 */
const getAdminEmails = async () => {
  if (!UserModel) {
    console.warn('📧 User model not set. Cannot fetch admin emails.');
    return [];
  }

  try {
    const admins = await UserModel.find(
      { role: 'admin', accountStatus: 'approved' },
      { email: 1, name: 1 }
    ).lean();

    if (admins.length === 0) {
      console.warn('📧 No admin users found in database');
      return [];
    }

    const emails = admins.map(admin => admin.email).filter(Boolean);
    // ...removed console log for production...
    return emails;
  } catch (error) {
    console.error('📧 Error fetching admin emails:', error.message);
    return [];
  }
};

/**
 * Get admin emails with names (for personalized emails)
 * @returns {Promise<Array<{email: string, name: string}>>}
 */
const getAdminEmailsWithNames = async () => {
  if (!UserModel) {
    console.warn('📧 User model not set. Cannot fetch admin emails.');
    return [];
  }

  try {
    const admins = await UserModel.find(
      { role: 'admin', accountStatus: 'approved' },
      { email: 1, name: 1 }
    ).lean();

    return admins.map(admin => ({
      email: admin.email,
      name: admin.name || 'Admin',
    })).filter(a => a.email);
  } catch (error) {
    console.error('📧 Error fetching admin emails:', error.message);
    return [];
  }
};

/**
 * Check if there are any admin users
 * @returns {Promise<boolean>}
 */
const hasAdmins = async () => {
  if (!UserModel) return false;

  try {
    const count = await UserModel.countDocuments({ role: 'admin', accountStatus: 'approved' });
    return count > 0;
  } catch (error) {
    console.error('📧 Error checking for admins:', error.message);
    return false;
  }
};

export {
  setUserModel,
  getAdminEmails,
  getAdminEmailsWithNames,
  hasAdmins,
};
