import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import NotificationBell from '../../components/NotificationBell';
import { isSundayInManila, SUNDAY_CLOSURE_MESSAGE } from '../../lib/store';

const SUNDAY_LOGIN_REMINDER_KEY = 'bite-bonanza-sunday-login-reminder';
const HISTORY_CART_KEY_PREFIX = 'history';

const normalizeQuantity = (value) => Math.max(1, Number(value) || 1);

const generateVariantKey = (variantDetails) => (
  variantDetails && typeof variantDetails === 'object'
    ? JSON.stringify(Object.entries(variantDetails).sort(([a], [b]) => a.localeCompare(b)))
    : 'default'
);

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSundayReminder, setShowSundayReminder] = useState(false);
  const [purchaseSortOrder, setPurchaseSortOrder] = useState('most');
  const [focusedCardId, setFocusedCardId] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    loyaltyBalance: 0,
    currentOrder: null,
    totalEarnings: 0,
    mostPurchasedItems: [],
    pendingOrdersCount: 0,
    publishedReviewsCount: 0
  });

  const sortedMostPurchasedItems = useMemo(
    () => [...dashboardData.mostPurchasedItems].sort((a, b) => {
      const left = Number(a?.purchase_count) || 0;
      const right = Number(b?.purchase_count) || 0;
      return purchaseSortOrder === 'least' ? left - right : right - left;
    }),
    [dashboardData.mostPurchasedItems, purchaseSortOrder]
  );

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

        if (isSundayInManila() && sessionStorage.getItem(SUNDAY_LOGIN_REMINDER_KEY) === 'true') {
          setShowSundayReminder(true);
          sessionStorage.removeItem(SUNDAY_LOGIN_REMINDER_KEY);
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
        .or('status.eq.order_in_queue,status.eq.order_in_process,status.eq.proceed_to_cashier,status.eq.out_for_delivery');

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

      let mostPurchasedItems = [];

      // Build most purchased data from actual order history to preserve preferred variants and quantity
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select(`
          menu_item_id,
          quantity,
          price,
          variant_details,
          orders!inner(customer_id, status, created_at)
        `)
        .eq('orders.customer_id', userId)
        .in('orders.status', ['order_delivered', 'completed']);

      if (!orderItemsError && Array.isArray(orderItemsData) && orderItemsData.length > 0) {
        const historyMap = new Map();

        orderItemsData.forEach((row) => {
          const menuItemId = row?.menu_item_id;
          if (!menuItemId) return;

          const quantity = normalizeQuantity(row?.quantity);
          const unitPrice = Number(row?.price) || 0;
          const variantDetails = row?.variant_details && typeof row.variant_details === 'object'
            ? row.variant_details
            : null;
          const variantKey = generateVariantKey(variantDetails);
          const createdAt = row?.orders?.created_at || '';

          if (!historyMap.has(menuItemId)) {
            historyMap.set(menuItemId, {
              menu_item_id: menuItemId,
              purchase_count: 0,
              selections: new Map(),
            });
          }

          const historyEntry = historyMap.get(menuItemId);
          historyEntry.purchase_count += quantity;

          if (!historyEntry.selections.has(variantKey)) {
            historyEntry.selections.set(variantKey, {
              count: 0,
              quantity,
              unitPrice,
              variantDetails,
              variantKey,
              lastPurchasedAt: createdAt,
            });
          }

          const selection = historyEntry.selections.get(variantKey);
          selection.count += quantity;
          if (createdAt && (!selection.lastPurchasedAt || createdAt > selection.lastPurchasedAt)) {
            selection.lastPurchasedAt = createdAt;
            selection.quantity = quantity;
            selection.unitPrice = unitPrice;
            selection.variantDetails = variantDetails;
          }
        });

        const menuItemIds = Array.from(historyMap.keys());
        const { data: menuItemsData, error: menuItemsError } = await supabase
          .from('menu_items')
          .select('id, name, price, image_url, category, has_variants')
          .in('id', menuItemIds);

        if (!menuItemsError && Array.isArray(menuItemsData)) {
          const menuItemsById = new Map(menuItemsData.map((item) => [item.id, item]));
          mostPurchasedItems = Array.from(historyMap.values())
            .map((entry) => {
              const item = menuItemsById.get(entry.menu_item_id);
              if (!item) return null;

              const preferredSelection = Array.from(entry.selections.values()).sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return (b.lastPurchasedAt || '').localeCompare(a.lastPurchasedAt || '');
              })[0] || {
                variantDetails: null,
                quantity: 1,
                unitPrice: Number(item.price) || 0,
                variantKey: 'default',
              };

              return {
                menu_item_id: entry.menu_item_id,
                purchase_count: entry.purchase_count,
                menu_items: item,
                preferred_variant_details: preferredSelection?.variantDetails || null,
                preferred_quantity: normalizeQuantity(preferredSelection?.quantity),
                preferred_unit_price: Number(preferredSelection?.unitPrice) || Number(item.price) || 0,
                preferred_variant_key: preferredSelection?.variantKey || 'default',
              };
            })
            .filter(Boolean);
        }
      } else if (orderItemsError && orderItemsError.code !== 'PGRST116') {
        console.error('[CustomerDashboard] Error fetching order history items:', orderItemsError.message);
      }

      // Fallback to customer_item_purchases if order_items history is unavailable
      if (mostPurchasedItems.length === 0) {
        const { data: purchasesData, error: purchasesError } = await supabase
          .from('customer_item_purchases')
          .select(`
            menu_item_id,
            purchase_count,
            menu_items (id, name, price, image_url, category, has_variants)
          `)
          .eq('customer_id', userId)
          .order('purchase_count', { ascending: false });

        if (purchasesError) {
          if (purchasesError.code !== 'PGRST116') {
            console.error('[CustomerDashboard] Error fetching purchase history:', purchasesError.message);
          }
        } else if (purchasesData) {
          mostPurchasedItems = purchasesData.map((purchase) => ({
            ...purchase,
            preferred_variant_details: null,
            preferred_quantity: 1,
            preferred_unit_price: Number(purchase?.menu_items?.price) || 0,
            preferred_variant_key: 'default',
          }));
        }
      }

      // Get count of published reviews
      const { count: reviewsCount, error: reviewsError } = await supabase
        .from('customer_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');

      let publishedReviewsCount = 0;
      if (reviewsError) {
        if (reviewsError.code !== 'PGRST116') {
          console.error('[CustomerDashboard] Error fetching reviews count:', reviewsError.message);
        }
      } else {
        publishedReviewsCount = reviewsCount || 0;
      }

      setDashboardData({
        loyaltyBalance,
        currentOrder: currentOrderData,
        totalEarnings,
        mostPurchasedItems,
        pendingOrdersCount: pendingCount || 0,
        publishedReviewsCount
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

  const handleAddToCart = (purchase) => {
    const item = purchase?.menu_items;
    if (!item?.id) return;

    const preferredQuantity = normalizeQuantity(purchase?.preferred_quantity);
    const preferredVariantDetails =
      purchase?.preferred_variant_details && typeof purchase.preferred_variant_details === 'object'
        ? purchase.preferred_variant_details
        : null;
    const preferredUnitPrice = Number(purchase?.preferred_unit_price) || Number(item.price) || 0;
    const preferredVariantKey = purchase?.preferred_variant_key || generateVariantKey(preferredVariantDetails);

    localStorage.setItem(
      'pendingCartItem',
      JSON.stringify({
        ...item,
        cartKey: `${item.id}|${HISTORY_CART_KEY_PREFIX}|${preferredVariantKey}`,
        variantDetails: preferredVariantDetails,
        finalPrice: preferredUnitPrice,
        quantity: preferredQuantity,
      })
    );
    router.push('/customer/order').catch(console.error);
  };

  const getStatusDisplay = (status, orderMode) => {
    const isPickup = orderMode === 'pick-up';
    const statusMap = {
      'order_in_queue': { label: 'Order in Queue', color: '#ffc107', icon: '🕐' },
      'proceed_to_cashier': { label: 'Proceed to the Cashier', color: '#ff9800', icon: '💳' },
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

          {isSundayInManila() && (
            <div style={styles.closedBanner}>
              <strong>Sunday closure:</strong> {SUNDAY_CLOSURE_MESSAGE}
            </div>
          )}
          
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

            {/* Biter's Review */}
            <Link href="/customer/biters-reviews" style={{...styles.actionCard, textDecoration: 'none'}}>
              <span style={styles.cardIcon}>⭐</span>
              <h3 style={styles.cardTitle}>Biter's Review</h3>
              <p style={{...styles.cardDesc, fontSize: '20px', fontWeight: 'bold', color: '#ffc107'}}>
                {dashboardData.publishedReviewsCount}
              </p>
              <p style={{...styles.cardDesc, fontSize: '12px'}}>
                {dashboardData.publishedReviewsCount === 1 ? 'Published review' : 'Published reviews'}
              </p>
            </Link>
          </div>

          {/* Most Purchased Items */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>🔥 Most Purchased Items</h3>
              <select
                value={purchaseSortOrder}
                onChange={(event) => setPurchaseSortOrder(event.target.value)}
                style={styles.purchaseSortSelect}
              >
                <option value="most">Most Purchased to Least Purchased</option>
                <option value="least">Least Purchased to Most Purchased</option>
              </select>
            </div>
            {dashboardData.mostPurchasedItems.length > 0 ? (
              <div style={styles.itemsGrid}>
                {sortedMostPurchasedItems.map((purchase) => {
                  const item = purchase.menu_items;
                  const quantity = normalizeQuantity(purchase.preferred_quantity);
                  return (
                    <button
                      key={purchase.menu_item_id}
                      style={{
                        ...styles.itemCard,
                        ...(focusedCardId === purchase.menu_item_id ? styles.itemCardFocused : {})
                      }}
                      type="button"
                      aria-label={`Add ${quantity} ${item?.name || 'item'} to cart`}
                      onClick={() => handleAddToCart(purchase)}
                      onFocus={() => setFocusedCardId(purchase.menu_item_id)}
                      onBlur={() => setFocusedCardId(null)}
                    >
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
                      <div style={styles.addToCartBtn}>
                        🛒 Add {quantity} to Cart
                      </div>
                    </button>
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

        {showSundayReminder && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <h3 style={styles.modalTitle}>Sunday Closure Notice</h3>
              <p style={styles.modalText}>{SUNDAY_CLOSURE_MESSAGE}</p>
              <button style={styles.modalButton} onClick={() => setShowSundayReminder(false)}>
                OK
              </button>
            </div>
          </div>
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
  closedBanner: {
    marginBottom: '24px',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid #ff9800',
    backgroundColor: 'rgba(255, 152, 0, 0.14)',
    color: '#ffd180',
    fontSize: '14px',
    lineHeight: 1.5,
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
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '24px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  purchaseSortSelect: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    fontFamily: "'Poppins', sans-serif",
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
    color: '#fff',
    width: '100%',
    cursor: 'pointer',
  },
  itemCardFocused: {
    boxShadow: '0 0 0 2px #ffc107',
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
  sectionSubtitle: {
    fontSize: '14px',
    color: '#999',
    marginTop: '-16px',
    marginBottom: '24px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
  },
  modalCard: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 15px 50px rgba(255, 193, 7, 0.15)',
  },
  modalTitle: {
    margin: '0 0 12px',
    color: '#ffc107',
    fontSize: '24px',
    fontFamily: "'Playfair Display', serif",
  },
  modalText: {
    margin: '0 0 20px',
    color: '#f5f5f5',
    fontSize: '14px',
    lineHeight: 1.6,
  },
  modalButton: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#ffc107',
    color: '#1a1a1a',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
  },
};
