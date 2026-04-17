import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

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

        // Fetch user role and data
        const { data: userDataResult, error: userError } = await supabase
          .from('users')
          .select('role, full_name, email, customer_id, created_at')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[CustomerDashboard] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userDataResult?.role || 'customer';
        setUserRole(role);
        setUserData(userDataResult);

        // Redirect if not a customer
        if (role !== 'customer') {
          if (role === 'admin') {
            router.replace('/dashboard').catch(console.error);
          } else if (role === 'cashier') {
            router.replace('/cashier').catch(console.error);
          } else if (role === 'rider') {
            router.replace('/rider/dashboard').catch(console.error);
          }
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error('[CustomerDashboard] Session check failed:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
          router.replace('/login').catch(console.error);
        }
      }
    }

    checkSession();

    const { data: { subscription } } = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          if (!session) {
            router.replace('/login').catch(console.error);
          }
        })
      : { data: { subscription: null } };

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[CustomerDashboard] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
  };

  const navigateTo = (path) => {
    router.push(path).catch(console.error);
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

  const customerName = userData?.full_name || user?.email?.split('@')[0] || 'Customer';

  return (
    <>
      <Head>
        <title>Dashboard - Bite Bonansa Cafe</title>
        <meta name="description" content="Customer Dashboard" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <span style={styles.welcome}>
            {customerName}
          </span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>Welcome back, {customerName}!</h2>
          
          <div style={styles.grid}>
            <NavCard 
              onClick={() => navigateTo('/customer/order-portal')}
              icon="🍽️" 
              label="Order Portal" 
            />
            <NavCard 
              onClick={() => navigateTo('/customer/order-tracking')}
              icon="📦" 
              label="Order Tracking" 
            />
            <NavCard 
              onClick={() => navigateTo('/customer/order-history')}
              icon="📋" 
              label="Order History" 
            />
            <NavCard 
              onClick={() => navigateTo('/customer/reviews')}
              icon="⭐" 
              label="Share Review" 
            />
            <NavCard 
              onClick={() => navigateTo('/customer/profile')}
              icon="👤" 
              label="My Profile" 
            />
          </div>
        </main>
      </div>
    </>
  );
}

function NavCard({ onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
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
    flex: 1,
    textAlign: 'center',
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
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '32px',
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '24px',
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
    fontSize: '40px',
    marginBottom: '12px',
  },
  cardLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffc107',
  },
};
