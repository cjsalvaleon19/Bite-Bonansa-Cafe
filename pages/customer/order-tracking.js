import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import NotificationBell from '../../components/NotificationBell';

export default function OrderTracking() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

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
        // Fetch orders with order_items
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id,
              menu_item_id,
              name,
              price,
              quantity,
              subtotal,
              notes
            )
          `)
          .eq('customer_id', user.id)
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
      case 'order_in_queue':
        return '#ffb300';
      case 'confirmed':
      case 'order_in_process':
        return '#2196f3';
      case 'preparing':
        return '#9c27b0';
      case 'out for delivery':
      case 'out_for_delivery':
        return '#ff9800';
      case 'delivered':
      case 'order_delivered':
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
    const formatted = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    // Map internal status to user-friendly labels
    const statusMap = {
      'Pending': 'Order in Queue',
      'Order In Queue': 'Order in Queue',
      'Confirmed': 'Order in Process',
      'Order In Process': 'Order in Process',
      'Preparing': 'Order in Process',
      'Out For Delivery': 'Out for Delivery',
      'Delivered': 'Order Delivered',
      'Order Delivered': 'Order Delivered',
      'Completed': 'Order Delivered'
    };
    return statusMap[formatted] || formatted;
  };

  const getProgressSteps = (status, orderMode) => {
    const normalizedStatus = status?.toLowerCase();
    const isPickup = orderMode === 'pick-up';
    
    const steps = [
      { label: 'Order in Queue', status: 'order_in_queue', icon: '🕐' },
      { label: 'Order in Process', status: 'order_in_process', icon: '👨‍🍳' },
      { 
        label: isPickup ? 'Ready for Pick-up' : 'Out for Delivery', 
        status: 'out_for_delivery', 
        icon: isPickup ? '✅' : '🛵' 
      },
      { 
        label: isPickup ? 'Order Complete' : 'Order Delivered', 
        status: 'order_delivered', 
        icon: '✓' 
      },
    ];

    const statusOrder = ['order_in_queue', 'pending', 'confirmed', 'order_in_process', 'preparing', 'out_for_delivery', 'out for delivery', 'order_delivered', 'delivered', 'completed'];
    const currentIndex = statusOrder.indexOf(normalizedStatus);

    return steps.map((step, index) => {
      const stepStatuses = [
        ['order_in_queue', 'pending'],
        ['confirmed', 'order_in_process', 'preparing'],
        ['out_for_delivery', 'out for delivery'],
        ['order_delivered', 'delivered', 'completed']
      ];
      const isCompleted = stepStatuses[index].some(s => {
        const sIdx = statusOrder.indexOf(s);
        return sIdx !== -1 && sIdx <= currentIndex && currentIndex > -1;
      });
      const isActive = stepStatuses[index].includes(normalizedStatus);
      return { ...step, isCompleted, isActive };
    });
  };

  const extractSpecialRequest = (specialRequest) => {
    if (!specialRequest || typeof specialRequest !== 'string') return '';
    // Extract customer notes only (before any | delimiter)
    const parts = specialRequest.split('|');
    return parts[0].trim();
  };

  const extractDeliveryAddress = (order) => {
    // Priority: delivery_address > customer_address
    if (order.delivery_address) return order.delivery_address;
    if (order.customer_address) return order.customer_address;
    return 'Not specified';
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
          <div style={styles.headerActions}>
            <NotificationBell user={user} />
            <div style={{ width: '8px' }}></div>
          </div>
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
              {orders.map(order => {
                const progressSteps = getProgressSteps(order.status, order.order_mode);
                const isExpanded = expandedOrderId === order.id;
                const orderNumber = order.order_number || order.id?.slice(0, 8);
                const customerNotes = extractSpecialRequest(order.special_request);
                const isPickup = order.order_mode === 'pick-up';
                const deliveryAddress = extractDeliveryAddress(order);
                const currentStatus = formatStatus(order.status);
                
                return (
                  <div key={order.id} style={styles.orderCard}>
                    {/* Order Header with Number and Status */}
                    <div style={styles.orderHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <div>
                          <h3 style={styles.orderId}>Order #{orderNumber}</h3>
                          <p style={styles.orderDate}>
                            {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
                          </p>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            ...styles.statusBadge,
                            backgroundColor: getStatusColor(order.status),
                          }}>
                            {currentStatus}
                          </span>
                          {isPickup && (
                            <span style={styles.pickupBadge}>Pick-up</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Horizontal Progress Bar */}
                    <div style={styles.horizontalProgressContainer}>
                      <div style={styles.horizontalStepsWrapper}>
                        {progressSteps.map((step, index) => (
                          <React.Fragment key={index}>
                            {/* Step */}
                            <div style={styles.horizontalProgressStep}>
                              <div style={{
                                ...styles.horizontalStepCircle,
                                backgroundColor: step.isCompleted ? '#4caf50' : step.isActive ? '#ffc107' : '#1a1a1a',
                                borderColor: step.isCompleted ? '#4caf50' : step.isActive ? '#ffc107' : '#444',
                              }}>
                                {step.isCompleted ? '✓' : step.icon}
                              </div>
                              <span style={{
                                ...styles.horizontalStepLabel,
                                color: step.isActive || step.isCompleted ? '#fff' : '#666',
                                fontWeight: step.isActive ? '600' : '400'
                              }}>
                                {step.label}
                              </span>
                            </div>
                            
                            {/* Connection Line (except after last) */}
                            {index < progressSteps.length - 1 && (
                              <div style={{
                                ...styles.horizontalConnectionLine,
                                backgroundColor: step.isCompleted ? '#4caf50' : '#444'
                              }} />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* Order Info Grid */}
                    <div style={styles.orderInfoGrid}>
                      {!isPickup && (
                        <div style={styles.infoItem}>
                          <span style={styles.infoLabel}>Delivery Address:</span>
                          <span style={styles.infoValue}>{deliveryAddress}</span>
                        </div>
                      )}
                      {customerNotes && (
                        <div style={styles.infoItem}>
                          <span style={styles.infoLabel}>Special Request:</span>
                          <span style={styles.infoValue}>{customerNotes}</span>
                        </div>
                      )}
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Payment Method:</span>
                        <span style={styles.infoValue}>{order.payment_method || 'N/A'}</span>
                      </div>
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Total Amount:</span>
                        <span style={styles.infoValueHighlight}>
                          ₱{order.total_amount?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>

                    {/* View Details Button */}
                    <button
                      style={styles.viewDetailsBtn}
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      {isExpanded ? '▼ Hide Details' : '▶ View Details'}
                    </button>

                    {/* Order Items (Expandable) */}
                    {isExpanded && order.order_items && order.order_items.length > 0 && (
                      <div style={styles.orderItemsSection}>
                        <h4 style={styles.itemsHeader}>Order Items:</h4>
                        <div style={styles.itemsList}>
                          {order.order_items.map((item, idx) => (
                            <div key={item.id || idx} style={styles.orderItem}>
                              <div style={styles.itemInfo}>
                                <span style={styles.itemName}>{item.name}</span>
                                {/* Item notes: customization requests for individual items (e.g., "extra sugar", "no ice") */}
                                {item.notes && (
                                  <span style={styles.itemNotes}>Note: {item.notes}</span>
                                )}
                              </div>
                              <div style={styles.itemPriceInfo}>
                                <span style={styles.itemQty}>x{item.quantity}</span>
                                <span style={styles.itemPrice}>
                                  ₱{(item.subtotal || (item.price && item.quantity ? item.price * item.quantity : 0))?.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
    position: 'sticky',
    top: 0,
    zIndex: 100,
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
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
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
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #2a2a2a',
  },
  orderId: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffc107',
    margin: 0,
  },
  orderDate: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#0a0a0a',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  pickupBadge: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#0a0a0a',
    backgroundColor: '#4caf50',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  horizontalProgressContainer: {
    marginBottom: '28px',
    paddingBottom: '20px',
    borderBottom: '1px solid #2a2a2a',
  },
  horizontalStepsWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  horizontalProgressStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '80px',
  },
  horizontalConnectionLine: {
    flex: 1,
    height: '4px',
    minWidth: '20px',
    transition: 'background-color 0.3s',
  },
  horizontalStepCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '3px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '700',
    zIndex: 1,
    transition: 'all 0.3s',
    position: 'relative',
    marginBottom: '8px',
  },
  horizontalStepLabel: {
    fontSize: '11px',
    textAlign: 'center',
    lineHeight: '1.3',
    transition: 'color 0.3s',
    wordWrap: 'break-word',
    maxWidth: '100%',
    marginTop: '4px',
  },
  orderInfoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  infoValue: {
    fontSize: '14px',
    color: '#ccc',
  },
  infoValueHighlight: {
    fontSize: '18px',
    color: '#ffc107',
    fontWeight: 'bold',
  },
  viewDetailsBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s',
    marginBottom: '0',
  },
  orderItemsSection: {
    backgroundColor: '#0f0f0f',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px',
  },
  itemsHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffc107',
    margin: '0 0 12px 0',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    gap: '12px',
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  itemName: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '600',
  },
  itemNotes: {
    fontSize: '12px',
    color: '#999',
    fontStyle: 'italic',
  },
  itemPriceInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  itemQty: {
    fontSize: '13px',
    color: '#ccc',
    fontWeight: '700',
  },
  itemPrice: {
    fontSize: '14px',
    color: '#ffc107',
    fontWeight: '600',
  },
};
