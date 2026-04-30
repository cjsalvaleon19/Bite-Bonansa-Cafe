import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import NotificationBell from '../../components/NotificationBell';
import { calculateSalesBreakdown, getGCashAmount } from '../../utils/salesCalculations';

// Constants
const NOTIFICATION_AUDIO_VOLUME = 0.5;
const STATS_REFRESH_DEBOUNCE_MS = 2000; // Debounce stats refresh by 2 seconds

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
  const [showGCashReport, setShowGCashReport] = useState(false);
  const [gcashTransactions, setGCashTransactions] = useState([]);
  const [gcashAdjustments, setGCashAdjustments] = useState([]);
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' or 'pending'
  const [pendingOrders, setPendingOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selectedOrderForRider, setSelectedOrderForRider] = useState(null);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const [notificationAudio, setNotificationAudio] = useState(null);
  const [showPrintReceiptModal, setShowPrintReceiptModal] = useState(false);
  const [acceptedOrder, setAcceptedOrder] = useState(null);
  const statsRefreshTimerRef = useRef(null);

  useEffect(() => {
    if (!authLoading) {
      initializePage();
    }
  }, [authLoading]);

  // Set up real-time subscription for new orders (always active for notifications and stats)
  useEffect(() => {
    if (!authLoading) {
      // Debounced stats refresh function
      const debouncedStatsRefresh = () => {
        // Clear any existing timer
        if (statsRefreshTimerRef.current) {
          clearTimeout(statsRefreshTimerRef.current);
        }
        // Set a new timer to refresh stats after debounce period
        statsRefreshTimerRef.current = setTimeout(() => {
          fetchDashboardStats();
        }, STATS_REFRESH_DEBOUNCE_MS);
      };

      // Set up real-time subscription for all new orders
      const subscription = supabase
        ?.channel('cashier_dashboard_changes')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'orders'
        }, (payload) => {
          // New order detected
          const newOrder = payload.new;
          console.log('[CashierDashboard] New order received:', newOrder);
          
          // Update stats in real-time with debouncing to avoid excessive queries
          debouncedStatsRefresh();
          
          // Handle online order notifications
          if (newOrder.status === 'pending' && (newOrder.order_mode === 'delivery' || newOrder.order_mode === 'pick-up')) {
            setHasNewOrders(true);
            // Play notification sound
            if (notificationAudio) {
              notificationAudio.play().catch(err => console.log('Audio play failed:', err));
            }
            // Show browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Online Order!', {
                body: `Order #${newOrder.order_number || newOrder.id.slice(0, 8)} - ${newOrder.order_mode}`,
                icon: '/favicon.ico',
                tag: `order-${newOrder.id}`,
              });
            } else {
              console.log('[CashierDashboard] Browser notifications not available or not permitted');
            }
          }
          // Fetch pending orders if on that tab
          if (activeTab === 'pending') {
            fetchPendingOnlineOrders();
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
          if (activeTab === 'pending') {
            fetchPendingOnlineOrders();
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => {
          if (activeTab === 'pending') {
            fetchPendingOnlineOrders();
          }
        })
        .subscribe();

      return () => {
        subscription?.unsubscribe();
        // Clear timer on cleanup
        if (statsRefreshTimerRef.current) {
          clearTimeout(statsRefreshTimerRef.current);
        }
      };
    }
  }, [authLoading, notificationAudio, activeTab]);

  // Fetch pending orders when switching to pending tab
  useEffect(() => {
    if (!authLoading && activeTab === 'pending') {
      fetchPendingOnlineOrders();
      fetchRiders();
    }
  }, [authLoading, activeTab, notificationAudio]);

  // Initialize notification audio on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      // Create audio element for notification sound (optional - will fail gracefully if file doesn't exist)
      const audio = new Audio('/notification.mp3');
      audio.volume = NOTIFICATION_AUDIO_VOLUME;
      setNotificationAudio(audio);
    }
  }, []);

  const initializePage = async () => {
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
      }
      fetchDashboardStats();
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
        let dineInCount = 0;
        let takeOutCount = 0;
        let pickUpCount = 0;
        let deliveryCount = 0;

        // Use utility function for sales calculations
        const { totalSales, cashSales, gcashSales, pointsSales } = calculateSalesBreakdown(orders);

        orders.forEach(order => {
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
      // Fetch pending online orders (delivery or pick-up, status: pending)
      const { data: orders, error } = await supabase
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
            notes,
            variant_details
          ),
          users:customer_id (
            customer_id
          )
        `)
        .in('order_mode', ['delivery', 'pick-up'])
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPendingOrders(orders || []);
    } catch (err) {
      console.error('[CashierDashboard] Failed to fetch pending orders:', err?.message ?? err);
    }
  };

  const fetchRiders = async () => {
    if (!supabase) return;

    try {
      // Fetch available riders
      const { data: ridersData, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'rider')
        .order('full_name');

      if (error) throw error;

      setRiders(ridersData || []);
    } catch (err) {
      console.error('[CashierDashboard] Failed to fetch riders:', err?.message ?? err);
    }
  };

  const fetchGCashTransactions = async () => {
    if (!supabase) return;

    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch all GCash orders for today
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .or('payment_method.eq.gcash,payment_method.eq.points+gcash')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      setGCashTransactions(orders || []);

      // Fetch payment adjustments (cash-to-gcash conversions) with cashier info
      const { data: adjustments, error: adjustmentsError } = await supabase
        .from('cash_drawer_transactions')
        .select(`
          *,
          users:cashier_id (
            full_name,
            email
          )
        `)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .eq('transaction_type', 'adjustment')
        .eq('payment_adjustment_type', 'cash-to-gcash')
        .order('created_at', { ascending: false });

      if (adjustmentsError) throw adjustmentsError;

      setGCashAdjustments(adjustments || []);
    } catch (err) {
      console.error('[CashierDashboard] Failed to fetch GCash transactions:', err?.message ?? err);
    }
  };

  const printReceipt = (order, receiptType = 'sales') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print receipts');
      return;
    }

    const items = order.order_items && order.order_items.length > 0 ? order.order_items : order.items || [];
    
    // Build items HTML with variant details
    const itemsHtml = items.map(item => {
      const itemPrice = (item.price || 0) * (item.quantity || 0);
      let variantDetailsHtml = '';
      
      // Check if variant_details exists and has content
      if (item.variant_details && typeof item.variant_details === 'object' && Object.keys(item.variant_details).length > 0) {
        const variantEntries = Object.entries(item.variant_details)
          .map(([type, value]) => `${type}: ${value}`)
          .join(', ');
        variantDetailsHtml = `
          <tr>
            <td colspan="3" style="padding: 2px 0 4px 15px; font-size: 10px; color: #666; border-bottom: 1px dashed #ccc;">
              (${variantEntries})
            </td>
          </tr>
        `;
      }
      
      return `
        <tr>
          <td style="padding: 4px 0; ${!variantDetailsHtml ? 'border-bottom: 1px dashed #ccc;' : ''}">${item.name}</td>
          <td style="padding: 4px 8px; text-align: center; ${!variantDetailsHtml ? 'border-bottom: 1px dashed #ccc;' : ''}">x${item.quantity}</td>
          <td style="padding: 4px 0; text-align: right; ${!variantDetailsHtml ? 'border-bottom: 1px dashed #ccc;' : ''}">₱${itemPrice.toFixed(2)}</td>
        </tr>
        ${variantDetailsHtml}
      `;
    }).join('');

    const isKitchenCopy = receiptType === 'kitchen';
    const title = isKitchenCopy ? 'KITCHEN ORDER SLIP' : 'SALES INVOICE';
    
    // Calculate values based on the new flow
    const subtotal = order.subtotal || 0;
    const deliveryFee = order.delivery_fee || 0;
    const total = subtotal + deliveryFee;
    const pointsClaimed = order.points_used || 0;
    const netAmount = total - pointsClaimed;
    const amountTendered = order.cash_amount || 0;
    const change = Math.max(0, amountTendered - netAmount);
    
    // Get customer loyalty ID
    const customerLoyaltyId = order.users && order.users.customer_id ? order.users.customer_id : 'N/A';
    
    // Determine display payment method based on points usage
    let displayPaymentMethod = order.payment_method || 'N/A';
    if (pointsClaimed > 0) {
      if (pointsClaimed >= total) {
        // Fully paid by points
        displayPaymentMethod = 'Points';
      } else {
        // Partial payment with points - show the secondary payment method
        // Extract secondary method from payment_method field (e.g., "points+cash" -> "cash")
        if (order.payment_method && order.payment_method.includes('points+')) {
          displayPaymentMethod = order.payment_method.split('points+')[1];
        } else if (order.payment_method && order.payment_method.includes('+')) {
          // Handle other formats like "cash+points" -> extract non-points part
          const parts = order.payment_method.split('+');
          displayPaymentMethod = parts.find(p => p !== 'points') || order.payment_method;
        }
      }
    }
    
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Order #${order.order_number || order.id.slice(0, 8)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            padding: 20px; 
            max-width: 350px;
            margin: 0 auto;
          }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { font-size: 20px; margin-bottom: 5px; }
          .header p { font-size: 12px; }
          .section { margin: 15px 0; }
          .section-title { font-weight: bold; margin-bottom: 8px; font-size: 14px; text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; }
          .total-row { font-weight: bold; font-size: 14px; }
          .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 2px solid #000; font-size: 12px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>☕ Bite Bonansa Cafe</h1>
          <p>123 Main Street, City</p>
          <p>Tel: (123) 456-7890</p>
          <p style="margin-top: 10px; font-size: 16px; font-weight: bold;">${title}</p>
        </div>

        <div class="section">
          <p><strong>Order Number:</strong> ${order.order_number || order.id.slice(0, 8)}</p>
          <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
          <p><strong>Order Type:</strong> ${order.order_mode || 'N/A'}</p>
          ${order.customer_name ? `<p><strong>Customer:</strong> ${order.customer_name}</p>` : ''}
          ${customerLoyaltyId !== 'N/A' ? `<p><strong>Customer ID:</strong> ${customerLoyaltyId}</p>` : ''}
          ${order.delivery_address && order.order_mode === 'delivery' ? `<p><strong>Delivery Address:</strong> ${order.delivery_address}</p>` : ''}
          ${order.contact_number ? `<p><strong>Contact Number:</strong> ${order.contact_number}</p>` : ''}
        </div>

        <div class="section">
          <p class="section-title">ITEMS ORDERED</p>
          <table>
            <thead>
              <tr>
                <th style="text-align: left; padding: 4px 0; border-bottom: 2px solid #000;">Item</th>
                <th style="text-align: center; padding: 4px 8px; border-bottom: 2px solid #000;">Qty</th>
                <th style="text-align: right; padding: 4px 0; border-bottom: 2px solid #000;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        ${!isKitchenCopy ? `
        <div class="section">
          <table>
            <tr>
              <td style="padding: 4px 0;"><strong>Subtotal:</strong></td>
              <td style="text-align: right;">₱${subtotal.toFixed(2)}</td>
            </tr>
            ${deliveryFee > 0 ? `
            <tr>
              <td style="padding: 4px 0;"><strong>Delivery Fee:</strong></td>
              <td style="text-align: right;">₱${deliveryFee.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td style="padding: 4px 0; border-top: 2px solid #000;"><strong>Total:</strong></td>
              <td style="text-align: right; border-top: 2px solid #000;">₱${total.toFixed(2)}</td>
            </tr>
            ${pointsClaimed > 0 ? `
            <tr>
              <td style="padding: 4px 0;"><strong>Points Claimed:</strong></td>
              <td style="text-align: right;">-₱${pointsClaimed.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td style="padding: 4px 0; border-top: 1px solid #000;"><strong>Net Amount:</strong></td>
              <td style="text-align: right; border-top: 1px solid #000;">₱${netAmount.toFixed(2)}</td>
            </tr>
            ${amountTendered > 0 ? `
            <tr>
              <td style="padding: 4px 0;"><strong>Cash Tendered:</strong></td>
              <td style="text-align: right;">₱${amountTendered.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Change:</strong></td>
              <td style="text-align: right;">₱${change.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0 4px 0; border-top: 1px dashed #000;"><strong>Payment Method:</strong></td>
              <td style="text-align: right; padding-top: 8px; border-top: 1px dashed #000;">${displayPaymentMethod}</td>
            </tr>
          </table>
        </div>
        ` : ''}

        ${order.special_request ? `
        <div class="section">
          <p class="section-title">SPECIAL INSTRUCTIONS</p>
          <p style="font-size: 12px;">${order.special_request}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for your order, Biter!</p>
          ${isKitchenCopy ? '<p style="margin-top: 10px; font-weight: bold;">⚠️ KITCHEN COPY - DO NOT GIVE TO CUSTOMER ⚠️</p>' : ''}
          <p style="margin-top: 10px;">Accepted by: ${user?.full_name || 'Cashier'}</p>
          <p>${new Date().toLocaleString()}</p>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #ffc107; border: none; border-radius: 4px;">
            Print Receipt
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; margin-left: 10px; background: #666; color: white; border: none; border-radius: 4px;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    
    // Auto print after a short delay
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleAcceptOrder = async (orderId) => {
    if (!supabase) return;
    if (!confirm('Accept this order and start processing?')) return;

    try {
      // Update order status to 'order_in_process' and set accepted_at timestamp
      // Note: Database trigger will automatically create notification for customer
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'order_in_process',
          accepted_at: new Date().toISOString(),
          cashier_id: user?.id
        })
        .eq('id', orderId);

      if (error) throw error;

      // Get the full order details for printing
      const order = pendingOrders.find(o => o.id === orderId);
      if (order) {
        // Show print receipt confirmation modal
        setAcceptedOrder(order);
        setShowPrintReceiptModal(true);
        
        // Generate sales invoice receipt
        printReceipt(order, 'sales');
        
        // Generate kitchen order slip after a short delay
        setTimeout(() => {
          printReceipt(order, 'kitchen');
        }, 500);
      }

      fetchPendingOnlineOrders();
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

          {/* Dashboard Tabs */}
          <div style={styles.tabContainer}>
            <button
              style={activeTab === 'stats' ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab('stats')}
            >
              📊 Today's Stats
            </button>
            <button
              style={activeTab === 'pending' ? styles.tabActive : styles.tab}
              onClick={() => {
                setActiveTab('pending');
                setHasNewOrders(false); // Clear notification when tab is clicked
              }}
            >
              📦 Pending Online Orders
              {pendingOrders.length > 0 && (
                <span style={hasNewOrders ? styles.tabBadgeNew : styles.tabBadge}>{pendingOrders.length}</span>
              )}
            </button>
          </div>

          {/* Stats Tab Content */}
          {activeTab === 'stats' && (
            <>
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

            <div 
              style={{ ...styles.statCard, ...styles.statCardClickable }}
              onClick={async () => {
                try {
                  await fetchGCashTransactions();
                  setShowGCashReport(true);
                } catch (err) {
                  console.error('[Dashboard] Failed to load GCash report:', err);
                  alert('Failed to load GCash report. Please try again.');
                }
              }}
            >
              <div style={styles.statIcon}>📱</div>
              <div style={styles.statValue}>₱{stats.gcashSales.toFixed(2)}</div>
              <div style={styles.statLabel}>GCash Sales</div>
              <div style={styles.statHint}>💡 Click for audit report</div>
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

          {/* GCash Sales Report Modal */}
          {showGCashReport && (
            <div style={styles.modal} onClick={() => setShowGCashReport(false)}>
              <div style={{ ...styles.modalContent, ...styles.gcashModalContent }} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.modalTitle}>📱 GCash Sales Audit Report</h3>
                <p style={styles.modalSubtitle}>Today's GCash Transactions for Reconciliation</p>
                
                {/* GCash Transactions Table */}
                <div style={styles.reportSection}>
                  <h4 style={styles.reportSectionTitle}>GCash Sales Transactions</h4>
                  {gcashTransactions.length === 0 ? (
                    <p style={styles.emptyText}>No GCash transactions for today</p>
                  ) : (
                    <div style={styles.tableContainer}>
                      <table style={styles.reportTable}>
                        <thead>
                          <tr style={styles.reportTableHeader}>
                            <th style={styles.reportTh}>Order #</th>
                            <th style={styles.reportTh}>Time</th>
                            <th style={styles.reportTh}>Customer</th>
                            <th style={styles.reportTh}>Reference</th>
                            <th style={styles.reportTh}>Amount</th>
                            <th style={styles.reportTh}>Points</th>
                            <th style={styles.reportTh}>GCash Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gcashTransactions.map((order) => (
                            <tr key={order.id} style={styles.reportTableRow}>
                              <td style={styles.reportTd}>{order.order_number || order.id.slice(0, 8)}</td>
                              <td style={styles.reportTd}>{new Date(order.created_at).toLocaleTimeString()}</td>
                              <td style={styles.reportTd}>{order.customer_name || 'N/A'}</td>
                              <td style={styles.reportTd}>
                                {order.gcash_reference || 'N/A'}
                              </td>
                              <td style={styles.reportTd}>₱{parseFloat(order.total_amount || 0).toFixed(2)}</td>
                              <td style={styles.reportTd}>₱{parseFloat(order.points_used || 0).toFixed(2)}</td>
                              <td style={styles.reportTdHighlight}>₱{getGCashAmount(order).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr style={styles.reportTotalRow}>
                            <td colSpan="6" style={styles.reportTotalLabel}>Total GCash Sales:</td>
                            <td style={styles.reportTotalValue}>
                              ₱{gcashTransactions.reduce((sum, order) => sum + getGCashAmount(order), 0).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Adjustments Section */}
                <div style={styles.reportSection}>
                  <h4 style={styles.reportSectionTitle}>Adjustments</h4>
                  <p style={styles.reportSectionDesc}>Payment method conversions from Cash to GCash</p>
                  {gcashAdjustments.length === 0 ? (
                    <p style={styles.emptyText}>No adjustments for today</p>
                  ) : (
                    <div style={styles.tableContainer}>
                      <table style={styles.reportTable}>
                        <thead>
                          <tr style={styles.reportTableHeader}>
                            <th style={styles.reportTh}>Time</th>
                            <th style={styles.reportTh}>Cashier</th>
                            <th style={styles.reportTh}>Description</th>
                            <th style={styles.reportTh}>Reference</th>
                            <th style={styles.reportTh}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gcashAdjustments.map((adj) => (
                            <tr key={adj.id} style={styles.reportTableRow}>
                              <td style={styles.reportTd}>{new Date(adj.created_at).toLocaleTimeString()}</td>
                              <td style={styles.reportTd}>{adj.users?.full_name || adj.users?.email || 'Cashier'}</td>
                              <td style={styles.reportTd}>{adj.description || adj.adjustment_reason || 'Cash to GCash'}</td>
                              <td style={styles.reportTd}>{adj.reference_number || 'N/A'}</td>
                              <td style={styles.reportTdHighlight}>₱{parseFloat(adj.amount || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr style={styles.reportTotalRow}>
                            <td colSpan="4" style={styles.reportTotalLabel}>Total Adjustments:</td>
                            <td style={styles.reportTotalValue}>
                              ₱{gcashAdjustments.reduce((sum, adj) => sum + parseFloat(adj.amount || 0), 0).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={styles.reportSummary}>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Total GCash from Sales:</span>
                    <span style={styles.summaryValue}>
                      ₱{gcashTransactions.reduce((sum, order) => sum + getGCashAmount(order), 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Total Adjustments:</span>
                    <span style={styles.summaryValue}>
                      ₱{gcashAdjustments.reduce((sum, adj) => sum + parseFloat(adj.amount || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={styles.summaryItemTotal}>
                    <span style={styles.summaryLabelTotal}>Expected in GCash App:</span>
                    <span style={styles.summaryValueTotal}>
                      ₱{(
                        gcashTransactions.reduce((sum, order) => sum + getGCashAmount(order), 0) +
                        gcashAdjustments.reduce((sum, adj) => sum + parseFloat(adj.amount || 0), 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button style={styles.modalCloseBtn} onClick={() => setShowGCashReport(false)}>
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
            </>
          )}

          {/* Pending Orders Tab Content */}
          {activeTab === 'pending' && (
            <div style={styles.pendingSection}>
              {pendingOrders.length === 0 ? (
                <div style={styles.emptyState}>
                  <p style={styles.emptyIcon}>📭</p>
                  <p style={styles.emptyText}>No pending online orders</p>
                </div>
              ) : (
                <div style={styles.ordersGrid}>
                  {pendingOrders.map((order) => (
                    <div key={order.id} style={styles.pendingOrderCard}>
                      <div style={styles.orderHeader}>
                        <div>
                          <h3 style={styles.orderNumber}>
                            Order #{order.order_number || order.id.slice(0, 8)}
                          </h3>
                          <p style={styles.orderTime}>
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div style={styles.orderModeBadge}>
                          {order.order_mode === 'delivery' ? '🚚 Delivery' : '📦 Pick-up'}
                        </div>
                      </div>

                      {order.customer_name && (
                        <div style={styles.orderCustomer}>
                          👤 {order.customer_name}
                          {order.contact_number && ` • ${order.contact_number}`}
                        </div>
                      )}

                      {order.delivery_address && order.order_mode === 'delivery' && (
                        <div style={styles.orderAddress}>
                          📍 {order.delivery_address}
                        </div>
                      )}

                      <div style={styles.itemsList}>
                        {/* Display order_items if available, otherwise fall back to items array */}
                        {(order.order_items && order.order_items.length > 0 ? order.order_items : order.items || []).map((item, index) => (
                          <div key={index} style={styles.orderItem}>
                            <span style={styles.itemName}>{item.name}</span>
                            <span style={styles.itemQty}>x{item.quantity}</span>
                            <span style={styles.itemPrice}>
                              ₱{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div style={styles.orderFooter}>
                        <div style={styles.orderTotal}>
                          Total: ₱{parseFloat(order.total_amount || 0).toFixed(2)}
                        </div>
                        <button
                          style={styles.acceptOrderBtn}
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
          )}
        </main>

        {/* Print Receipt Confirmation Modal */}
        {showPrintReceiptModal && acceptedOrder && (
          <div style={styles.modal} onClick={() => setShowPrintReceiptModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>✅ Order Accepted!</h3>
              <p style={styles.modalSubtext}>
                Order #{acceptedOrder.order_number || acceptedOrder.id.slice(0, 8)} has been accepted and receipts have been printed.
              </p>
              <p style={styles.modalInfo}>
                • Sales invoice (for records)<br />
                • Kitchen order slip
              </p>
              <div style={styles.modalActions}>
                <button
                  style={styles.modalReprintBtn}
                  onClick={() => {
                    printReceipt(acceptedOrder, 'sales');
                    setTimeout(() => printReceipt(acceptedOrder, 'kitchen'), 500);
                  }}
                >
                  🖨️ Reprint Receipts
                </button>
                <button
                  style={styles.modalCloseBtn}
                  onClick={() => setShowPrintReceiptModal(false)}
                >
                  Close
                </button>
              </div>
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
  gcashModalContent: {
    maxWidth: '900px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalSubtitle: {
    fontSize: '13px',
    color: '#888',
    textAlign: 'center',
    marginBottom: '24px',
  },
  reportSection: {
    marginBottom: '32px',
  },
  reportSectionTitle: {
    fontSize: '16px',
    color: '#ffc107',
    marginBottom: '12px',
    borderBottom: '1px solid #ffc107',
    paddingBottom: '8px',
  },
  reportSectionDesc: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '12px',
  },
  tableContainer: {
    overflowX: 'auto',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '16px',
  },
  reportTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  reportTableHeader: {
    borderBottom: '2px solid #ffc107',
  },
  reportTh: {
    padding: '12px 8px',
    textAlign: 'left',
    color: '#ffc107',
    fontWeight: '600',
  },
  reportTableRow: {
    borderBottom: '1px solid #444',
  },
  reportTd: {
    padding: '12px 8px',
    color: '#ccc',
  },
  reportTdHighlight: {
    padding: '12px 8px',
    color: '#ffc107',
    fontWeight: '600',
  },
  reportTotalRow: {
    borderTop: '2px solid #ffc107',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  reportTotalLabel: {
    padding: '12px 8px',
    textAlign: 'right',
    fontWeight: '700',
    color: '#fff',
  },
  reportTotalValue: {
    padding: '12px 8px',
    color: '#ffc107',
    fontWeight: '700',
    fontSize: '16px',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    padding: '24px',
    fontSize: '14px',
  },
  reportSummary: {
    marginTop: '24px',
    marginBottom: '24px',
    padding: '20px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    border: '2px solid #ffc107',
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #444',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#ccc',
  },
  summaryValue: {
    fontSize: '14px',
    color: '#ffc107',
    fontWeight: '600',
  },
  summaryItemTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    marginTop: '8px',
    borderTop: '2px solid #ffc107',
  },
  summaryLabelTotal: {
    fontSize: '16px',
    color: '#fff',
    fontWeight: '700',
  },
  summaryValueTotal: {
    fontSize: '18px',
    color: '#ffc107',
    fontWeight: '700',
  },
  modalSubtext: {
    fontSize: '14px',
    color: '#ccc',
    textAlign: 'center',
    marginBottom: '16px',
  },
  modalInfo: {
    fontSize: '13px',
    color: '#888',
    textAlign: 'left',
    marginBottom: '24px',
    lineHeight: '1.8',
    padding: '12px',
    backgroundColor: '#2a2a2a',
    borderRadius: '6px',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
  },
  modalReprintBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
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
  tabContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
    justifyContent: 'center',
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: '#1a1a1a',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tabActive: {
    padding: '12px 24px',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tabBadge: {
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: '700',
  },
  tabBadgeNew: {
    backgroundColor: '#ff4444',
    color: '#fff',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: '700',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  pendingSection: {
    marginTop: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#888',
  },
  ordersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
  },
  pendingOrderCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #2a2a2a',
  },
  orderNumber: {
    fontSize: '16px',
    color: '#ffc107',
    margin: '0 0 4px 0',
  },
  orderTime: {
    fontSize: '12px',
    color: '#888',
    margin: 0,
  },
  orderModeBadge: {
    padding: '4px 12px',
    backgroundColor: '#2a2a2a',
    color: '#ffc107',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
  },
  orderCustomer: {
    fontSize: '13px',
    color: '#ccc',
    marginBottom: '8px',
  },
  orderAddress: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '12px',
    fontStyle: 'italic',
  },
  itemsList: {
    marginBottom: '16px',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #2a2a2a',
    gap: '12px',
  },
  itemName: {
    fontSize: '14px',
    color: '#fff',
    flex: 1,
  },
  itemQty: {
    fontSize: '12px',
    color: '#888',
  },
  itemPrice: {
    fontSize: '14px',
    color: '#ffc107',
    fontWeight: '600',
  },
  orderFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #2a2a2a',
  },
  orderTotal: {
    fontSize: '16px',
    color: '#ffc107',
    fontWeight: '700',
  },
  acceptOrderBtn: {
    padding: '10px 20px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
