import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import NotificationBell from '../../components/NotificationBell';

export default function CashierDashboard() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalSales: 0,
    cashSales: 0,
    gcashSales: 0,
    pointsSales: 0,
    receiptCount: 0,
    dineInCount: 0,
    takeOutCount: 0,
    pickUpCount: 0,
    deliveryCount: 0,
  });
  const [showReceiptBreakdown, setShowReceiptBreakdown] = useState(false);
  const [pendingOnlineOrders, setPendingOnlineOrders] = useState([]);
  const [selectedTab, setSelectedTab] = useState('all'); // 'all', 'delivery', 'pick-up'

  useEffect(() => {
    if (!authLoading) {
      initializePage();
    }
  }, [authLoading]);

  const initializePage = async () => {
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
      }
      fetchDashboardStats();
      fetchPendingOnlineOrders();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('dashboard_orders_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchDashboardStats();
          fetchPendingOnlineOrders();
        })
        .subscribe();
      
      return () => {
        subscription?.unsubscribe();
      };
    } catch (err) {
      console.error('[CashierDashboard] Failed to initialize:', err?.message ?? err);
    }
  };

  const fetchDashboardStats = async () => {
    if (!supabase) return;

    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch orders for today
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (error) throw error;

      if (orders && orders.length > 0) {
        let totalSales = 0;
        let cashSales = 0;
        let gcashSales = 0;
        let pointsSales = 0;
        let dineInCount = 0;
        let takeOutCount = 0;
        let pickUpCount = 0;
        let deliveryCount = 0;

        orders.forEach(order => {
          totalSales += parseFloat(order.total_amount || 0);
          
          // Payment method breakdown
          if (order.payment_method === 'cash' || order.cash_amount > 0) {
            cashSales += parseFloat(order.cash_amount || order.total_amount || 0);
          }
          if (order.payment_method === 'gcash' || order.gcash_amount > 0) {
            gcashSales += parseFloat(order.gcash_amount || 0);
          }
          if (order.points_used > 0) {
            pointsSales += parseFloat(order.points_used || 0);
          }

          // Order mode breakdown
          const orderMode = order.order_mode || '';
          if (orderMode === 'dine-in') dineInCount++;
          else if (orderMode === 'take-out') takeOutCount++;
          else if (orderMode === 'pick-up') pickUpCount++;
          else if (orderMode === 'delivery') deliveryCount++;
        });

        setStats({
          totalSales,
          cashSales,
          gcashSales,
          pointsSales,
          receiptCount: orders.length,
          dineInCount,
          takeOutCount,
          pickUpCount,
          deliveryCount,
        });
      }
    } catch (err) {
      console.error('[CashierDashboard] Failed to fetch stats:', err?.message ?? err);
    }
  };
  
  const fetchPendingOnlineOrders = async () => {
    if (!supabase) return;
    
    try {
      // Fetch orders that are online (delivery or pick-up) and in queue status
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .in('order_mode', ['delivery', 'pick-up'])
        .eq('status', 'order_in_queue')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      setPendingOnlineOrders(orders || []);
    } catch (err) {
      console.error('[CashierDashboard] Failed to fetch pending online orders:', err?.message ?? err);
    }
  };
  
  const handleAcceptOrder = async (orderId) => {
    if (!supabase) return;
    if (!confirm('Accept this order? This will create a sales invoice and kitchen order slips.')) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cashierId = session?.user?.id || null;
      
      // Update order status and set accepted_at timestamp
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'order_in_process',
          accepted_at: new Date().toISOString(),
          cashier_id: cashierId,
        })
        .eq('id', orderId);
      
      if (error) throw error;
      
      alert('Order accepted! Status updated to "Order in Process".');
      
      // Refresh data
      fetchPendingOnlineOrders();
      fetchDashboardStats();
    } catch (err) {
      console.error('[CashierDashboard] Failed to accept order:', err?.message ?? err);
      alert('Failed to accept order. Please try again.');
    }
  };

  if (authLoading) {
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
        <title>Cashier Dashboard - Bite Bonansa Cafe</title>
        <meta name="description" content="Cashier dashboard and POS management" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLinkActive}>Dashboard</Link>
            <Link href="/cashier/pos" style={styles.navLink}>POS</Link>
            <Link href="/cashier/orders-queue" style={styles.navLink}>Order Queue</Link>
            <Link href="/cashier/eod-report" style={styles.navLink}>EOD Report</Link>
            <Link href="/cashier/settings" style={styles.navLink}>Settings</Link>
            <Link href="/cashier/profile" style={styles.navLink}>Profile</Link>
          </nav>
          <div style={styles.headerActions}>
            {user && <NotificationBell user={user} />}
            <button style={styles.logoutBtn} onClick={async () => {
              if (supabase) await supabase.auth.signOut();
              router.replace('/login');
            }}>
              Logout
            </button>
          </div>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>💰 Cashier Dashboard</h2>

          {/* Sales Stats Grid */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statIcon}>💵</div>
              <div style={styles.statValue}>₱{stats.totalSales.toFixed(2)}</div>
              <div style={styles.statLabel}>Total Sales Today</div>
              <div style={styles.statSubtext}>All payment methods</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIcon}>💰</div>
              <div style={styles.statValue}>₱{stats.cashSales.toFixed(2)}</div>
              <div style={styles.statLabel}>Cash Sales</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIcon}>📱</div>
              <div style={styles.statValue}>₱{stats.gcashSales.toFixed(2)}</div>
              <div style={styles.statLabel}>GCash Sales</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statIcon}>🎁</div>
              <div style={styles.statValue}>₱{stats.pointsSales.toFixed(2)}</div>
              <div style={styles.statLabel}>Points Redeemed</div>
            </div>

            <div 
              style={{ ...styles.statCard, ...styles.statCardClickable }}
              onClick={() => setShowReceiptBreakdown(!showReceiptBreakdown)}
            >
              <div style={styles.statIcon}>🧾</div>
              <div style={styles.statValue}>{stats.receiptCount}</div>
              <div style={styles.statLabel}>Total Receipts</div>
              <div style={styles.statHint}>💡 Click for breakdown</div>
            </div>
          </div>

          {/* Receipt Breakdown Modal */}
          {showReceiptBreakdown && (
            <div style={styles.modal} onClick={() => setShowReceiptBreakdown(false)}>
              <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.modalTitle}>Receipt Breakdown by Order Type</h3>
                <div style={styles.breakdownGrid}>
                  <div style={styles.breakdownItem}>
                    <span style={styles.breakdownLabel}>🍽️ Dine-in:</span>
                    <span style={styles.breakdownValue}>{stats.dineInCount}</span>
                  </div>
                  <div style={styles.breakdownItem}>
                    <span style={styles.breakdownLabel}>🥡 Take-out:</span>
                    <span style={styles.breakdownValue}>{stats.takeOutCount}</span>
                  </div>
                  <div style={styles.breakdownItem}>
                    <span style={styles.breakdownLabel}>📦 Pick-up:</span>
                    <span style={styles.breakdownValue}>{stats.pickUpCount}</span>
                  </div>
                  <div style={styles.breakdownItem}>
                    <span style={styles.breakdownLabel}>🚚 Delivery:</span>
                    <span style={styles.breakdownValue}>{stats.deliveryCount}</span>
                  </div>
                </div>
                <button style={styles.modalCloseBtn} onClick={() => setShowReceiptBreakdown(false)}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div style={styles.actionsSection}>
            <h3 style={styles.sectionTitle}>Quick Actions</h3>
            <div style={styles.actionsGrid}>
              <Link href="/cashier/pos" style={styles.actionCard}>
                <div style={styles.actionIcon}>🛒</div>
                <h4 style={styles.actionTitle}>Take an Order</h4>
                <p style={styles.actionDesc}>Open POS to create new order</p>
              </Link>

              <Link href="/cashier/cash-drawer" style={styles.actionCard}>
                <div style={styles.actionIcon}>💸</div>
                <h4 style={styles.actionTitle}>Cash Drawer</h4>
                <p style={styles.actionDesc}>Cash in/out, expenses, adjustments</p>
              </Link>

              <Link href="/cashier/orders-queue" style={styles.actionCard}>
                <div style={styles.actionIcon}>📋</div>
                <h4 style={styles.actionTitle}>Order Queue</h4>
                <p style={styles.actionDesc}>Manage pending orders</p>
              </Link>

              <Link href="/cashier/eod-report" style={styles.actionCard}>
                <div style={styles.actionIcon}>📊</div>
                <h4 style={styles.actionTitle}>End of Day Report</h4>
                <p style={styles.actionDesc}>View daily sales report</p>
              </Link>
            </div>
          </div>
          
          {/* Pending Online Orders Section */}
          <div style={styles.onlineOrdersSection}>
            <h3 style={styles.sectionTitle}>
              📱 Pending Online Orders ({pendingOnlineOrders.length})
            </h3>
            
            {/* Order Type Tabs */}
            <div style={styles.orderTabs}>
              <button
                style={selectedTab === 'all' ? styles.orderTabActive : styles.orderTab}
                onClick={() => setSelectedTab('all')}
              >
                All ({pendingOnlineOrders.length})
              </button>
              <button
                style={selectedTab === 'delivery' ? styles.orderTabActive : styles.orderTab}
                onClick={() => setSelectedTab('delivery')}
              >
                🚚 Delivery ({pendingOnlineOrders.filter(o => o.order_mode === 'delivery').length})
              </button>
              <button
                style={selectedTab === 'pick-up' ? styles.orderTabActive : styles.orderTab}
                onClick={() => setSelectedTab('pick-up')}
              >
                📦 Pick-up ({pendingOnlineOrders.filter(o => o.order_mode === 'pick-up').length})
              </button>
            </div>
            
            {/* Orders List */}
            {pendingOnlineOrders.length === 0 ? (
              <div style={styles.emptyOrders}>
                <p style={styles.emptyIcon}>📭</p>
                <p style={styles.emptyText}>No pending online orders</p>
              </div>
            ) : (
              <div style={styles.ordersList}>
                {pendingOnlineOrders
                  .filter(order => selectedTab === 'all' || order.order_mode === selectedTab)
                  .map((order) => (
                    <div key={order.id} style={styles.orderCard}>
                      <div style={styles.orderHeader}>
                        <div>
                          <h4 style={styles.orderNumber}>
                            Order #{order.order_number || order.id.slice(0, 8)}
                          </h4>
                          <p style={styles.orderTime}>
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                          <p style={styles.customerName}>
                            👤 {order.customer_name || 'Customer'}
                          </p>
                        </div>
                        <div style={styles.orderBadge}>
                          {order.order_mode === 'delivery' ? '🚚 Delivery' : '📦 Pick-up'}
                        </div>
                      </div>
                      
                      <div style={styles.orderItems}>
                        {order.items && order.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} style={styles.orderItem}>
                            <span>{item.name} x{item.quantity}</span>
                            <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                        {order.items && order.items.length > 3 && (
                          <p style={styles.moreItems}>
                            +{order.items.length - 3} more item(s)
                          </p>
                        )}
                      </div>
                      
                      {order.order_mode === 'delivery' && order.delivery_address && (
                        <div style={styles.deliveryInfo}>
                          <strong>📍 Delivery Address:</strong>
                          <p style={styles.address}>{order.delivery_address}</p>
                        </div>
                      )}
                      
                      <div style={styles.orderFooter}>
                        <div style={styles.orderTotal}>
                          Total: ₱{parseFloat(order.total_amount || 0).toFixed(2)}
                        </div>
                        <button
                          style={styles.acceptBtn}
                          onClick={() => handleAcceptOrder(order.id)}
                        >
                          ✓ Accept Order
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
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
    gap: '24px',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    gap: '16px',
    flex: 1,
    justifyContent: 'center',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '8px 12px',
    borderRadius: '6px',
    transition: 'all 0.2s',
  },
  navLinkActive: {
    color: '#ffc107',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    border: '1px solid #ffc107',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
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
    whiteSpace: 'nowrap',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '48px',
  },
  statCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
  },
  statCardClickable: {
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  statIcon: {
    fontSize: '36px',
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
    marginBottom: '4px',
  },
  statSubtext: {
    fontSize: '12px',
    color: '#888',
  },
  statHint: {
    fontSize: '11px',
    color: '#888',
    marginTop: '8px',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #ffc107',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
  },
  modalTitle: {
    fontSize: '20px',
    color: '#ffc107',
    marginBottom: '24px',
    textAlign: 'center',
  },
  breakdownGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  breakdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
  },
  breakdownLabel: {
    fontSize: '16px',
    color: '#ccc',
  },
  breakdownValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffc107',
  },
  modalCloseBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  onlineOrdersSection: {
    marginTop: '32px',
  },
  orderTabs: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '2px solid #2a2a2a',
    paddingBottom: '12px',
  },
  orderTab: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#aaa',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  orderTabActive: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: 'none',
    borderBottom: '2px solid #ffc107',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  emptyOrders: {
    textAlign: 'center',
    padding: '48px 24px',
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyText: {
    color: '#888',
    fontSize: '16px',
  },
  ordersList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
    transition: 'transform 0.2s',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #2a2a2a',
  },
  orderNumber: {
    fontSize: '16px',
    color: '#ffc107',
    margin: '0 0 6px 0',
    fontWeight: '700',
  },
  orderTime: {
    fontSize: '12px',
    color: '#888',
    margin: '0 0 6px 0',
  },
  customerName: {
    fontSize: '13px',
    color: '#ccc',
    margin: 0,
  },
  orderBadge: {
    padding: '6px 12px',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    border: '1px solid rgba(255, 193, 7, 0.3)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#ffc107',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  orderItems: {
    marginBottom: '16px',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: '13px',
    color: '#ccc',
  },
  moreItems: {
    fontSize: '12px',
    color: '#888',
    fontStyle: 'italic',
    margin: '8px 0 0 0',
  },
  deliveryInfo: {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#ccc',
  },
  address: {
    margin: '6px 0 0 0',
    fontSize: '13px',
    color: '#fff',
  },
  orderFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid #2a2a2a',
  },
  orderTotal: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffc107',
  },
  acceptBtn: {
    padding: '10px 20px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  actionsSection: {
    marginTop: '48px',
  },
  sectionTitle: {
    fontSize: '20px',
    color: '#ffc107',
    marginBottom: '20px',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
  },
  actionCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    textDecoration: 'none',
    color: '#fff',
    textAlign: 'center',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  actionIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  actionTitle: {
    fontSize: '18px',
    color: '#ffc107',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  actionDesc: {
    fontSize: '13px',
    color: '#ccc',
    margin: 0,
  },
};
