import { supabase } from './supabaseClient';

/**
 * Fetch the current user's role from the database
 * @returns {Promise<{role: string, userId: string} | null>}
 */
export async function getUserRole() {
  if (!supabase) {
    console.error('[roleGuard] Supabase client is not available');
    return null;
  }

  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('[roleGuard] No active session:', sessionError?.message);
      return null;
    }

    // Fetch user data including role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, id')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData) {
      console.error('[roleGuard] Failed to fetch user role:', userError?.message);
      return null;
    }

    return {
      role: userData.role || 'customer', // Default to customer if role is not set
      userId: userData.id
    };
  } catch (error) {
    console.error('[roleGuard] Unexpected error fetching user role:', error);
    return null;
  }
}

/**
 * Check if a user has permission to access a specific role-restricted resource
 * @param {string} userRole - The user's current role
 * @param {string[]} allowedRoles - Array of roles that are allowed access
 * @returns {boolean}
 */
export function hasRoleAccess(userRole, allowedRoles) {
  if (!userRole || !Array.isArray(allowedRoles)) {
    return false;
  }
  return allowedRoles.includes(userRole);
}

/**
 * Role definitions and their access levels
 */
export const ROLES = {
  CUSTOMER: 'customer',
  CASHIER: 'cashier',
  ADMIN: 'admin',
  RIDER: 'rider',
};

/**
 * Page access configuration
 * Defines which roles can access which pages
 */
export const PAGE_ACCESS = {
  // Customer pages - only customers
  '/customer/menu': [ROLES.CUSTOMER],
  '/customer/orders': [ROLES.CUSTOMER],
  '/customer/profile': [ROLES.CUSTOMER],
  
  // Cashier pages - cashier and admin
  '/cashier': [ROLES.CASHIER, ROLES.ADMIN],
  
  // Admin pages - admin only
  '/admin/menu': [ROLES.ADMIN],
  '/admin/inventory': [ROLES.ADMIN],
  '/admin/reports': [ROLES.ADMIN],
  '/admin/customers': [ROLES.ADMIN],
  '/admin/reviews': [ROLES.ADMIN],
  
  // Rider pages - rider and admin
  '/rider/deliveries': [ROLES.RIDER, ROLES.ADMIN],
};

/**
 * Get the default redirect path for a given role
 * @param {string} role - The user's role
 * @returns {string} - The default page path for that role
 */
export function getDefaultPageForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return '/dashboard'; // Admin sees full dashboard
    case ROLES.CASHIER:
      return '/cashier';
    case ROLES.RIDER:
      return '/rider/deliveries';
    case ROLES.CUSTOMER:
    default:
      return '/customer/menu';
  }
}

/**
 * Check if user can access a specific page
 * @param {string} userRole - The user's role
 * @param {string} pagePath - The page path to check
 * @returns {boolean}
 */
export function canAccessPage(userRole, pagePath) {
  const allowedRoles = PAGE_ACCESS[pagePath];
  
  if (!allowedRoles) {
    // If page is not in the config, allow access (public pages)
    return true;
  }
  
  return hasRoleAccess(userRole, allowedRoles);
}
