import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import { getUserRole, ROLES, canAccessPage } from '../../utils/roleGuard';

// ─── Rider: Deliveries Page ───────────────────────────────────────────────────
// View and manage delivery orders.
// Auth-guarded: redirects to /login if no active session.
// Role-guarded: only riders and admins can access this page.

export default function RiderDeliveriesPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);

  // ── Auth & Role guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      if (!supabase) {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!session) { router.replace('/login'); return; }
        
        // Check user role
        const roleData = await getUserRole();
        if (!roleData || !canAccessPage(roleData.role, '/rider/deliveries')) {
          // User doesn't have permission, redirect to their default page
          if (roleData?.role === ROLES.CUSTOMER) {
            router.replace('/customer/menu');
          } else if (roleData?.role === ROLES.CASHIER) {
            router.replace('/cashier');
          } else if (roleData?.role === ROLES.ADMIN) {
            router.replace('/dashboard');
          } else {
            router.replace('/login');
          }
          return;
        }
        
        setAuthLoading(false);
      } catch {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
      }
    }
    checkSession();
    return () => { mounted = false; };
  }, [router]);

  if (authLoading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
          ⏳ Loading…
        </p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Deliveries - Bite Bonansa Cafe</title>
        <meta name="description" content="Manage delivery orders" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <button
            onClick={() => router.push('/dashboard')}
            style={styles.backBtn}
          >
            Dashboard
          </button>
        </header>

        <main style={styles.main}>
          <h2 style={styles.pageTitle}>Delivery Orders</h2>
          <div style={styles.content}>
            <p style={{ color: '#ccc', textAlign: 'center' }}>
              Rider delivery management coming soon...
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    fontFamily: "'Poppins', sans-serif",
    color: '#fff',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #ffc107',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  main: {
    padding: '40px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  pageTitle: {
    fontSize: '28px',
    color: '#ffc107',
    textAlign: 'center',
    marginBottom: '32px',
  },
  content: {
    padding: '40px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    minHeight: '400px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
