import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './supabaseClient';

/**
 * Custom hook to protect pages with role-based access control
 * @param {string} requiredRole - The role required to access the page ('admin', 'cashier', 'rider', 'customer')
 * @returns {Object} - { loading: boolean, authorized: boolean, userRole: string|null }
 */
export function useRoleGuard(requiredRole) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        if (!supabase) {
          if (mounted) {
            setLoading(false);
            router.replace('/login').catch(console.error);
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session) {
          router.replace('/login').catch(console.error);
          return;
        }

        // Fetch user role from database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        // If there's an error or no role data, treat as unauthorized
        if (userError || !userData || !userData.role) {
          console.error('[useRoleGuard] Failed to fetch user role or role missing:', userError?.message);
          setLoading(false);
          router.replace('/login').catch(console.error);
          return;
        }

        const role = userData.role;
        setUserRole(role);

        // Check if user has the required role
        if (role !== requiredRole) {
          // Redirect to appropriate portal based on actual role
          if (role === 'admin') {
            router.replace('/admin').catch(console.error);
          } else if (role === 'cashier') {
            router.replace('/cashier').catch(console.error);
          } else if (role === 'rider') {
            router.replace('/rider/dashboard').catch(console.error);
          } else if (role === 'customer') {
            router.replace('/customer/dashboard').catch(console.error);
          } else {
            // Handle unexpected role value
            console.warn(`[useRoleGuard] Unexpected role "${role}" for user ${session.user.id}. Redirecting to customer dashboard.`);
            router.replace('/customer/dashboard').catch(console.error);
          }
          return;
        }

        // User is authorized
        setAuthorized(true);
        setLoading(false);
      } catch (err) {
        console.error('[useRoleGuard] Access check failed:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
          router.replace('/login').catch(console.error);
        }
      }
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [router, requiredRole]);

  return { loading, authorized, userRole };
}
