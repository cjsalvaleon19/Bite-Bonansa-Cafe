import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import NotificationBell from '../../components/NotificationBell';
import VariantSelectionModal from '../../components/VariantSelectionModal';

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    loyaltyBalance: 0,
    currentOrder: null,
    totalEarnings: 0,
    mostPurchasedItems: [],
    pendingOrdersCount: 0
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

        // Fetch user role and profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, full_name, customer_id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[CustomerDashboard] Failed to fetch user role:', userError.message);
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

        // Fetch dashboard data
        await fetchDashboardData(session.user.id);

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

  async function fetchDashboardData(userId) {
    try {
      // Get current order (most recent non-delivered order)
      const { data: currentOrderData } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at')
        .eq('customer_id', userId)
        .or('status.eq.order_in_queue,status.eq.order_in_process,status.eq.out_for_delivery')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get count of all pending orders
      const { count: pendingCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', userId)
        .or('status.eq.order_in_queue,status.eq.order_in_process,status.eq.out_for_delivery');

      // Calculate loyalty balance from loyalty_transactions
      const { data: allTransactions, error: transError } = await supabase
        .from('loyalty_transactions')
        .select('amount')
        .eq('customer_id', userId);

      // Handle missing table gracefully (PGRST116 = table not found)
      let loyaltyBalance = 0;
      if (transError) {
        if (transError.code !== 'PGRST116') {
          console.error('[CustomerDashboard] Error fetching loyalty transactions:', transError.message);
        }
      } else if (allTransactions) {
        loyaltyBalance = allTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      }

      // Get total earnings
      const { data: earningsData, error: earningsError } = await supabase
        .from('loyalty_transactions')
        .select('amount')
        .eq('customer_id', userId)
        .eq('transaction_type', 'earned');

      let totalEarnings = 0;
      if (earningsError) {
        if (earningsError.code !== 'PGRST116') {
          console.error('[CustomerDashboard] Error fetching earnings:', earningsError.message);
        }
      } else if (earningsData) {
        totalEarnings = earningsData.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      }

      // Get most purchased items (all items, sorted by purchase count)
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('customer_item_purchases')
        .select(`
          menu_item_id,
          purchase_count,
          menu_items (id, name, price, image_url, category, has_variants, variant_types)
        `)
        .eq('customer_id', userId)
        .order('purchase_count', { ascending: false });

      // Handle missing table gracefully
      let mostPurchasedItems = [];
      if (purchasesError) {
        if (purchasesError.code !== 'PGRST116') {
          console.error('[CustomerDashboard] Error fetching purchase history:', purchasesError.message);
        }
      } else if (purchasesData) {
        mostPurchasedItems = purchasesData;
      }

      setDashboardData({
        loyaltyBalance,
        currentOrder: currentOrderData,
        totalEarnings,
        mostPurchasedItems,
        pendingOrdersCount: pendingCount || 0
      });
    } catch (err) {
      console.error('[CustomerDashboard] Failed to fetch dashboard data:', err);
    }
  }

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

  const handleAddToCart = (item) => {
    // Check if item has variants
    if (item.has_variants && item.variant_types && item.variant_types.length > 0) {
      // Show variant selection modal
      setSelectedItem(item);
      setShowVariantModal(true);
    } else {
      // Navigate to order page with item ID to add directly
      router.push(`/customer/order?addItem=${item.id}`).catch(console.error);
    }
  };

  const handleVariantConfirm = (variantData) => {
    // Save the variant data to localStorage for the order page to pick up
    localStorage.setItem('pendingCartItem', JSON.stringify(variantData));
    setShowVariantModal(false);
    setSelectedItem(null);
    // Navigate to order page
    router.push('/customer/order').catch(console.error);
  };

  const handleVariantCancel = () => {
    setShowVariantModal(false);
    setSelectedItem(null);
  };

  const getStatusDisplay = (status, orderMode) => {
    const isPickup = orderMode === 'pick-up';
    const statusMap = {
      'order_in_queue': { label: 'Order in Queue', color: '#ffc107', icon: '🕐' },
      'order_in_process': { label: 'Order in Process', color: '#2196f3', icon: '👨‍🍳' },
      'out_for_delivery': { 
        label: isPickup ? 'Ready for Pick-up' : 'Out for Delivery', 
        color: '#ff9800', 
        icon: isPickup ? '✅' : '🛵' 
      },
      'order_delivered': { 
        label: isPickup ? 'Order Complete' : 'Order Delivered', 
        color: '#4caf50', 
        icon: '✓' 
      },
      'cancelled': { label: 'Cancelled', color: '#f44336', icon: '✗' }
    };
    return statusMap[status] || { label: status, color: '#999', icon: '?' };
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

  const statusInfo = dashboardData.currentOrder 
    ? getStatusDisplay(dashboardData.currentOrder.status, dashboardData.currentOrder.order_mode) 
    : null;

  return (
    <>
      <Head>
        <title>Dashboard - Bite Bonansa Cafe</title>
        <meta name="description" content="Customer dashboard" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/customer/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/customer/order" style={styles.navLink}>Order Portal</Link>
            <Link href="/customer/order-tracking" style={styles.navLink}>Order Tracking</Link>
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
          <h2 style={styles.title}>🏠 Customer Dashboard</h2>
          
          {/* Total Points Earned */}
          <div style={styles.pointsCard}>
            <div style={styles.pointsIcon}>💰</div>
            <div style={styles.pointsInfo}>
              <h3 style={styles.pointsLabel}>Total Points Earned</h3>
              <p style={styles.pointsValue}>₱{dashboardData.totalEarnings.toFixed(2)}</p>
              <p style={styles.pointsBalance}>Available Balance: ₱{dashboardData.loyaltyBalance.toFixed(2)}</p>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div style={styles.cardsGrid}>
            {/* Order Now */}
            <Link href="/customer/order" style={styles.actionCard}>
              <span style={styles.cardIcon}>🍽️</span>
              <h3 style={styles.cardTitle}>Order Now</h3>
              <p style={styles.cardDesc}>Browse menu and place order</p>
            </Link>

            {/* Order Status */}
            <Link href="/customer/order-tracking" style={styles.actionCard}>
              <span style={styles.cardIcon}>📦</span>
              <h3 style={styles.cardTitle}>Order Status</h3>
              {dashboardData.pendingOrdersCount > 0 ? (
                <>
                  <p style={{...styles.cardDesc, color: '#ffc107', fontWeight: 'bold', fontSize: '20px'}}>
                    {dashboardData.pendingOrdersCount} {dashboardData.pendingOrdersCount === 1 ? 'Order' : 'Orders'}
                  </p>
                  <p style={styles.cardDesc}>
                    {dashboardData.pendingOrdersCount === 1 ? 'Pending order' : 'Pending orders'}
                  </p>
                </>
              ) : (
                <p style={styles.cardDesc}>No Active Orders</p>
              )}
            </Link>

            {/* Total Earnings */}
            <div style={{...styles.actionCard, cursor: 'default'}}>
              <span style={styles.cardIcon}>💵</span>
              <h3 style={styles.cardTitle}>Total Earnings</h3>
              <p style={{...styles.cardDesc, fontSize: '20px', fontWeight: 'bold', color: '#4caf50'}}>
                ₱{dashboardData.totalEarnings.toFixed(2)}
              </p>
              <p style={{...styles.cardDesc, fontSize: '12px'}}>
                Can be used as payment option
              </p>
            </div>
          </div>

          {/* Most Purchased Items */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>🔥 Most Purchased Items</h3>
            {dashboardData.mostPurchasedItems.length > 0 ? (
              <div style={styles.itemsGrid}>
                {dashboardData.mostPurchasedItems.map((purchase) => {
                  const item = purchase.menu_items;
                  return (
                    <div key={purchase.menu_item_id} style={styles.itemCard}>
                      <div style={styles.itemImagePlaceholder}>
                        {item?.image_url ? (
                          <img src={item.image_url} alt={item.name} style={styles.itemImage} />
                        ) : (
                          <span style={styles.itemPlaceholder}>🍕</span>
                        )}
                      </div>
                      <h4 style={styles.itemName}>{item?.name || 'Unknown Item'}</h4>
                      <p style={styles.itemPrice}>₱{item?.price?.toFixed(2) || '0.00'}</p>
                      <p style={styles.itemPurchaseCount}>
                        Ordered {purchase.purchase_count} {purchase.purchase_count === 1 ? 'time' : 'times'}
                      </p>
                      <button
                        style={styles.addToCartBtn}
                        onClick={() => handleAddToCart(item)}
                      >
                        🛒 Add to Cart
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>📦</span>
                <p style={styles.emptyText}>No purchase history yet</p>
                <p style={styles.emptySubtext}>Start ordering to see your favorites here!</p>
              </div>
            )}
          </div>
        </main>

        {/* Variant Selection Modal */}
        {showVariantModal && selectedItem && (
          <VariantSelectionModal
            item={selectedItem}
            onConfirm={handleVariantConfirm}
            onCancel={handleVariantCancel}
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
    position: 'sticky',
    top: 0,
    zIndex: 100,
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
  pointsCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '32px',
    border: '1px solid #ffc107',
  },
  pointsIcon: {
    fontSize: '64px',
  },
  pointsInfo: {
    flex: 1,
  },
  pointsLabel: {
    fontSize: '16px',
    color: '#999',
    margin: '0 0 8px 0',
  },
  pointsValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#4caf50',
    margin: '0 0 8px 0',
  },
  pointsBalance: {
    fontSize: '14px',
    color: '#ccc',
    margin: 0,
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '40px',
  },
  actionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #444',
    textDecoration: 'none',
    color: '#fff',
    transition: 'all 0.3s',
    cursor: 'pointer',
    display: 'block',
  },
  cardIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffc107',
    margin: '0 0 12px 0',
  },
  cardDesc: {
    fontSize: '14px',
    color: '#ccc',
    margin: '0',
  },
  viewDetailsLink: {
    display: 'inline-block',
    marginTop: '12px',
    color: '#ffc107',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  section: {
    marginTop: '40px',
  },
  sectionTitle: {
    fontSize: '24px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '24px',
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
  },
  itemCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #444',
    textAlign: 'center',
  },
  itemImagePlaceholder: {
    width: '100%',
    height: '150px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  itemPlaceholder: {
    fontSize: '64px',
    opacity: 0.3,
  },
  itemName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 0 8px 0',
  },
  itemPrice: {
    fontSize: '18px',
    color: '#4caf50',
    margin: '0 0 8px 0',
    fontWeight: 'bold',
  },
  itemPurchaseCount: {
    fontSize: '12px',
    color: '#999',
    margin: '0 0 12px 0',
  },
  addToCartBtn: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
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
};
