import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

const DEFAULT_DELIVERY_FEE = 50;
const RIDER_COMMISSION_RATE = 0.60; // Rider gets 60% of delivery fee

export default function RiderDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingDeliveries: 0,
    completedToday: 0,
    todayEarnings: 0,
    totalEarnings: 0,
  });

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
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[RiderDashboard] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';
        setUserRole(role);

        // Redirect if not a rider
        if (role !== 'rider') {
          if (role === 'admin') {
            router.replace('/dashboard').catch(console.error);
          } else if (role === 'cashier') {
            router.replace('/cashier').catch(console.error);
          } else {
            router.replace('/customer/menu').catch(console.error);
          }
          return;
        }

        // Fetch rider stats
        await fetchStats(session.user.id);
        setLoading(false);
      } catch (err) {
        console.error('[RiderDashboard] Session check failed:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
          router.replace('/login').catch(console.error);
        }
      }
    }

    async function fetchStats(userId) {
      if (!supabase) return;

      try {
        // Fetch rider profile data
        const { data: riderData } = await supabase
          .from('riders')
          .select('deliveries_completed, total_earnings')
          .eq('user_id', userId)
          .maybeSingle();

        // Fetch pending deliveries count (orders assigned to rider but not yet accepted)
        const { count: pendingCount } = await supabase
          .from('deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('rider_id', userId)
          .eq('status', 'pending');

        // Fetch completed deliveries today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: completedCount } = await supabase
          .from('deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('rider_id', userId)
          .eq('status', 'completed')
          .gte('completed_at', today.toISOString());

        // Fetch today's completed deliveries with fees to calculate today's earnings (60% of delivery fees)
        const { data: todayDeliveries } = await supabase
          .from('deliveries')
          .select('delivery_fee, orders(delivery_fee)')
          .eq('rider_id', userId)
          .eq('status', 'completed')
          .gte('completed_at', today.toISOString());

        // Calculate today's earnings (60% of total delivery fees)
        // Use orders.delivery_fee as primary source, fallback to deliveries.delivery_fee only if orders data is missing
        const todayTotalFees = todayDeliveries?.reduce((sum, d) => {
          const deliveryFee = d.orders?.delivery_fee || d.delivery_fee || 0;
          return sum + parseFloat(deliveryFee);
        }, 0) || 0;
        const todayEarnings = todayTotalFees * RIDER_COMMISSION_RATE; // Rider gets 60% of delivery fee

        setStats({
          pendingDeliveries: pendingCount || 0,
          completedToday: completedCount || 0,
          todayEarnings: todayEarnings,
          totalEarnings: riderData?.total_earnings || 0,
        });
      } catch (err) {
        console.error('[RiderDashboard] Failed to fetch stats:', err?.message ?? err);
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
      console.warn('[RiderDashboard] Sign out failed:', err?.message ?? err);
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
        <title>Rider Dashboard - Bite Bonansa Cafe</title>
        <meta name="description" content="Rider dashboard and delivery management" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <span style={styles.welcome}>
            Welcome, {user?.email ?? 'Rider'}
          </span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>🚴 Rider Dashboard</h2>

          {/* Stats Overview */}
          <div style={styles.statsGrid}>
            <Link 
              href="/rider/reports" 
              style={{ ...styles.statCard, ...styles.statCardClickable, textDecoration: 'none' }}
              title="Click to view billing portal"
            >
              <div style={styles.statIcon}>✅</div>
              <div style={styles.statValue}>{stats.completedToday}</div>
              <div style={styles.statLabel}>Total Number of Deliveries</div>
              <div style={styles.statHint}>💡 Click to view billing details</div>
            </Link>
            <Link 
              href="/rider/deliveries" 
              style={{ ...styles.statCard, ...styles.statCardClickable, textDecoration: 'none' }}
              title="Click to view order portal"
            >
              <div style={styles.statIcon}>📦</div>
              <div style={styles.statValue}>{stats.pendingDeliveries}</div>
              <div style={styles.statLabel}>Pending Deliveries</div>
              <div style={styles.statHint}>💡 Click to view orders</div>
            </Link>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>💰</div>
              <div style={styles.statValue}>₱{stats.todayEarnings.toFixed(2)}</div>
              <div style={styles.statLabel}>Total Billable Delivery Fees for the Day</div>
            </div>
          </div>

          {/* Navigation Cards */}
          <div style={styles.navGrid}>
            <Link href="/rider/deliveries" style={styles.navCard}>
              <div style={styles.navIcon}>🚚</div>
              <h3 style={styles.navTitle}>Order Portal</h3>
              <p style={styles.navDesc}>Accept and manage delivery orders</p>
            </Link>

            <Link href="/rider/reports" style={styles.navCard}>
              <div style={styles.navIcon}>📊</div>
              <h3 style={styles.navTitle}>Billing Portal</h3>
              <p style={styles.navDesc}>Submit delivery fee billing reports</p>
            </Link>

            <Link href="/rider/profile" style={styles.navCard}>
              <div style={styles.navIcon}>👤</div>
              <h3 style={styles.navTitle}>My Profile</h3>
              <p style={styles.navDesc}>Update your driver information</p>
            </Link>
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  statCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(255,193,7,0.15)',
  },
  statIcon: {
    fontSize: '40px',
    marginBottom: '12px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffc107',
    marginBottom: '8px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#ccc',
  },
  statCardClickable: {
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
  },
  statHint: {
    fontSize: '11px',
    color: '#ffc107',
    marginTop: '8px',
    fontWeight: '500',
  },
  statSubtext: {
    fontSize: '11px',
    color: '#999',
    marginTop: '4px',
  },
  navGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
  },
  navCard: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center',
    textDecoration: 'none',
    color: '#fff',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    display: 'block',
  },
  navIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  navTitle: {
    fontSize: '20px',
    color: '#ffc107',
    marginBottom: '12px',
    fontFamily: "'Playfair Display', serif",
  },
  navDesc: {
    fontSize: '14px',
    color: '#ccc',
    margin: 0,
  },
};
