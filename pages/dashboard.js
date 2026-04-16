import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '../utils/supabaseClient';
import { getUserRole, ROLES } from '../utils/roleGuard';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
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

        setUser(session.user);

        // Fetch user role
        const roleData = await getUserRole();
        if (roleData && roleData.role) {
          setUserRole(roleData.role);
          
          // Redirect customers to their menu page
          if (roleData.role === ROLES.CUSTOMER) {
            router.replace('/customer/menu').catch(console.error);
            return;
          }
          
          // Redirect cashiers to cashier page
          if (roleData.role === ROLES.CASHIER) {
            router.replace('/cashier').catch(console.error);
            return;
          }
          
          // Redirect riders to their delivery page
          if (roleData.role === ROLES.RIDER) {
            router.replace('/rider/deliveries').catch(console.error);
            return;
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('[Dashboard] Session check failed:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
          router.replace('/login').catch(console.error);
        }
      }
    }

    checkSession();

    // Subscribe to auth state changes and clean up on unmount to prevent
    // orphaned async listeners (which cause the "message channel closed" error).
    const { data: { subscription } } = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          if (!session) {
            router.replace('/login').catch(console.error);
          } else {
            setUser(session.user);
          }
        })
      : { data: { subscription: null } };

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    setLogoutOpen(false);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      // Log the failure but still clear local state and redirect so the
      // user is not left in a broken UI state. The server session may
      // persist; the user will need to sign in again to get a fresh token.
      console.warn('[Dashboard] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
  };

  if (loading) {
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
        <title>Dashboard - Bite Bonansa Cafe</title>
        <meta name="description" content="Bite Bonansa Cafe Dashboard - Access cashier, menu management, inventory, reports, customers, and reviews" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
        <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
        <span style={styles.welcome}>
          Welcome, {user?.email ?? 'Guest'}
        </span>

        {/* Logout Dialog — includes DialogTitle + DialogDescription for accessibility */}
        <Dialog.Root open={logoutOpen} onOpenChange={setLogoutOpen}>
          <Dialog.Trigger asChild>
            <button style={styles.logoutBtn}>Logout</button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay style={styles.overlay} />
            <Dialog.Content style={styles.dialogContent}>
              <Dialog.Title style={styles.dialogTitle}>
                Confirm Logout
              </Dialog.Title>
              <Dialog.Description style={styles.dialogDescription}>
                Are you sure you want to log out of your account?
              </Dialog.Description>

              <div style={styles.dialogActions}>
                <Dialog.Close asChild>
                  <button style={styles.cancelBtn}>Cancel</button>
                </Dialog.Close>
                <button style={styles.confirmBtn} onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      <main style={styles.main}>
        <div style={styles.grid}>
          {/* Admin-only dashboard */}
          {userRole === ROLES.ADMIN && (
            <>
              <NavCard href="/cashier" icon="🧾" label="Cashier" />
              <NavCard href="/admin/menu" icon="🍽️" label="Menu" />
              <NavCard href="/admin/inventory" icon="📦" label="Inventory" />
              <NavCard href="/admin/reports" icon="📊" label="Reports" />
              <NavCard href="/admin/customers" icon="👥" label="Customers" />
              <NavCard href="/admin/reviews" icon="⭐" label="Reviews" />
            </>
          )}
        </div>
      </main>
      </div>
    </>
  );
}

function NavCard({ href, icon, label }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href).catch(console.error)}
      style={styles.card}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = '#ffb300';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(255,193,7,0.35)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = '#ffc107';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,193,7,0.15)';
      }}
    >
      <span style={styles.cardIcon}>{icon}</span>
      <span style={styles.cardLabel}>{label}</span>
    </button>
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
  welcome: {
    color: '#ccc',
    fontSize: '14px',
  },
  logoutBtn: {
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
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '20px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255,193,7,0.15)',
    transition: 'all 0.2s',
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
  },
  cardIcon: {
    fontSize: '32px',
    marginBottom: '10px',
  },
  cardLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffc107',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 100,
  },
  dialogContent: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '32px',
    minWidth: '320px',
    zIndex: 101,
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
  },
  dialogTitle: {
    fontSize: '20px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '12px',
  },
  dialogDescription: {
    color: '#ccc',
    fontSize: '14px',
    marginBottom: '24px',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  cancelBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  confirmBtn: {
    padding: '8px 18px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};

