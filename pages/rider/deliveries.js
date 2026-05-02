import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../utils/supabaseClient';
import { STORE_LOCATION, getGoogleMapsNavigationUrl, RIDER_FEE_PERCENTAGE } from '../../utils/deliveryCalculator';
import ReceiptModal from '../../components/ReceiptModal';

// Dynamically import RouteMapModal to avoid SSR issues with Leaflet
const RouteMapModal = dynamic(
  () => import('../../components/RouteMapModal'),
  { ssr: false }
);

const DEFAULT_DELIVERY_FEE = 50;

// Query string for fetching deliveries with related order data
const DELIVERIES_SELECT_QUERY = '*, orders(id, order_number, total, subtotal, customer_name, customer_phone, customer_address, delivery_fee, items, customer_latitude, customer_longitude, points_used, cash_amount, customer_id, order_mode, payment_method)';

// Helper function to format distance
const formatDistance = (meters) => {
  if (!meters) return 'N/A';
  return meters < 1000 
    ? `${meters} m` 
    : `${(meters / 1000).toFixed(2)} km`;
};

export default function RiderDeliveries() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'pending', 'for_delivery', 'completed', 'all'
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [expandedDeliveries, setExpandedDeliveries] = useState({});
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

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
          console.error('[RiderDeliveries] Failed to fetch user role:', userError.message);
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

        // Fetch deliveries from database
        await fetchDeliveries(session.user.id);
        setLoading(false);
      } catch (err) {
        console.error('[RiderDeliveries] Session check failed:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
          router.replace('/login').catch(console.error);
        }
      }
    }

    async function fetchDeliveries(userId) {
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select(DELIVERIES_SELECT_QUERY)
          .eq('rider_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[RiderDeliveries] Failed to fetch deliveries:', error.message);
        } else {
          setDeliveries(data || []);
        }
      } catch (err) {
        console.error('[RiderDeliveries] Failed to fetch deliveries:', err?.message ?? err);
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
  }, [router, filter]);

  useEffect(() => {
    if (user) {
      fetchDeliveriesWithFilter(user.id);
    }
  }, [filter, user]);

  const fetchDeliveriesWithFilter = async (userId) => {
    if (!supabase) return;

    try {
      let query = supabase
        .from('deliveries')
        .select(DELIVERIES_SELECT_QUERY)
        .eq('rider_id', userId);

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      } else if (filter === 'for_delivery') {
        query = query.in('status', ['accepted', 'in_progress']);
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed');
      }
      // 'all' filter doesn't add any status filter

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[RiderDeliveries] Failed to fetch deliveries:', error.message);
      } else {
        setDeliveries(data || []);
      }
    } catch (err) {
      console.error('[RiderDeliveries] Failed to fetch deliveries:', err?.message ?? err);
    }
  };

  const handleStartDelivery = (delivery) => {
    setSelectedDelivery(delivery);
    setShowRouteModal(true);
  };

  const handleConfirmStartDelivery = async () => {
    if (!selectedDelivery) return;
    
    await handleUpdateStatus(selectedDelivery.id, 'in_progress');
    setShowRouteModal(false);
    setSelectedDelivery(null);
  };

  const handleCloseRouteModal = () => {
    setShowRouteModal(false);
    setSelectedDelivery(null);
  };

  const toggleDeliveryDetails = (deliveryId) => {
    setExpandedDeliveries(prev => ({
      ...prev,
      [deliveryId]: !prev[deliveryId]
    }));
  };

  const handleViewReceipt = (delivery) => {
    setSelectedReceipt(delivery);
    setShowReceiptModal(true);
  };

  const handleCloseReceipt = () => {
    setShowReceiptModal(false);
    setSelectedReceipt(null);
  };

  const handleUpdateStatus = async (deliveryId, newStatus) => {
    setUpdatingStatus(deliveryId);

    try {
      if (!supabase) throw new Error('Supabase not available');

      const updateData = { status: newStatus };
      
      // Update timestamps based on status
      if (newStatus === 'accepted') {
        updateData.accepted_at = new Date().toISOString();
      } else if (newStatus === 'in_progress') {
        updateData.started_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('deliveries')
        .update(updateData)
        .eq('id', deliveryId);

      if (error) throw error;

      // If marking as completed, also update the order status
      if (newStatus === 'completed') {
        // Get the order_id from the delivery
        const delivery = deliveries.find(d => d.id === deliveryId);
        if (delivery && delivery.order_id) {
          await supabase
            .from('orders')
            .update({ 
              status: 'order_delivered',
              delivered_at: new Date().toISOString()
            })
            .eq('id', delivery.order_id);
        }
      }

      // If accepting order, update order status to out_for_delivery
      if (newStatus === 'accepted' || newStatus === 'in_progress') {
        const delivery = deliveries.find(d => d.id === deliveryId);
        if (delivery && delivery.order_id) {
          await supabase
            .from('orders')
            .update({ 
              status: 'out_for_delivery',
              out_for_delivery_at: new Date().toISOString()
            })
            .eq('id', delivery.order_id);
        }
      }

      // Refresh deliveries
      await fetchDeliveriesWithFilter(user.id);
    } catch (err) {
      console.error('[RiderDeliveries] Failed to update status:', err?.message ?? err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[RiderDeliveries] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#ffc107';
      case 'accepted':
        return '#2196f3';
      case 'in_progress':
        return '#ff9800';
      case 'completed':
        return '#4caf50';
      case 'cancelled':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const getFilteredDeliveries = () => {
    // Apply client-side filtering as defensive measure
    // Database query should already filter, but this prevents stale data from showing
    if (filter === 'pending') {
      return deliveries.filter(d => d.status === 'pending');
    } else if (filter === 'for_delivery') {
      return deliveries.filter(d => d.status === 'accepted' || d.status === 'in_progress');
    } else if (filter === 'completed') {
      return deliveries.filter(d => d.status === 'completed');
    }
    // 'all' filter returns everything
    return deliveries;
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
        <title>Order Portal - Bite Bonansa Cafe</title>
        <meta name="description" content="Rider delivery management portal" />
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

        <nav style={styles.nav}>
          <Link href="/rider/dashboard" style={styles.navLink}>
            🏠 Dashboard
          </Link>
          <Link href="/rider/deliveries" style={{ ...styles.navLink, ...styles.navLinkActive }}>
            🚚 Deliveries
          </Link>
          <Link href="/rider/reports" style={styles.navLink}>
            📊 Reports
          </Link>
          <Link href="/rider/profile" style={styles.navLink}>
            👤 Profile
          </Link>
        </nav>

        <main style={styles.main}>
          <h2 style={styles.title}>🚚 Order Portal</h2>

          {/* Filter Tabs */}
          <div style={styles.filterTabs}>
            <button
              style={{
                ...styles.filterTab,
                ...(filter === 'pending' ? styles.filterTabActive : {}),
              }}
              onClick={() => setFilter('pending')}
            >
              📌 Pending Orders
            </button>
            <button
              style={{
                ...styles.filterTab,
                ...(filter === 'for_delivery' ? styles.filterTabActive : {}),
              }}
              onClick={() => setFilter('for_delivery')}
            >
              🚚 Delivery
            </button>
            <button
              style={{
                ...styles.filterTab,
                ...(filter === 'completed' ? styles.filterTabActive : {}),
              }}
              onClick={() => setFilter('completed')}
            >
              ✅ Completed
            </button>
            <button
              style={{
                ...styles.filterTab,
                ...(filter === 'all' ? styles.filterTabActive : {}),
              }}
              onClick={() => setFilter('all')}
            >
              📋 All Deliveries
            </button>
          </div>
          
          <div style={styles.content}>
            {getFilteredDeliveries().length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>📦</span>
                <p style={styles.emptyText}>
                  {filter === 'pending' && 'No pending orders'}
                  {filter === 'for_delivery' && 'No accepted deliveries ready to start'}
                  {filter === 'completed' && 'No completed deliveries'}
                  {filter === 'all' && 'No deliveries assigned yet'}
                </p>
                <p style={styles.emptySubtext}>
                  New delivery assignments will appear here
                </p>
              </div>
            ) : (
              <div style={styles.deliveryList}>
                {getFilteredDeliveries().map((delivery) => {
                  const mapsUrl = getGoogleMapsNavigationUrl(delivery);
                  const isLocked = delivery.status === 'completed' && delivery.report_paid;
                  
                  return (
                    <div 
                      key={delivery.id} 
                      style={{
                        ...styles.deliveryCard,
                        ...(isLocked ? styles.deliveryCardLocked : {}),
                      }}
                    >
                      <div style={styles.deliveryHeader}>
                        <h3 style={styles.deliveryTitle}>
                          {delivery.orders?.order_number || `Order #${delivery.order_id}`}
                        </h3>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            style={styles.viewDetailsBtn}
                            onClick={() => toggleDeliveryDetails(delivery.id)}
                          >
                            {expandedDeliveries[delivery.id] ? '▼ Hide Details' : '▶ View Details'}
                          </button>
                          <span
                            style={{
                              ...styles.status,
                              backgroundColor: getStatusColor(delivery.status),
                            }}
                          >
                            {delivery.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div style={styles.deliveryBody}>
                        <div style={styles.deliveryInfo}>
                          <p style={styles.infoItem}>
                            <strong>Customer:</strong> {delivery.orders?.customer_name || delivery.customer_name || 'N/A'}
                          </p>
                          <p style={styles.infoItem}>
                            <strong>Phone:</strong> {delivery.orders?.customer_phone || delivery.customer_phone || 'N/A'}
                          </p>
                          
                          {expandedDeliveries[delivery.id] && (
                            <>
                              <p style={styles.infoItem}>
                                <strong>Address:</strong> {delivery.customer_address || 'N/A'}
                              </p>
                              {mapsUrl && (
                                <p style={styles.infoItem}>
                                  <a 
                                    href={mapsUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={styles.mapsLink}
                                  >
                                    📍 Open in Google Maps (Directions)
                                  </a>
                                </p>
                              )}
                              {delivery.distance_meters && (
                                <p style={styles.infoItem}>
                                  <strong>Distance:</strong> {formatDistance(delivery.distance_meters)}
                                </p>
                              )}
                              <p style={styles.infoItem}>
                                <strong>Billable Delivery Fee:</strong> ₱{((delivery.orders?.delivery_fee || delivery.delivery_fee || DEFAULT_DELIVERY_FEE) * RIDER_FEE_PERCENTAGE).toFixed(2)}
                              </p>
                              {delivery.orders?.items && Array.isArray(delivery.orders.items) && delivery.orders.items.length > 0 && (
                                <div style={styles.infoItem}>
                                  <strong>Items:</strong>
                                  <ul style={styles.itemsList}>
                                    {delivery.orders.items.map((item, idx) => (
                                      <li key={`${item.id || item.name}-${idx}`} style={styles.itemsListItem}>
                                        {item.quantity}x {item.name} @ ₱{item.price}
                                      </li>
                                    ))}
                                  </ul>
                                  <p style={{ margin: '8px 0 0 0', fontWeight: 'bold' }}>
                                    Total: ₱{delivery.orders.total || 0}
                                  </p>
                                </div>
                              )}
                              {delivery.special_instructions && (
                                <p style={styles.infoItem}>
                                  <strong>Special Instructions:</strong> {delivery.special_instructions}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {isLocked && (
                          <div style={styles.lockedBanner}>
                            🔒 This delivery has been billed and paid. Details can no longer be edited.
                          </div>
                        )}

                        <div style={styles.actions}>
                          <button
                            style={styles.viewReceiptBtn}
                            onClick={() => handleViewReceipt(delivery)}
                          >
                            📄 View Receipt
                          </button>
                          {!isLocked && delivery.status !== 'completed' && delivery.status !== 'cancelled' && (
                            <>
                            {delivery.status === 'pending' && (
                              <button
                                style={styles.actionBtn}
                                onClick={() => handleUpdateStatus(delivery.id, 'accepted')}
                                disabled={updatingStatus === delivery.id}
                              >
                                {updatingStatus === delivery.id ? '⏳' : '✅'} Accept Order
                              </button>
                            )}
                            {delivery.status === 'accepted' && (
                              <button
                                style={{ ...styles.actionBtn, ...styles.actionBtnOrange }}
                                onClick={() => handleStartDelivery(delivery)}
                                disabled={updatingStatus === delivery.id}
                              >
                                {updatingStatus === delivery.id ? '⏳' : '🚀'} Start Delivery
                              </button>
                            )}
                            {delivery.status === 'in_progress' && (
                              <button
                                style={{ ...styles.actionBtn, ...styles.actionBtnSuccess }}
                                onClick={() => handleUpdateStatus(delivery.id, 'completed')}
                                disabled={updatingStatus === delivery.id}
                              >
                                {updatingStatus === delivery.id ? '⏳' : '📦'} Order Delivered
                              </button>
                            )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Route Map Modal */}
        {showRouteModal && selectedDelivery && (
          <RouteMapModal
            delivery={selectedDelivery}
            onClose={handleCloseRouteModal}
            onConfirm={handleConfirmStartDelivery}
            loading={updatingStatus === selectedDelivery.id}
          />
        )}

        {/* Receipt Modal */}
        {showReceiptModal && selectedReceipt && (
          <ReceiptModal
            delivery={selectedReceipt}
            onClose={handleCloseReceipt}
          />
        )}
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
  nav: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    padding: '20px 32px',
    backgroundColor: '#0a0a0a',
    borderBottom: '1px solid #333',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '16px',
    padding: '8px 16px',
    borderRadius: '6px',
    transition: 'all 0.3s ease',
  },
  navLinkActive: {
    color: '#ffc107',
    backgroundColor: '#1a1a1a',
    fontWeight: '600',
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
  filterTabs: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  filterTab: {
    padding: '10px 24px',
    backgroundColor: '#1a1a1a',
    color: '#ccc',
    border: '1px solid #333',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  filterTabActive: {
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    borderColor: '#ffc107',
    fontWeight: '600',
  },
  content: {
    minHeight: '400px',
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
  },
  deliveryList: {
    display: 'grid',
    gap: '20px',
  },
  deliveryCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(255,193,7,0.15)',
  },
  deliveryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #333',
  },
  deliveryTitle: {
    fontSize: '20px',
    color: '#ffc107',
    margin: 0,
    fontWeight: '600',
  },
  status: {
    display: 'inline-block',
    padding: '6px 16px',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  viewDetailsBtn: {
    padding: '6px 12px',
    backgroundColor: '#444',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  deliveryBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  deliveryInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  infoItem: {
    fontSize: '14px',
    color: '#ccc',
    margin: 0,
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    paddingTop: '12px',
    borderTop: '1px solid #333',
  },
  actionBtn: {
    padding: '10px 24px',
    backgroundColor: '#2196f3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  viewReceiptBtn: {
    padding: '10px 24px',
    backgroundColor: '#444',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  actionBtnSuccess: {
    backgroundColor: '#4caf50',
  },
  actionBtnOrange: {
    backgroundColor: '#ff9800',
  },
  deliveryCardLocked: {
    opacity: 0.7,
    borderColor: '#666',
  },
  lockedBanner: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #666',
    borderRadius: '6px',
    padding: '12px',
    color: '#ccc',
    fontSize: '14px',
    marginTop: '12px',
    textAlign: 'center',
  },
  mapsLink: {
    color: '#2196f3',
    textDecoration: 'none',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'color 0.3s ease',
  },
  itemsList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
    listStyle: 'disc',
  },
  itemsListItem: {
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '4px',
  },
};
