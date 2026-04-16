import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadCustomerData() {
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

        // Fetch customer profile data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          console.error('[CustomerDashboard] Failed to fetch user data:', userError.message);
        } else {
          setCustomerData(userData);
        }

        // Fetch recent orders (if orders table exists)
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!ordersError && ordersData) {
          setRecentOrders(ordersData);
        }

        setLoading(false);
      } catch (err) {
        console.error('[CustomerDashboard] Error:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadCustomerData();

    return () => {
      mounted = false;
    };
  }, [router]);

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
        <title>Customer Dashboard - Bite Bonansa Cafe</title>
        <meta name="description" content="Your customer dashboard for Bite Bonansa Cafe" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <button
            onClick={() => router.push('/dashboard').catch(console.error)}
            style={styles.backBtn}
          >
            ← Back to Dashboard
          </button>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>Welcome, {customerData?.full_name || user?.email}!</h2>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>🎁</div>
              <div style={styles.statLabel}>Loyalty Points</div>
              <div style={styles.statValue}>{customerData?.loyalty_balance || 0}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIcon}>🛒</div>
              <div style={styles.statLabel}>Total Orders</div>
              <div style={styles.statValue}>{recentOrders.length}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIcon}>💳</div>
              <div style={styles.statLabel}>Customer ID</div>
              <div style={styles.statValue}>{customerData?.customer_id || 'N/A'}</div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Quick Actions</h3>
            <div style={styles.actionsGrid}>
              <button
                onClick={() => router.push('/customer/menu').catch(console.error)}
                style={styles.actionCard}
              >
                <span style={styles.actionIcon}>🍽️</span>
                <span style={styles.actionLabel}>Browse Menu</span>
              </button>
              <button
                onClick={() => router.push('/customer/orders').catch(console.error)}
                style={styles.actionCard}
              >
                <span style={styles.actionIcon}>📦</span>
                <span style={styles.actionLabel}>Track Orders</span>
              </button>
              <button
                onClick={() => router.push('/customer/profile').catch(console.error)}
                style={styles.actionCard}
              >
                <span style={styles.actionIcon}>👤</span>
                <span style={styles.actionLabel}>My Profile</span>
              </button>
            </div>
          </div>

          {recentOrders.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Recent Orders</h3>
              <div style={styles.ordersList}>
                {recentOrders.map((order) => (
                  <div key={order.id} style={styles.orderCard}>
                    <div style={styles.orderHeader}>
                      <span style={styles.orderId}>Order #{order.id}</span>
                      <span style={styles.orderStatus}>{order.status || 'Pending'}</span>
                    </div>
                    <div style={styles.orderDetails}>
                      <span>Total: ₱{order.total_amount || 0}</span>
                      <span style={styles.orderDate}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
  title: {
    fontSize: '28px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '30px',
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
  },
  statIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  statLabel: {
    color: '#999',
    fontSize: '14px',
    marginBottom: '8px',
  },
  statValue: {
    color: '#ffc107',
    fontSize: '24px',
    fontWeight: '700',
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '20px',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
  },
  actionIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  actionLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffc107',
  },
  ordersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '16px',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  orderId: {
    color: '#ffc107',
    fontWeight: '600',
  },
  orderStatus: {
    color: '#999',
    fontSize: '14px',
  },
  orderDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#ccc',
    fontSize: '14px',
  },
  orderDate: {
    color: '#666',
  },
};
