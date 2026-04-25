import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function OrderTracking() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

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
          console.error('[OrderTracking] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';
        setUserRole(role);

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
        console.error('[OrderTracking] Session check failed:', err?.message ?? err);
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

  // Fetch orders
  useEffect(() => {
    async function fetchOrders() {
      if (!supabase || loading || !user) return;
      
      setLoadingOrders(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          setOrders(data);
        }
      } catch (err) {
        console.error('[OrderTracking] Failed to fetch orders:', err);
      } finally {
        setLoadingOrders(false);
      }
    }

    fetchOrders();
  }, [loading, user]);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '#ffb300';
      case 'confirmed':
        return '#2196f3';
      case 'preparing':
        return '#9c27b0';
      case 'out for delivery':
      case 'out_for_delivery':
        return '#ff9800';
      case 'delivered':
      case 'completed':
        return '#4caf50';
      case 'cancelled':
        return '#f44336';
      default:
        return '#666';
    }
  };

  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
          <button style={styles.backBtn} onClick={() => router.push('/customer/dashboard')}>
            ← Back
          </button>
          <h1 style={styles.logo}>📦 Order Tracking</h1>
          <div style={{ width: '80px' }}></div>
        </header>

        <main style={styles.main}>
          {loadingOrders && (
            <p style={styles.loadingText}>Loading orders...</p>
          )}

          {!loadingOrders && orders.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📦</span>
              <p style={styles.emptyText}>No orders yet</p>
              <p style={styles.emptySubtext}>
                Start ordering from our menu to see your orders here
              </p>
              <button 
                style={styles.orderBtn}
                onClick={() => router.push('/customer/order')}
              >
                Browse Menu
              </button>
            </div>
          )}

          {!loadingOrders && orders.length > 0 && (
            <div style={styles.ordersList}>
              {orders.map(order => (
                <div key={order.id} style={styles.orderCard}>
                  <div style={styles.orderHeader}>
                    <div>
                      <h3 style={styles.orderId}>Order #{order.id?.slice(0, 8)}</h3>
                      <p style={styles.orderDate}>
                        {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
                      </p>
                    </div>
                    <div style={styles.statusBadge}>
                      <span 
                        style={{
                          ...styles.statusDot,
                          backgroundColor: getStatusColor(order.status)
                        }}
                      />
                      <span style={styles.statusText}>
                        {formatStatus(order.status)}
                      </span>
                    </div>
                  </div>
                  
                  {order.items && (
                    <div style={styles.orderItems}>
                      <p style={styles.itemsLabel}>Items:</p>
                      <OrderItemsList items={order.items} />
                    </div>
                  )}

                  <div style={styles.orderFooter}>
                    <span style={styles.totalLabel}>Total:</span>
                    <span style={styles.totalAmount}>
                      ₱{order.total_amount?.toFixed(2) || '0.00'}
                    </span>
                  </div>

                  {/* Order Timeline */}
                  <div style={styles.timeline}>
                    <TimelineItem 
                      label="Order Placed" 
                      active={true}
                      completed={true}
                    />
                    <TimelineItem 
                      label="Confirmed" 
                      active={['confirmed', 'preparing', 'out for delivery', 'out_for_delivery', 'delivered', 'completed'].includes(order.status?.toLowerCase())}
                      completed={['preparing', 'out for delivery', 'out_for_delivery', 'delivered', 'completed'].includes(order.status?.toLowerCase())}
                    />
                    <TimelineItem 
                      label="Preparing" 
                      active={['preparing', 'out for delivery', 'out_for_delivery', 'delivered', 'completed'].includes(order.status?.toLowerCase())}
                      completed={['out for delivery', 'out_for_delivery', 'delivered', 'completed'].includes(order.status?.toLowerCase())}
                    />
                    <TimelineItem 
                      label="Out for Delivery" 
                      active={['out for delivery', 'out_for_delivery', 'delivered', 'completed'].includes(order.status?.toLowerCase())}
                      completed={['delivered', 'completed'].includes(order.status?.toLowerCase())}
                    />
                    <TimelineItem 
                      label="Delivered" 
                      active={['delivered', 'completed'].includes(order.status?.toLowerCase())}
                      completed={['delivered', 'completed'].includes(order.status?.toLowerCase())}
                      isLast={true}
                    />
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

function OrderItemsList({ items }) {
  let parsedItems = [];
  
  try {
    if (typeof items === 'string') {
      parsedItems = JSON.parse(items);
    } else if (Array.isArray(items)) {
      parsedItems = items;
    }
  } catch (e) {
    return <p style={styles.itemsList}>Unable to parse order items</p>;
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    return <p style={styles.itemsList}>No items</p>;
  }

  return (
    <ul style={styles.itemsList}>
      {parsedItems.map((item, index) => (
        <li key={index} style={styles.orderItem}>
          <span>{item.name || 'Unknown Item'}</span>
          {item.quantity && <span style={styles.itemQty}> × {item.quantity}</span>}
          {item.price && <span style={styles.itemPrice}> ₱{(item.price * (item.quantity || 1)).toFixed(2)}</span>}
        </li>
      ))}
    </ul>
  );
}

function TimelineItem({ label, active, completed, isLast }) {
  return (
    <div style={styles.timelineItem}>
      <div style={styles.timelineContent}>
        <div 
          style={{
            ...styles.timelineDot,
            backgroundColor: completed ? '#4caf50' : active ? '#ffc107' : '#444',
            borderColor: completed ? '#4caf50' : active ? '#ffc107' : '#444',
          }}
        >
          {completed && '✓'}
        </div>
        <span 
          style={{
            ...styles.timelineLabel,
            color: active ? '#fff' : '#666',
            fontWeight: active ? '600' : '400',
          }}
        >
          {label}
        </span>
      </div>
      {!isLast && (
        <div 
          style={{
            ...styles.timelineLine,
            backgroundColor: completed ? '#4caf50' : '#444',
          }}
        />
      )}
    </div>
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
    flex: 1,
    textAlign: 'center',
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
    padding: '32px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  loadingText: {
    color: '#aaa',
    fontSize: '14px',
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
  orderBtn: {
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
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '24px',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #2a2a2a',
  },
  orderId: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffc107',
    margin: 0,
    marginBottom: '4px',
  },
  orderDate: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#2a2a2a',
    borderRadius: '20px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
  },
  orderItems: {
    marginBottom: '16px',
  },
  itemsLabel: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
    marginBottom: '8px',
  },
  itemsList: {
    fontSize: '14px',
    color: '#ccc',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '14px',
    color: '#ccc',
  },
  itemQty: {
    color: '#999',
    marginLeft: '8px',
  },
  itemPrice: {
    color: '#ffc107',
    marginLeft: 'auto',
    paddingLeft: '12px',
  },
  orderFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    paddingBottom: '16px',
    borderTop: '1px solid #2a2a2a',
    borderBottom: '1px solid #2a2a2a',
    marginBottom: '20px',
  },
  totalLabel: {
    fontSize: '14px',
    color: '#999',
  },
  totalAmount: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffc107',
  },
  timeline: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '8px',
  },
  timelineItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: '#0a0a0a',
    fontWeight: '700',
    marginBottom: '8px',
  },
  timelineLabel: {
    fontSize: '11px',
    textAlign: 'center',
    maxWidth: '80px',
  },
  timelineLine: {
    position: 'absolute',
    top: '16px',
    left: '50%',
    right: '-50%',
    height: '2px',
    zIndex: 0,
  },
};
