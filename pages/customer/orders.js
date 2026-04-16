import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function OrderTracking() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, processing, completed, cancelled

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
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

        // Fetch orders for this customer
        let query = supabase
          .from('orders')
          .select('*')
          .eq('customer_id', session.user.id)
          .order('created_at', { ascending: false });

        if (filter !== 'all') {
          query = query.eq('status', filter);
        }

        const { data: ordersData, error: ordersError } = await query;

        if (ordersError) {
          console.error('[OrderTracking] Failed to fetch orders:', ordersError.message);
        } else {
          setOrders(ordersData || []);
        }

        setLoading(false);
      } catch (err) {
        console.error('[OrderTracking] Error:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      mounted = false;
    };
  }, [router, filter]);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '#ffc107';
      case 'processing':
        return '#2196f3';
      case 'completed':
        return '#4caf50';
      case 'cancelled':
        return '#f44336';
      case 'delivered':
        return '#4caf50';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '⏱️';
      case 'processing':
        return '🔄';
      case 'completed':
        return '✅';
      case 'cancelled':
        return '❌';
      case 'delivered':
        return '📦';
      default:
        return '📋';
    }
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
        <title>Order Tracking - Bite Bonansa Cafe</title>
        <meta name="description" content="Track your orders from Bite Bonansa Cafe" />
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
          <h2 style={styles.title}>Order Tracking</h2>

          <div style={styles.filterBar}>
            <button
              onClick={() => setFilter('all')}
              style={{
                ...styles.filterBtn,
                backgroundColor: filter === 'all' ? '#ffc107' : 'transparent',
                color: filter === 'all' ? '#0a0a0a' : '#ffc107',
              }}
            >
              All Orders
            </button>
            <button
              onClick={() => setFilter('pending')}
              style={{
                ...styles.filterBtn,
                backgroundColor: filter === 'pending' ? '#ffc107' : 'transparent',
                color: filter === 'pending' ? '#0a0a0a' : '#ffc107',
              }}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('processing')}
              style={{
                ...styles.filterBtn,
                backgroundColor: filter === 'processing' ? '#ffc107' : 'transparent',
                color: filter === 'processing' ? '#0a0a0a' : '#ffc107',
              }}
            >
              Processing
            </button>
            <button
              onClick={() => setFilter('completed')}
              style={{
                ...styles.filterBtn,
                backgroundColor: filter === 'completed' ? '#ffc107' : 'transparent',
                color: filter === 'completed' ? '#0a0a0a' : '#ffc107',
              }}
            >
              Completed
            </button>
          </div>

          {orders.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📦</div>
              <h3 style={styles.emptyTitle}>No Orders Found</h3>
              <p style={styles.emptyText}>
                {filter === 'all'
                  ? "You haven't placed any orders yet. Start browsing our menu!"
                  : `No ${filter} orders found.`}
              </p>
              <button
                onClick={() => router.push('/customer/menu').catch(console.error)}
                style={styles.browseBtn}
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div style={styles.ordersList}>
              {orders.map((order) => (
                <div key={order.id} style={styles.orderCard}>
                  <div style={styles.orderHeader}>
                    <div>
                      <div style={styles.orderId}>Order #{order.id}</div>
                      <div style={styles.orderDate}>
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: getStatusColor(order.status),
                      }}
                    >
                      {getStatusIcon(order.status)} {order.status || 'Pending'}
                    </div>
                  </div>

                  <div style={styles.orderBody}>
                    <div style={styles.orderInfo}>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Total Amount:</span>
                        <span style={styles.infoValue}>₱{order.total_amount || 0}</span>
                      </div>
                      {order.payment_method && (
                        <div style={styles.infoRow}>
                          <span style={styles.infoLabel}>Payment Method:</span>
                          <span style={styles.infoValue}>
                            {order.payment_method.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                      )}
                      {order.delivery_address && (
                        <div style={styles.infoRow}>
                          <span style={styles.infoLabel}>Delivery Address:</span>
                          <span style={styles.infoValue}>{order.delivery_address}</span>
                        </div>
                      )}
                      {order.notes && (
                        <div style={styles.infoRow}>
                          <span style={styles.infoLabel}>Notes:</span>
                          <span style={styles.infoValue}>{order.notes}</span>
                        </div>
                      )}
                    </div>

                    <div style={styles.orderActions}>
                      <button
                        onClick={() => router.push(`/customer/orders/${order.id}`).catch(console.error)}
                        style={styles.viewBtn}
                      >
                        View Details
                      </button>
                    </div>
                  </div>

                  {/* Order Progress Tracker */}
                  <div style={styles.progressTracker}>
                    <div
                      style={{
                        ...styles.progressStep,
                        opacity: ['pending', 'processing', 'completed', 'delivered'].includes(
                          order.status?.toLowerCase()
                        )
                          ? 1
                          : 0.3,
                      }}
                    >
                      <div style={styles.progressDot}>📝</div>
                      <div style={styles.progressLabel}>Order Placed</div>
                    </div>
                    <div style={styles.progressLine} />
                    <div
                      style={{
                        ...styles.progressStep,
                        opacity: ['processing', 'completed', 'delivered'].includes(
                          order.status?.toLowerCase()
                        )
                          ? 1
                          : 0.3,
                      }}
                    >
                      <div style={styles.progressDot}>👨‍🍳</div>
                      <div style={styles.progressLabel}>Processing</div>
                    </div>
                    <div style={styles.progressLine} />
                    <div
                      style={{
                        ...styles.progressStep,
                        opacity: ['completed', 'delivered'].includes(order.status?.toLowerCase())
                          ? 1
                          : 0.3,
                      }}
                    >
                      <div style={styles.progressDot}>🚚</div>
                      <div style={styles.progressLabel}>Out for Delivery</div>
                    </div>
                    <div style={styles.progressLine} />
                    <div
                      style={{
                        ...styles.progressStep,
                        opacity: order.status?.toLowerCase() === 'delivered' ? 1 : 0.3,
                      }}
                    >
                      <div style={styles.progressDot}>✅</div>
                      <div style={styles.progressLabel}>Delivered</div>
                    </div>
                  </div>
                </div>
              ))}
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
  filterBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '30px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '10px 20px',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  emptyTitle: {
    fontSize: '24px',
    color: '#ffc107',
    marginBottom: '12px',
    fontFamily: "'Playfair Display', serif",
  },
  emptyText: {
    color: '#999',
    marginBottom: '30px',
  },
  browseBtn: {
    padding: '12px 24px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  ordersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '24px',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #333',
  },
  orderId: {
    fontSize: '18px',
    color: '#ffc107',
    fontWeight: '700',
    marginBottom: '4px',
  },
  orderDate: {
    fontSize: '12px',
    color: '#666',
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#0a0a0a',
  },
  orderBody: {
    marginBottom: '20px',
  },
  orderInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#999',
    fontSize: '14px',
  },
  infoValue: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
  },
  orderActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  viewBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  progressTracker: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #333',
  },
  progressStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    flex: '0 0 auto',
  },
  progressDot: {
    fontSize: '24px',
  },
  progressLabel: {
    fontSize: '11px',
    color: '#999',
    textAlign: 'center',
    maxWidth: '80px',
  },
  progressLine: {
    height: '2px',
    flex: '1 1 auto',
    backgroundColor: '#333',
    margin: '0 8px',
  },
};
