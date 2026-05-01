/**
 * Role mapping utility for fixed account roles
 * 
 * This module defines fixed role assignments for specific email addresses.
 * All other accounts default to 'customer' role.
 */

// Fixed role assignments
const FIXED_ROLES = {
  'arclitacj@gmail.com': 'cashier',
  'bantecj@bitebonansacafe.com': 'cashier',
  'cjsalvaleon19@gmail.com': 'admin',
  'johndave0991@bitebonansacafe.com': 'rider',
};

/**
 * Determines the role for a given email address
 * @param {string} email - The email address to check
 * @returns {string} The role for the email ('admin', 'cashier', 'rider', or 'customer')
 */
export function getRoleForEmail(email) {
  if (!email || typeof email !== 'string') {
    return 'customer';
  }

  // Normalize email to lowercase for case-insensitive comparison
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email has a fixed role
  if (FIXED_ROLES[normalizedEmail]) {
    return FIXED_ROLES[normalizedEmail];
  }

  // Default to customer for all other accounts
  return 'customer';
}

/**
 * Checks if an email has a fixed role assignment
 * @param {string} email - The email address to check
 * @returns {boolean} True if the email has a fixed role, false otherwise
 */
export function hasFixedRole(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail in FIXED_ROLES;
}

/**
 * Gets all fixed role mappings
 * @returns {Object} Object mapping emails to their fixed roles
 */
export function getFixedRoleMappings() {
  return { ...FIXED_ROLES };
}
