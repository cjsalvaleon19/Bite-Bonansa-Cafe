import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import NotificationBell from '../../components/NotificationBell';
import { calculateSalesBreakdown, calculateAdjustmentDeductions, calculateCashToGcashTotal, getGCashAmount, UNACCEPTED_ORDER_STATUSES, ONLINE_ORDER_MODES } from '../../utils/salesCalculations';
import { connectPrinter, printToBluetoothPrinter } from '../../utils/bluetoothPrinter';
import { buildKitchenDepartmentOrders, formatOrderModeLabel, formatOrderSlipItemDetails, getOrderItems, getOrderSlipNumber } from '../../utils/receiptDepartments';
import { DELIVERY_LOCATION_OPTIONS, formatDeliveryLocationAddress } from '../../utils/deliveryLocations';

// Constants
const NOTIFICATION_AUDIO_VOLUME = 0.5;
const STATS_REFRESH_DEBOUNCE_MS = 2000; // Debounce stats refresh by 2 seconds

/**
 * Compute the effective delivery fee for a delivery order.
 * Some orders were stored with delivery_fee = 0 (e.g. placed before the
 * location-based fee was persisted).  We recover the correct value by:
 *   1. Using the stored delivery_fee when it is non-zero.
 *   2. Deriving from total_amount − subtotal (equals the fee when total_amount
 *      was stored correctly but delivery_fee column was not).
 *   3. Matching the order's customer_address against DELIVERY_LOCATION_OPTIONS
 *      as a last resort (handles orders where total_amount is also wrong).
 */
function computeEffectiveDeliveryFee(order) {
  const stored = parseFloat(order?.delivery_fee || 0);
  if (stored > 0) return stored;

  // Derive from stored totals (most reliable when total_amount is correct)
  const computed = parseFloat(order?.total_amount || 0) - parseFloat(order?.subtotal || 0);
  if (computed > 0) return computed;

  // Last resort: identify the location from the delivery address string
  const addr = getOrderDeliveryAddress(order);
  if (addr) {
    const matched = DELIVERY_LOCATION_OPTIONS.find((loc) =>
      addr.includes(formatDeliveryLocationAddress(loc))
    );
    if (matched) return matched.fee;
  }

  return 0;
}

function getOrderDeliveryAddress(order) {
  return String(order?.delivery_address || order?.customer_address || '').trim();
}

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
  const [newOrderPopup, setNewOrderPopup] = useState(null); // { order_number, order_mode, customer_name }
  const [showPrintReceiptModal, setShowPrintReceiptModal] = useState(false);
  const [acceptedOrder, setAcceptedOrder] = useState(null);
  const [viewOrderModal, setViewOrderModal] = useState(false);
  const [selectedOrderToView, setSelectedOrderToView] = useState(null);
  const [editableCashTendered, setEditableCashTendered] = useState('');
  const [gcashProofUrl, setGcashProofUrl] = useState(null);
  const [showGCashProof, setShowGCashProof] = useState(false);
  const [gcashProofImageError, setGcashProofImageError] = useState(false);
  const statsRefreshTimerRef = useRef(null);

  // Extract GCash proof URL stored in special_request as "| GCash proof: {url}"
  const extractGCashProofUrl = (specialRequest) => {
    if (!specialRequest) return null;
    const match = specialRequest.match(/\|\s*GCash proof:\s*(https?:\/\/[^\s|]+)/i);
    return match ? match[1].trim() : null;
  };

  const openGCashProof = (specialRequest) => {
    const storedUrl = extractGCashProofUrl(specialRequest);
    if (!storedUrl) {
      alert('No GCash proof attachment found for this order.');
      return;
    }
    setGcashProofImageError(false);
    // Extract the file path from the stored URL and route through the server-side
    // proxy so the image loads regardless of bucket visibility settings.
    // Stored format: https://[project].supabase.co/storage/v1/object/public/payment-proofs/{filePath}
    const pathMatch = storedUrl.match(/\/payment-proofs\/(.+)$/);
    const proxyUrl = pathMatch
      ? `/api/payment-proof?path=${encodeURIComponent(pathMatch[1])}`
      : storedUrl;
    setGcashProofUrl(proxyUrl);
    setShowGCashProof(true);
  };

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
          if (UNACCEPTED_ORDER_STATUSES.includes(newOrder.status) && ONLINE_ORDER_MODES.includes(newOrder.order_mode)) {
            setHasNewOrders(true);
            // Show in-app popup notification
            setNewOrderPopup({
              order_number: newOrder.order_number || newOrder.id?.slice(0, 8),
              order_mode: newOrder.order_mode,
              customer_name: newOrder.customer_name || null,
            });
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

      // Fetch orders for today — exclude unaccepted customer orders (pending / order_in_queue)
      // so that Today's Stats only reflects orders the cashier has already accepted and processed
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .not('status', 'in', `(${UNACCEPTED_ORDER_STATUSES.join(',')})`);

      if (error) throw error;

      let dineInCount = 0;
      let takeOutCount = 0;
      let pickUpCount = 0;
      let deliveryCount = 0;

      // Use utility function for sales calculations
      const { totalSales, cashSales, gcashSales, pointsSales } = calculateSalesBreakdown(orders || []);

      (orders || []).forEach(order => {
        // Order mode breakdown
        const orderMode = order.order_mode || '';
        if (orderMode === 'dine-in') dineInCount++;
        else if (orderMode === 'take-out') takeOutCount++;
        else if (orderMode === 'pick-up' || orderMode === 'pickup') pickUpCount++;
        else if (orderMode === 'delivery') deliveryCount++;
      });

      // Fetch all adjustments for today (cash-to-gcash, canceled_order, double_posting)
      let adjustmentTotal = 0;
      let allAdjustments = [];
      try {
        const { data: adjustments } = await supabase
          .from('cash_drawer_transactions')
          .select('amount, adjustment_reason, payment_adjustment_type')
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString())
          .eq('transaction_type', 'adjustment');

        allAdjustments = adjustments || [];

        adjustmentTotal = calculateCashToGcashTotal(allAdjustments);
      } catch (adjErr) {
        console.warn('[CashierDashboard] Could not fetch adjustments:', adjErr?.message ?? adjErr);
      }

      // Cash-to-GCash reclassifies from Cash bucket → GCash bucket (no effect on Total).
      // Canceled order / double posting are cash corrections that reduce Cash Sales.
      const cashDeductions = calculateAdjustmentDeductions(allAdjustments);
      const displayedCash = cashSales - adjustmentTotal - cashDeductions;
      const displayedGcash = gcashSales + adjustmentTotal;

      setStats({
        totalSales: displayedCash + displayedGcash,
        cashSales: displayedCash,
        gcashSales: displayedGcash,
        pointsSales,
        receiptCount: (orders || []).length,
        dineInCount,
        takeOutCount,
        pickUpCount,
        deliveryCount,
      });
    } catch (err) {
      console.error('[CashierDashboard] Failed to fetch stats:', err?.message ?? err);
    }
  };

  const fetchPendingOnlineOrders = async () => {
    if (!supabase) return;

    try {
      // Use the server-side API route which runs with the service-role client,
      // bypassing the RLS infinite-recursion bug on the orders table.
      // The route still enforces that the caller is an authenticated cashier/admin.
      const session = (await supabase.auth.getSession())?.data?.session;
      const token = session?.access_token;
      if (!token) {
        console.warn('[CashierDashboard] No auth token — skipping pending orders fetch');
        return;
      }

      const res = await fetch('/api/cashier/pending-orders', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      const { orders } = await res.json();
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

  const printReceipt = (order, receiptType = 'sales', options = {}) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print receipts');
      return;
    }

    const items = getOrderItems(order);
    const isKitchenCopy = receiptType === 'kitchen';
    const deliveryAddress = getOrderDeliveryAddress(order);
    
    // Helper function to strip variant details from item name (for legacy data)
    const stripVariantsFromName = (name) => {
      // Remove anything in parentheses at the end of the name (e.g., "Americano (12oz Hot | Extra Shot)" -> "Americano")
      return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    };

    const qrImageUrl = `${window.location.origin}/qr-code.png`;
    const normalizeVariants = (rawVariants) => {
      if (!rawVariants) return null;
      if (typeof rawVariants === 'object') return rawVariants;
      if (typeof rawVariants === 'string') {
        try {
          const parsed = JSON.parse(rawVariants);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    };

    // Build items HTML with variant details
    const itemsHtml = items.map(item => {
      const itemPrice = (item.price || 0) * (item.quantity || 0);
      let variantDetailsHtml = '';
      
      // Check if variant_details (snake_case from order_items) or variantDetails (camelCase from orders.items) exists and has content
      const variants = normalizeVariants(item.variant_details || item.variantDetails);
      if (variants && typeof variants === 'object' && Object.keys(variants).length > 0) {
        const variantValues = Object.entries(variants)
          .map(([type, value]) => `${value}`)
          .join(', ');
        variantDetailsHtml = `
          <tr>
            <td colspan="3" style="padding: 2px 0 8px 0; font-size: 10px; color: #666;">
              (Add Ons: ${variantValues})
            </td>
          </tr>
        `;
      }
      
      // Strip variants from name for display (handles legacy data)
      const displayName = stripVariantsFromName(item.name);
      
      return `
        <tr>
          <td style="padding: 4px 0;">${displayName}</td>
          <td style="padding: 4px 8px; text-align: center;">x${item.quantity}</td>
          <td style="padding: 4px 0; text-align: right;">₱${itemPrice.toFixed(2)}</td>
        </tr>
        ${variantDetailsHtml}
      `;
    }).join('');

    const departmentName = options.departmentName || '';
    const title = isKitchenCopy ? 'ORDER SLIP' : 'SALES INVOICE';

    if (isKitchenCopy) {
      const kitchenItemsHtml = items.map((item) => {
        const { mainLine, subvariantLines } = formatOrderSlipItemDetails(item);
        const subvariantHtml = subvariantLines
          .map((line) => `<div style="font-size: 35px; padding-top: 2px; padding-left: 12px;">${line}</div>`)
          .join('');
        return `
          <tr>
            <td style="padding: 4px 0;">
              <div style="font-size: 35px;">${mainLine}</div>
              ${subvariantHtml}
            </td>
            <td style="padding: 4px 0; font-size: 35px; text-align: right;">${item.quantity || 1}</td>
          </tr>
        `;
      }).join('');

      const kitchenSlipHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Order Slip #${getOrderSlipNumber(order)}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 300); });</script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: 80mm auto; margin: 0 0 1cm 0; }
            body {
              font-family: 'Courier New', monospace;
              font-size: 18px;
              line-height: 1.45;
              padding: 0 12px;
              max-width: 350px;
              margin: 0 auto;
            }
            .section { margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            @media print {
              body { padding: 0 12px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="section">
            <p style="font-size: 18px; font-weight: bold; text-align: center;">ORDER SLIP</p>
          </div>
          <div class="section">
            <p style="font-size: 35px; font-weight: bold;">OS #${getOrderSlipNumber(order)} — ${formatOrderModeLabel(order.order_mode)}</p>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th style="text-align: left; padding: 4px 0; border-bottom: 2px solid #000;">Item</th>
                  <th style="text-align: right; padding: 4px 0; border-bottom: 2px solid #000;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${kitchenItemsHtml}
              </tbody>
            </table>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #ffc107; border: none; border-radius: 4px;">
              Print Order Slip
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; margin-left: 10px; background: #666; color: white; border: none; border-radius: 4px;">
              Close
            </button>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(kitchenSlipHtml);
      printWindow.document.close();
      return;
    }
    
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
    
    const receiptPhone = (order.users && order.users.phone) || order.customer_phone || order.contact_number || '';

    // Extract the last 3-digit sequence from the order number (e.g. ORD-YYMMDD-### → ###)
    const orderShortNumber = (() => {
      const num = order.order_number || '';
      const parts = num.split('-');
      return parts.length >= 3 ? parts[parts.length - 1] : (num.slice(-3) || num);
    })();

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Order #${order.order_number || order.id.slice(0, 8)}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 300); });</script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: 80mm auto; margin: 0 0 1cm 0; }
             body { 
               font-family: 'Courier New', monospace; 
               padding: 0 12px; 
               max-width: 350px;
               margin: 0 auto;
               word-break: break-word;
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
              body { padding: 0 12px; }
              button { display: none; }
            }
          </style>
      </head>
      <body>
        <div class="header">
          <h1>☕ Bite Bonansa Cafe</h1>
          <p>Laconon-Salacafe Rd, Brgy. Poblacion, T'boli, South Cotabato</p>
          <p>Tel: 0907-200-8247</p>
          <p style="margin-top: 10px; font-size: 16px; font-weight: bold;">${title}</p>
        </div>

        <div class="section">
          <p>Order#: ${order.order_number || order.id.slice(0, 8)}</p>
          <p>Slip# : ${getOrderSlipNumber(order)}</p>
          <p>Date  : ${new Date(order.created_at).toLocaleString()}</p>
          <p>Type  : ${order.order_mode || 'N/A'}</p>
          ${isKitchenCopy && departmentName ? `<p><strong>Kitchen Department:</strong> ${departmentName}</p>` : ''}
          <p>Name  : ${order.customer_name || order.users?.full_name || 'Walk-in'}</p>
          ${receiptPhone ? `<p>Phone : ${receiptPhone}</p>` : ''}
          ${customerLoyaltyId !== 'N/A' ? `<p><strong>Customer ID:</strong> ${customerLoyaltyId}</p>` : ''}
          ${deliveryAddress && order.order_mode === 'delivery' ? `<p><strong>Delivery Address:</strong> ${deliveryAddress}</p>` : ''}
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
            <tr>
              <td style="padding: 4px 0;"><strong>Cash Tendered:</strong></td>
              <td style="text-align: right;">₱${amountTendered.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Change:</strong></td>
              <td style="text-align: right;">₱${change.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0 4px 0; border-top: 1px dashed #000;"><strong>Payment:</strong></td>
              <td style="text-align: right; padding-top: 8px; border-top: 1px dashed #000;">${displayPaymentMethod}</td>
            </tr>
          </table>
        </div>
        ` : ''}

        ${(() => {
          // Extract only customer order notes from special_request
          // Remove GCash reference number and proof URL
          let orderNotes = order.special_request || '';
          if (orderNotes) {
            // Split by | delimiter and take only the first part (customer notes)
            orderNotes = orderNotes.split('|')[0].trim();
          }
          
          return orderNotes ? `
          <div class="section">
            <p class="section-title">SPECIAL INSTRUCTIONS</p>
            <p style="font-size: 12px;">${orderNotes}</p>
          </div>
          ` : '';
        })()}

        <div class="footer">
          <p>Thank you for your order, Biter!</p>
          ${!isKitchenCopy ? `<div style="margin-top: 12px; text-align: center;">
            <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px; margin-bottom: 6px;">ORDER #${orderShortNumber}</p>
            <img src="${qrImageUrl}" alt="Scan to order online" style="width: 90px; height: 90px;" />
            <p style="margin: 4px 0; font-size: 11px; font-weight: bold; letter-spacing: 0.5px;">Scan to Order Online</p>
            <p style="margin: 2px 0; font-size: 11px; color: #333;">bitebonansacafe.com</p>
            <p style="margin: 4px 0; font-size: 50px; font-weight: bold; line-height: 1;">Order Slip ${getOrderSlipNumber(order)}</p>
          </div>` : ''}
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
  };

  const printKitchenReceipts = async (order) => {
    const kitchenOrders = buildKitchenDepartmentOrders(order);
    for (let i = 0; i < kitchenOrders.length; i++) {
      if (i > 0) {
        // Stagger browser print windows slightly so each department slip queues reliably.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      const group = kitchenOrders[i];
      printReceipt(group.order, 'kitchen', { departmentName: group.name });
    }
  };

  const printReceiptBluetooth = async (order, receiptType = 'sales', options = {}) => {
    const deliveryAddress = getOrderDeliveryAddress(order);
    const orderForPrint = deliveryAddress && !order.delivery_address
      ? { ...order, delivery_address: deliveryAddress }
      : order;
    const { silent = false } = options;
    let displayPaymentMethod = orderForPrint.payment_method || 'N/A';
    const ptsClaimed = orderForPrint.points_used || 0;
    const total = (orderForPrint.subtotal || 0) + (orderForPrint.delivery_fee || 0);
    if (ptsClaimed > 0) {
      if (ptsClaimed >= total) {
        displayPaymentMethod = 'Points';
      } else if (orderForPrint.payment_method && orderForPrint.payment_method.includes('points+')) {
        displayPaymentMethod = orderForPrint.payment_method.split('points+')[1];
      } else if (orderForPrint.payment_method && orderForPrint.payment_method.includes('+')) {
        const parts = orderForPrint.payment_method.split('+');
        displayPaymentMethod = parts.find(p => p !== 'points') || orderForPrint.payment_method;
      }
    }
    try {
      await printToBluetoothPrinter(orderForPrint, receiptType, {
        cashierName: user?.full_name || user?.email || 'Cashier',
        customerLoyaltyId: orderForPrint.users?.customer_id || null,
        displayPaymentMethod,
        departmentName: options.departmentName || null,
      });
    } catch (err) {
      if (!silent) {
        alert('Bluetooth print failed: ' + (err.message || 'Unknown error'));
      } else {
        console.warn('[CashierDashboard] Auto Bluetooth print failed:', err?.message ?? err);
      }
    }
  };

  const printKitchenReceiptsBluetooth = async (order, options = {}) => {
    const kitchenOrders = buildKitchenDepartmentOrders(order);
    for (const group of kitchenOrders) {
      await printReceiptBluetooth(group.order, 'kitchen', {
        ...options,
        departmentName: group.name,
      });
    }
  };

  const handleViewOrder = (order) => {
    const deliveryAddress = getOrderDeliveryAddress(order);
    setSelectedOrderToView(
      deliveryAddress && !order.delivery_address
        ? { ...order, delivery_address: deliveryAddress }
        : order
    );
    setEditableCashTendered(order.cash_amount || '');
    setViewOrderModal(true);
  };

  const handleUpdateCashTendered = async (newCashAmount) => {
    if (!supabase || !selectedOrderToView) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ cash_amount: parseFloat(newCashAmount) || 0 })
        .eq('id', selectedOrderToView.id);
      
      if (error) throw error;
      
      // Update local state
      setSelectedOrderToView({
        ...selectedOrderToView,
        cash_amount: parseFloat(newCashAmount) || 0
      });
      
      // Refresh the orders list
      fetchPendingOnlineOrders();
    } catch (err) {
      console.error('[CashierDashboard] Failed to update cash tendered:', err?.message ?? err);
      alert('Failed to update cash tendered. Please try again.');
    }
  };


  const handleAcceptOrderFromView = async () => {
    if (!supabase || !selectedOrderToView) return;
    const printerWarmup = connectPrinter().catch((err) => {
      console.warn('[CashierDashboard] Bluetooth pre-connect skipped:', err?.message ?? err);
      return null;
    });

    try {
      // Determine the appropriate status based on order mode
      // Dine-in and Take-out: 'proceed_to_cashier' (customer pays at cashier)
      // Delivery and Pick-up: 'order_in_process' (payment already done online)
      const isDineInOrTakeOut = selectedOrderToView.order_mode === 'dine-in' || selectedOrderToView.order_mode === 'take-out';
      const newStatus = isDineInOrTakeOut ? 'proceed_to_cashier' : 'order_in_process';

      // Compute the effective delivery fee so receipts and reports are accurate.
      // If the stored delivery_fee is 0 (can happen with orders placed before the
      // fee was persisted correctly), backfill it with the computed value.
      const isDeliveryOrder = selectedOrderToView.order_mode === 'delivery';
      const effectiveDeliveryFeeOnAccept = isDeliveryOrder
        ? computeEffectiveDeliveryFee(selectedOrderToView)
        : 0;
      const storedDeliveryFee = parseFloat(selectedOrderToView.delivery_fee || 0);
      const needsDeliveryFeeBackfill = isDeliveryOrder
        && effectiveDeliveryFeeOnAccept > 0
        && storedDeliveryFee === 0;

      // Update order status, accepted_at, and (if needed) the corrected delivery_fee.
      // Note: Database trigger will automatically create notification for customer
      const updatePayload = {
        status: newStatus,
        accepted_at: new Date().toISOString(),
        cashier_id: user?.id,
      };
      if (needsDeliveryFeeBackfill) {
        updatePayload.delivery_fee = effectiveDeliveryFeeOnAccept;
      }

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', selectedOrderToView.id);

      if (error) throw error;

      // Build the order object used for receipts, patching in the effective fee
      const orderForReceipt = needsDeliveryFeeBackfill
        ? { ...selectedOrderToView, delivery_fee: effectiveDeliveryFeeOnAccept }
        : selectedOrderToView;

      // Close view modal
      setViewOrderModal(false);
      
      // Show print receipt confirmation modal
      setAcceptedOrder(orderForReceipt);
      setShowPrintReceiptModal(true);
      
      // Generate sales invoice receipt
      printReceipt(orderForReceipt, 'sales');
      await printKitchenReceipts(orderForReceipt);

      // Auto Bluetooth print on accept click (non-blocking on failure)
      await printerWarmup;
      await printReceiptBluetooth(orderForReceipt, 'sales', { silent: true });
      await printKitchenReceiptsBluetooth(orderForReceipt, { silent: true });

      fetchPendingOnlineOrders();
    } catch (err) {
      console.error('[CashierDashboard] Failed to accept order:', err?.message ?? err);
      alert('Failed to accept order. Please try again.');
    }
  };

  const handleDeclineOrder = async () => {
    if (!supabase || !selectedOrderToView) return;
    if (!confirm('Are you sure you want to decline this order? This action cannot be undone.')) return;

    try {
      // Delete the order and all related data
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', selectedOrderToView.id);

      if (error) throw error;

      // Close view modal
      setViewOrderModal(false);
      setSelectedOrderToView(null);
      
      // Refresh pending orders
      fetchPendingOnlineOrders();
      
      alert('Order has been declined and removed.');
    } catch (err) {
      console.error('[CashierDashboard] Failed to decline order:', err?.message ?? err);
      alert('Failed to decline order. Please try again.');
    }
  };

  const handleAcceptOrder = async (orderId) => {
    if (!supabase) return;
    if (!confirm('Accept this order and start processing?')) return;
    const printerWarmup = connectPrinter().catch((err) => {
      console.warn('[CashierDashboard] Bluetooth pre-connect skipped:', err?.message ?? err);
      return null;
    });

    try {
      // Get the order to determine its mode
      const order = pendingOrders.find(o => o.id === orderId);
      
      // Determine the appropriate status based on order mode
      // Dine-in and Take-out: 'proceed_to_cashier' (customer pays at cashier)
      // Delivery and Pick-up: 'order_in_process' (payment already done online)
      const isDineInOrTakeOut = order && (order.order_mode === 'dine-in' || order.order_mode === 'take-out');
      const newStatus = isDineInOrTakeOut ? 'proceed_to_cashier' : 'order_in_process';
      
      // Update order status and set accepted_at timestamp
      // Note: Database trigger will automatically create notification for customer
      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          accepted_at: new Date().toISOString(),
          cashier_id: user?.id
        })
        .eq('id', orderId);

      if (error) throw error;

      // Use the order we already found earlier for printing
      if (order) {
        // Show print receipt confirmation modal
        setAcceptedOrder(order);
        setShowPrintReceiptModal(true);
        
        // Generate sales invoice receipt
        printReceipt(order, 'sales');
        await printKitchenReceipts(order);

        // Auto Bluetooth print on accept click (non-blocking on failure)
        await printerWarmup;
        await printReceiptBluetooth(order, 'sales', { silent: true });
        await printKitchenReceiptsBluetooth(order, { silent: true });
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
                             <th style={styles.reportTh}>GCash Proof</th>
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
                              <td style={styles.reportTd}>
                                {extractGCashProofUrl(order.special_request) ? (
                                  <button
                                    style={styles.proofPreviewBtn}
                                    onClick={() => openGCashProof(order.special_request)}
                                    title="View GCash Proof"
                                  >
                                    📎
                                  </button>
                                ) : (
                                  <span style={{ color: '#666', fontSize: '12px' }}>None</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr style={styles.reportTotalRow}>
                            <td colSpan="7" style={styles.reportTotalLabel}>Total GCash Sales:</td>
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
                              <td style={styles.reportTdHighlight}>₱{Math.abs(parseFloat(adj.amount || 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr style={styles.reportTotalRow}>
                            <td colSpan="4" style={styles.reportTotalLabel}>Total Adjustments:</td>
                            <td style={styles.reportTotalValue}>
                              ₱{gcashAdjustments.reduce((sum, adj) => sum + Math.abs(parseFloat(adj.amount || 0)), 0).toFixed(2)}
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
                      ₱{gcashAdjustments.reduce((sum, adj) => sum + Math.abs(parseFloat(adj.amount || 0)), 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={styles.summaryItemTotal}>
                    <span style={styles.summaryLabelTotal}>Expected in GCash App:</span>
                    <span style={styles.summaryValueTotal}>
                      ₱{(
                        gcashTransactions.reduce((sum, order) => sum + getGCashAmount(order), 0) +
                        gcashAdjustments.reduce((sum, adj) => sum + Math.abs(parseFloat(adj.amount || 0)), 0)
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
                          {order.order_mode === 'delivery' && '🚚 Delivery'}
                          {(order.order_mode === 'pick-up' || order.order_mode === 'pickup') && '📦 Pick-up'}
                          {order.order_mode === 'dine-in' && '🍽️ Dine-in'}
                          {order.order_mode === 'take-out' && '🥡 Take-out'}
                        </div>
                      </div>

                      {(order.customer_name || order.users?.full_name) && (
                        <div style={styles.orderCustomer}>
                          👤 {order.customer_name || order.users?.full_name}
                          {order.contact_number && ` • ${order.contact_number}`}
                        </div>
                      )}

                      {getOrderDeliveryAddress(order) && order.order_mode === 'delivery' && (
                        <div style={styles.orderAddress}>
                          📍 {getOrderDeliveryAddress(order)}
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
                          onClick={() => handleViewOrder(order)}
                        >
                          👁️ View Order
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* View Order Modal */}
        {viewOrderModal && selectedOrderToView && (() => {
          const effectiveDeliveryFee = selectedOrderToView.order_mode === 'delivery'
            ? computeEffectiveDeliveryFee(selectedOrderToView)
            : 0;
          return (
          <div style={styles.modal} onClick={() => setViewOrderModal(false)}>
            <div style={{ ...styles.modalContent, ...styles.viewOrderModalContent }} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>📋 Order Details</h3>
              
              <div style={styles.viewOrderInfo}>
                <div style={styles.viewOrderRow}>
                  <strong>Order Number:</strong>
                  <span>#{selectedOrderToView.order_number || selectedOrderToView.id.slice(0, 8)}</span>
                </div>
                <div style={styles.viewOrderRow}>
                  <strong>Order Mode:</strong>
                  <span>
                    {selectedOrderToView.order_mode === 'delivery' && '🚚 Delivery'}
                    {(selectedOrderToView.order_mode === 'pick-up' || selectedOrderToView.order_mode === 'pickup') && '📦 Pick-up'}
                    {selectedOrderToView.order_mode === 'dine-in' && '🍽️ Dine-in'}
                    {selectedOrderToView.order_mode === 'take-out' && '🥡 Take-out'}
                  </span>
                </div>
                <div style={styles.viewOrderRow}>
                  <strong>Order Time:</strong>
                  <span>{new Date(selectedOrderToView.created_at).toLocaleString()}</span>
                </div>
                {(selectedOrderToView.customer_name || selectedOrderToView.users?.full_name) && (
                  <div style={styles.viewOrderRow}>
                    <strong>Customer:</strong>
                    <span>{selectedOrderToView.customer_name || selectedOrderToView.users?.full_name}</span>
                  </div>
                )}
                {selectedOrderToView.contact_number && (
                  <div style={styles.viewOrderRow}>
                    <strong>Contact:</strong>
                    <span>{selectedOrderToView.contact_number}</span>
                  </div>
                )}
                {getOrderDeliveryAddress(selectedOrderToView) && selectedOrderToView.order_mode === 'delivery' && (
                  <div style={styles.viewOrderRow}>
                    <strong>Delivery Address:</strong>
                    <span>{getOrderDeliveryAddress(selectedOrderToView)}</span>
                  </div>
                )}
                {selectedOrderToView.payment_method && (
                  <div style={styles.viewOrderRow}>
                    <strong>Payment Method:</strong>
                    <span style={{ textTransform: 'capitalize' }}>{selectedOrderToView.payment_method}</span>
                  </div>
                )}
                {(selectedOrderToView.payment_method === 'gcash' || selectedOrderToView.payment_method === 'points+gcash') &&
                  extractGCashProofUrl(selectedOrderToView.special_request) && (
                  <div style={styles.viewOrderRow}>
                    <strong>GCash Proof:</strong>
                    <button
                      style={styles.proofPreviewBtn}
                      onClick={() => openGCashProof(selectedOrderToView.special_request)}
                      title="View GCash Proof"
                    >
                      📎
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.viewOrderSection}>
                <h4 style={styles.viewOrderSectionTitle}>Order Items</h4>
                <div style={styles.viewOrderItemsList}>
                  {(selectedOrderToView.order_items && selectedOrderToView.order_items.length > 0 
                    ? selectedOrderToView.order_items 
                    : selectedOrderToView.items || []
                  ).map((item, index) => (
                    <div key={index} style={styles.viewOrderItem}>
                      <div style={styles.viewOrderItemName}>
                        {item.name}
                        {item.variant_details && typeof item.variant_details === 'object' && Object.keys(item.variant_details).length > 0 && (
                          <div style={styles.viewOrderItemVariants}>
                            Variants & Add-ons: {Object.entries(item.variant_details).map(([type, value]) => value).join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={styles.viewOrderItemQty}>x{item.quantity}</div>
                      <div style={styles.viewOrderItemPrice}>
                        ₱{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.viewOrderTotals}>
                <div style={styles.viewOrderTotalRow}>
                  <span>Subtotal:</span>
                  <span>₱{parseFloat(selectedOrderToView.subtotal || 0).toFixed(2)}</span>
                </div>
                {selectedOrderToView.order_mode === 'delivery' && (
                  <div style={styles.viewOrderTotalRow}>
                    <span>Delivery Fee:</span>
                    <span>₱{effectiveDeliveryFee.toFixed(2)}</span>
                  </div>
                )}
                {selectedOrderToView.points_used > 0 && (
                  <div style={styles.viewOrderTotalRow}>
                    <span>Points Redeemed:</span>
                    <span>-₱{parseFloat(selectedOrderToView.points_used || 0).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ ...styles.viewOrderTotalRow, ...styles.viewOrderGrandTotal }}>
                  <strong>Total:</strong>
                  <strong>₱{parseFloat(selectedOrderToView.total_amount || 0).toFixed(2)}</strong>
                </div>
                {(() => {
                  const cashAmount = parseFloat(selectedOrderToView.cash_amount || 0);
                  const totalAmount = parseFloat(selectedOrderToView.total_amount || 0);
                  const pointsUsed = parseFloat(selectedOrderToView.points_used || 0);
                  const netAmount = totalAmount - pointsUsed;
                  const isDineInOrTakeOut = selectedOrderToView.order_mode === 'dine-in' || selectedOrderToView.order_mode === 'take-out';
                  const isGCash = selectedOrderToView.payment_method === 'gcash' || selectedOrderToView.payment_method === 'points+gcash';
                  
                  // GCash: tendered = net amount (exact); dine-in/take-out: editable; others: stored cash_amount
                  const currentCashAmount = isGCash
                    ? netAmount
                    : isDineInOrTakeOut
                      ? parseFloat(editableCashTendered || 0)
                      : cashAmount;
                  const change = Math.max(0, currentCashAmount - netAmount);
                  
                  return (
                    <>
                      <div style={styles.viewOrderTotalRow}>
                        <span>Cash Tendered:</span>
                        {!isGCash && isDineInOrTakeOut ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              value={editableCashTendered}
                              onChange={(e) => setEditableCashTendered(e.target.value)}
                              onBlur={() => handleUpdateCashTendered(editableCashTendered)}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              style={{
                                width: '120px',
                                padding: '6px 10px',
                                border: '2px solid #ffc107',
                                borderRadius: '6px',
                                backgroundColor: '#2a2a2a',
                                color: '#ffc107',
                                fontSize: '14px',
                                fontWeight: '600',
                                textAlign: 'right',
                                fontFamily: "'Poppins', sans-serif",
                              }}
                            />
                          </div>
                        ) : (
                          <span>₱{currentCashAmount.toFixed(2)}</span>
                        )}
                      </div>
                      <div style={styles.viewOrderTotalRow}>
                        <span>Change:</span>
                        <span>₱{change.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {selectedOrderToView.special_request && selectedOrderToView.special_request.trim() && (
                <div style={styles.viewOrderNotes}>
                  <strong>Special Instructions:</strong>
                  {/* Extract customer notes from special_request field (text before | delimiter). 
                      Format: "customer notes | metadata" - we only show customer notes */}
                  <p>{selectedOrderToView.special_request.split('|')[0].trim()}</p>
                </div>
              )}

              <div style={styles.viewOrderActions}>
                <button
                  style={styles.viewOrderAcceptBtn}
                  onClick={handleAcceptOrderFromView}
                >
                  ✓ Accept Order
                </button>
                <button
                  style={styles.viewOrderDeclineBtn}
                  onClick={handleDeclineOrder}
                >
                  ✕ Decline
                </button>
                <button
                  style={styles.viewOrderBackBtn}
                  onClick={() => setViewOrderModal(false)}
                >
                  ← Back
                </button>
              </div>
            </div>
          </div>
        );
        })()}

        {/* GCash Proof Image Lightbox */}
        {showGCashProof && (
          <div style={styles.modal} onClick={() => setShowGCashProof(false)}>
            <div style={styles.gcashProofModalContent} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>📱 GCash Payment Proof</h3>
              <div style={styles.gcashProofImageWrapper}>
                {gcashProofUrl && !gcashProofImageError ? (
                  <img
                    src={gcashProofUrl}
                    alt="GCash Payment Proof"
                    style={styles.gcashProofImage}
                    onError={() => setGcashProofImageError(true)}
                  />
                ) : (
                  <p style={{ color: '#f44', textAlign: 'center', padding: '16px' }}>
                    ⚠️ Unable to load image. The proof may have expired or been removed.
                  </p>
                )}
              </div>
              <div style={{ marginTop: '16px' }}>
                <button style={styles.modalCloseBtn} onClick={() => setShowGCashProof(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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
                • Kitchen order slips (per department)
              </p>
              <div style={styles.modalActions}>
                <button
                  style={styles.modalBtPrintBtn}
                  onClick={async () => {
                    await printReceiptBluetooth(acceptedOrder, 'sales');
                    await printKitchenReceiptsBluetooth(acceptedOrder);
                  }}
                >
                  🖨️ Reprint Receipts (Bluetooth)
                </button>
                <button
                  style={styles.modalReprintBtn}
                  onClick={async () => {
                    printReceipt(acceptedOrder, 'sales');
                    await printKitchenReceipts(acceptedOrder);
                  }}
                >
                  🧾 Browser Print
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

      {/* New Order Popup Notification */}
      {newOrderPopup && (
        <div style={styles.newOrderOverlay}>
          <div style={styles.newOrderPopup}>
            <div style={styles.newOrderIcon}>🔔</div>
            <h3 style={styles.newOrderTitle}>New Order Received!</h3>
            <p style={styles.newOrderDetail}>
              Order <strong>#{newOrderPopup.order_number}</strong>
            </p>
            {newOrderPopup.customer_name && (
              <p style={styles.newOrderDetail}>
                Customer: <strong>{newOrderPopup.customer_name}</strong>
              </p>
            )}
            <p style={styles.newOrderDetail}>
              Type:&nbsp;
              <strong>
                {newOrderPopup.order_mode === 'delivery' && '🚚 Delivery'}
                {(newOrderPopup.order_mode === 'pick-up' || newOrderPopup.order_mode === 'pickup') && '📦 Pick-up'}
                {newOrderPopup.order_mode === 'dine-in' && '🍽️ Dine-in'}
                {newOrderPopup.order_mode === 'take-out' && '🥡 Take-out'}
                {!['delivery','pick-up','pickup','dine-in','take-out'].includes(newOrderPopup.order_mode) && newOrderPopup.order_mode}
              </strong>
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                style={styles.newOrderViewBtn}
                onClick={() => {
                  setNewOrderPopup(null);
                  setActiveTab('pending');
                  setHasNewOrders(false);
                  fetchPendingOnlineOrders();
                }}
              >
                View Orders
              </button>
              <button
                type="button"
                style={styles.newOrderDismissBtn}
                onClick={() => setNewOrderPopup(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
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
  modalBtPrintBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#4fc3f7',
    border: '1px solid #4fc3f7',
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
  // View Order Modal Styles
  viewOrderModalContent: {
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  viewOrderInfo: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  viewOrderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #444',
  },
  viewOrderSection: {
    marginBottom: '16px',
  },
  viewOrderSectionTitle: {
    fontSize: '16px',
    color: '#ffc107',
    marginBottom: '12px',
    borderBottom: '1px solid #ffc107',
    paddingBottom: '8px',
  },
  viewOrderItemsList: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '12px',
  },
  viewOrderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '12px 0',
    borderBottom: '1px solid #444',
  },
  viewOrderItemName: {
    flex: '1',
    color: '#fff',
  },
  viewOrderItemVariants: {
    fontSize: '12px',
    color: '#888',
    marginTop: '4px',
  },
  viewOrderItemQty: {
    minWidth: '60px',
    textAlign: 'center',
    color: '#ccc',
  },
  viewOrderItemPrice: {
    minWidth: '80px',
    textAlign: 'right',
    color: '#ffc107',
    fontWeight: '600',
  },
  viewOrderTotals: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  viewOrderTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    color: '#ccc',
  },
  viewOrderGrandTotal: {
    borderTop: '2px solid #ffc107',
    marginTop: '8px',
    paddingTop: '12px',
    fontSize: '18px',
    color: '#ffc107',
  },
  viewOrderNotes: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    color: '#ccc',
  },
  viewOrderActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  viewOrderAcceptBtn: {
    flex: '1',
    padding: '12px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'background-color 0.2s',
  },
  viewOrderDeclineBtn: {
    flex: '1',
    padding: '12px 20px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'background-color 0.2s',
  },
  viewOrderBackBtn: {
    flex: '1',
    padding: '12px 20px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'background-color 0.2s',
  },
  proofPreviewBtn: {
    padding: '6px 12px',
    backgroundColor: '#1565c0',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  gcashProofModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '28px',
    width: '100%',
    maxWidth: '560px',
    border: '1px solid #ffc107',
  },
  gcashProofImageWrapper: {
    textAlign: 'center',
    marginTop: '16px',
    backgroundColor: '#0a0a0a',
    borderRadius: '8px',
    padding: '8px',
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  gcashProofImage: {
    maxWidth: '100%',
    maxHeight: '55vh',
    objectFit: 'contain',
    borderRadius: '6px',
  },
  newOrderOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '16px',
  },
  newOrderPopup: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #ffc107',
    borderRadius: '16px',
    padding: '32px 28px',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 0 40px rgba(255, 193, 7, 0.3)',
    animation: 'pulse 1.5s ease-in-out',
  },
  newOrderIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  newOrderTitle: {
    margin: '0 0 16px',
    color: '#ffc107',
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
  },
  newOrderDetail: {
    margin: '4px 0',
    color: '#f5f5f5',
    fontSize: '15px',
  },
  newOrderViewBtn: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: '#ffc107',
    color: '#1a1a1a',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
  },
  newOrderDismissBtn: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
  },
};
