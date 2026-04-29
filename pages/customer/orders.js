import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import NotificationBell from '../../components/NotificationBell';

export default function CustomerOrders() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
          console.error('[CustomerOrders] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';

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

        // Fetch orders
        await fetchOrders(session.user.id);

        setLoading(false);
      } catch (err) {
        console.error('[CustomerOrders] Session check failed:', err?.message ?? err);
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

  async function fetchOrders(userId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('[CustomerOrders] Failed to fetch orders:', err);
    }
  }

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[CustomerOrders] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
  };

  const getStatusInfo = (status, orderMode) => {
    const isPickup = orderMode === 'pick-up';
    const statusMap = {
      'order_in_queue': {
        label: 'Order in Queue',
        description: 'Your order has been placed and is waiting to be processed',
        color: '#ffc107',
        icon: '🕐',
        progress: 25
      },
      'order_in_process': {
        label: 'Order in Process',
        description: 'Cashier has accepted and confirmed your order',
        color: '#2196f3',
        icon: '👨‍🍳',
        progress: 50
      },
      'out_for_delivery': {
        label: isPickup ? 'Ready for Pick-up' : 'Out for Delivery',
        description: isPickup ? 'Your order is ready for pick-up' : 'Rider has picked up your order and is on the way',
        color: '#ff9800',
        icon: isPickup ? '✅' : '🛵',
        progress: 75
      },
      'order_delivered': {
        label: isPickup ? 'Order Complete' : 'Order Delivered',
        description: isPickup ? 'Your order has been completed' : 'Your order has been delivered successfully',
        color: '#4caf50',
        icon: '✓',
        progress: 100
      },
      'cancelled': {
        label: 'Cancelled',
        description: 'This order was cancelled',
        color: '#f44336',
        icon: '✗',
        progress: 0
      }
    };
    return statusMap[status] || { 
      label: status, 
      description: '', 
      color: '#999', 
      icon: '?', 
      progress: 0 
    };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <meta name="description" content="Track your orders" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/customer/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/customer/order" style={styles.navLink}>Order Portal</Link>
            <Link href="/customer/orders" style={styles.navLink}>Order Tracking</Link>
            <Link href="/customer/profile" style={styles.navLink}>My Profile</Link>
            <Link href="/customer/reviews" style={styles.navLink}>Share Review</Link>
          </nav>
          <div style={styles.headerActions}>
            <NotificationBell user={user} />
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>📦 Order Tracking</h2>
          
          {orders.length > 0 ? (
            <div style={styles.ordersGrid}>
              {orders.map(order => {
                const statusInfo = getStatusInfo(order.status, order.order_mode);
                return (
                  <div key={order.id} style={styles.orderCard}>
                    <div style={styles.orderHeader}>
                      <div>
                        <h3 style={styles.orderId}>Order #{order.id.slice(0, 8)}</h3>
                        <p style={styles.orderDate}>{formatDate(order.created_at)}</p>
                      </div>
                      <div style={{...styles.statusBadge, backgroundColor: statusInfo.color}}>
                        {statusInfo.icon} {statusInfo.label}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={styles.progressContainer}>
                      <div 
                        style={{
                          ...styles.progressBar, 
                          width: `${statusInfo.progress}%`,
                          backgroundColor: statusInfo.color
                        }}
                      />
                    </div>

                    {/* Status Timeline */}
                    <div style={styles.timeline}>
                      <div style={styles.timelineItem}>
                        <div style={{
                          ...styles.timelineIcon,
                          backgroundColor: order.status !== 'cancelled' ? '#4caf50' : '#999'
                        }}>
                          🕐
                        </div>
                        <div style={styles.timelineContent}>
                          <h4 style={styles.timelineTitle}>Order in Queue</h4>
                          <p style={styles.timelineTime}>
                            {order.created_at ? formatDate(order.created_at) : '-'}
                          </p>
                        </div>
                      </div>

                      <div style={styles.timelineItem}>
                        <div style={{
                          ...styles.timelineIcon,
                          backgroundColor: ['order_in_process', 'out_for_delivery', 'order_delivered'].includes(order.status) ? '#4caf50' : '#999'
                        }}>
                          👨‍🍳
                        </div>
                        <div style={styles.timelineContent}>
                          <h4 style={styles.timelineTitle}>Order in Process</h4>
                          <p style={styles.timelineTime}>
                            {order.accepted_at ? formatDate(order.accepted_at) : 'Pending'}
                          </p>
                        </div>
                      </div>

                      <div style={styles.timelineItem}>
                        <div style={{
                          ...styles.timelineIcon,
                          backgroundColor: ['out_for_delivery', 'order_delivered'].includes(order.status) ? '#4caf50' : '#999'
                        }}>
                          {order.order_mode === 'pick-up' ? '✅' : '🛵'}
                        </div>
                        <div style={styles.timelineContent}>
                          <h4 style={styles.timelineTitle}>
                            {order.order_mode === 'pick-up' ? 'Ready for Pick-up' : 'Out for Delivery'}
                          </h4>
                          <p style={styles.timelineTime}>
                            {order.out_for_delivery_at ? formatDate(order.out_for_delivery_at) : 'Pending'}
                          </p>
                        </div>
                      </div>

                      <div style={styles.timelineItem}>
                        <div style={{
                          ...styles.timelineIcon,
                          backgroundColor: order.status === 'order_delivered' ? '#4caf50' : '#999'
                        }}>
                          ✓
                        </div>
                        <div style={styles.timelineContent}>
                          <h4 style={styles.timelineTitle}>
                            {order.order_mode === 'pick-up' ? 'Order Complete' : 'Order Delivered'}
                          </h4>
                          <p style={styles.timelineTime}>
                            {order.delivered_at ? formatDate(order.delivered_at) : 'Pending'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div style={styles.orderDetails}>
                      <p style={styles.statusDescription}>{statusInfo.description}</p>
                      
                      <div style={styles.orderInfo}>
                        <div style={styles.infoRow}>
                          <span style={styles.infoLabel}>Items:</span>
                          <span style={styles.infoValue}>{order.items?.length || 0}</span>
                        </div>
                        <div style={styles.infoRow}>
                          <span style={styles.infoLabel}>Total Amount:</span>
                          <span style={styles.infoValue}>₱{order.total_amount?.toFixed(2)}</span>
                        </div>
                        <div style={styles.infoRow}>
                          <span style={styles.infoLabel}>Payment Method:</span>
                          <span style={styles.infoValue}>{order.payment_method?.toUpperCase()}</span>
                        </div>
                        <div style={styles.infoRow}>
                          <span style={styles.infoLabel}>Delivery Fee:</span>
                          <span style={styles.infoValue}>₱{order.delivery_fee?.toFixed(2)}</span>
                        </div>
                        {order.points_used > 0 && (
                          <div style={styles.infoRow}>
                            <span style={styles.infoLabel}>Points Used:</span>
                            <span style={{...styles.infoValue, color: '#4caf50'}}>₱{order.points_used?.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      <button 
                        style={styles.detailsBtn}
                        onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                      >
                        {selectedOrder?.id === order.id ? 'Hide Details' : 'View Details'}
                      </button>

                      {selectedOrder?.id === order.id && (
                        <div style={styles.expandedDetails}>
                          <h4 style={styles.detailsTitle}>Order Items</h4>
                          {order.items?.map((item, idx) => (
                            <div key={idx} style={styles.itemRow}>
                              <span>{item.name}</span>
                              <span>x{item.quantity}</span>
                              <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                          
                          {order.special_request && (
                            <>
                              <h4 style={styles.detailsTitle}>Special Request</h4>
                              <p style={styles.specialRequest}>{order.special_request}</p>
                            </>
                          )}

                          <h4 style={styles.detailsTitle}>Delivery Address</h4>
                          <p style={styles.address}>{order.delivery_address}</p>

                          {order.gcash_reference && (
                            <>
                              <h4 style={styles.detailsTitle}>GCash Reference</h4>
                              <p style={styles.reference}>{order.gcash_reference}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📦</span>
              <p style={styles.emptyText}>No orders yet</p>
              <p style={styles.emptySubtext}>Start by placing your first order!</p>
              <Link href="/customer/order" style={styles.orderNowBtn}>
                Order Now
              </Link>
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
    flexWrap: 'wrap',
    gap: '12px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  nav: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.3s',
    cursor: 'pointer',
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
  ordersGrid: {
    display: 'grid',
    gap: '24px',
  },
  orderCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #444',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  orderId: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 0 4px 0',
  },
  orderDate: {
    fontSize: '12px',
    color: '#999',
    margin: 0,
  },
  statusBadge: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#000',
  },
  progressContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '24px',
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
    paddingLeft: '8px',
  },
  timelineItem: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  timelineIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 0 4px 0',
  },
  timelineTime: {
    fontSize: '12px',
    color: '#999',
    margin: 0,
  },
  orderDetails: {
    borderTop: '1px solid #444',
    paddingTop: '20px',
  },
  statusDescription: {
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '16px',
    fontStyle: 'italic',
  },
  orderInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '14px',
  },
  infoLabel: {
    color: '#999',
  },
  infoValue: {
    color: '#fff',
    fontWeight: 'bold',
  },
  detailsBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 'bold',
  },
  expandedDetails: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
  },
  detailsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#ffc107',
    margin: '16px 0 8px 0',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid #333',
  },
  specialRequest: {
    fontSize: '13px',
    color: '#ccc',
    margin: '8px 0',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    borderRadius: '6px',
  },
  address: {
    fontSize: '13px',
    color: '#ccc',
    margin: '8px 0',
  },
  reference: {
    fontSize: '13px',
    color: '#4caf50',
    margin: '8px 0',
    fontWeight: 'bold',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '80px',
    marginBottom: '20px',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '20px',
    color: '#ccc',
    marginBottom: '8px',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '24px',
  },
  orderNowBtn: {
    display: 'inline-block',
    padding: '12px 32px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    textDecoration: 'none',
    cursor: 'pointer',
  },
};
