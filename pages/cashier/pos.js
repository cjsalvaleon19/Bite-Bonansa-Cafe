import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import useCartStore from '../../store/useCartStore';
import { useRoleGuard } from '../../utils/useRoleGuard';

const DELIVERY_FEE_DEFAULT = 30;
const VAT_RATE = 0; // Currently disabled as per requirements

export default function CashierPOS() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Order details
  const [orderMode, setOrderMode] = useState('dine-in');
  const [customerInfo, setCustomerInfo] = useState({
    customerId: '',
    customerName: 'Walk-in',
    address: '',
    contactNumber: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDetails, setPaymentDetails] = useState({
    cashTendered: '',
    gcashReference: '',
  });
  const [pointsToUse, setPointsToUse] = useState(0);
  const [customerPointsBalance, setCustomerPointsBalance] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);

  const { items, addItem, removeItem, updateQuantity, clearCart, getTotalPrice } =
    useCartStore();

  useEffect(() => {
    if (!authLoading) fetchMenu();
  }, [authLoading]);

  useEffect(() => {
    if (orderMode === 'delivery') {
      setDeliveryFee(DELIVERY_FEE_DEFAULT);
    } else {
      setDeliveryFee(0);
    }
  }, [orderMode]);

  const fetchMenu = useCallback(async () => {
    if (!supabase) return;
    setMenuLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, price, category, available')
        .eq('available', true)
        .order('category');
      if (!error && data) setMenuItems(data);
    } catch (err) {
      console.error('[POS] Failed to fetch menu:', err?.message ?? err);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const fetchCustomerData = async (customerId) => {
    if (!supabase || !customerId) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, phone, address')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Fetch loyalty balance from transactions
        const { data: transactions, error: transError } = await supabase
          .from('loyalty_transactions')
          .select('amount')
          .eq('customer_id', data.id);

        const loyaltyBalance = (!transError && transactions) 
          ? transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) 
          : 0;

        setCustomerInfo({
          ...customerInfo,
          customerId: customerId,
          customerName: data.full_name || 'Customer',
          address: data.address || '',
          contactNumber: data.phone || '',
        });
        setCustomerPointsBalance(loyaltyBalance);
      }
    } catch (err) {
      console.error('[POS] Failed to fetch customer data:', err?.message ?? err);
      alert('Customer not found');
    }
  };

  const handleCustomerIdChange = (value) => {
    setCustomerInfo({ ...customerInfo, customerId: value });
    if (value && value.length >= 5) {
      fetchCustomerData(value);
    } else {
      setCustomerInfo({
        customerId: value,
        customerName: 'Walk-in',
        address: '',
        contactNumber: '',
      });
      setCustomerPointsBalance(0);
      setPointsToUse(0);
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      alert('Please add items to the cart');
      return;
    }

    const subtotal = getTotalPrice();
    const vatAmount = subtotal * VAT_RATE;
    const totalAmount = subtotal + vatAmount + deliveryFee - pointsToUse;

    // Validate payment
    if (paymentMethod === 'cash') {
      const cashTendered = parseFloat(paymentDetails.cashTendered || 0);
      const change = cashTendered - totalAmount;
      if (change < 0) {
        alert('Insufficient cash tendered. Change must be >= 0');
        return;
      }
    }

    if (paymentMethod === 'gcash' && !paymentDetails.gcashReference) {
      alert('Please enter GCash reference number');
      return;
    }

    if (paymentMethod === 'points') {
      if (pointsToUse > customerPointsBalance) {
        alert('Insufficient points balance');
        return;
      }
      if (pointsToUse > totalAmount) {
        alert('Points to use cannot exceed total amount');
        return;
      }
    }

    setCheckoutLoading(true);
    setOrderStatus(null);

    try {
      if (!supabase) throw new Error('Database not available');

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const orderData = {
        order_number: orderNumber,
        items: items.map(({ id, name, price, quantity }) => ({
          id,
          name,
          price,
          quantity,
        })),
        order_mode: orderMode,
        customer_name: customerInfo.customerName,
        customer_id: customerInfo.customerId || null,
        delivery_address: orderMode === 'delivery' ? customerInfo.address : null,
        contact_number: customerInfo.contactNumber || null,
        subtotal: subtotal,
        vat_amount: vatAmount,
        delivery_fee: deliveryFee,
        points_used: pointsToUse,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        cash_amount: paymentMethod === 'cash' ? parseFloat(paymentDetails.cashTendered || 0) : 0,
        gcash_amount: paymentMethod === 'gcash' ? totalAmount : 0,
        gcash_reference: paymentMethod === 'gcash' ? paymentDetails.gcashReference : null,
        status: 'order_in_queue',
        created_at: new Date().toISOString(),
      };

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      // Generate receipt (simple print)
      printReceipt(order, orderNumber);

      // Clear form
      clearCart();
      setCustomerInfo({
        customerId: '',
        customerName: 'Walk-in',
        address: '',
        contactNumber: '',
      });
      setPaymentDetails({
        cashTendered: '',
        gcashReference: '',
      });
      setPointsToUse(0);
      setCustomerPointsBalance(0);
      setOrderMode('dine-in');
      setPaymentMethod('cash');

      setOrderStatus('success');
      setTimeout(() => setOrderStatus(null), 3000);
    } catch (err) {
      console.error('[POS] Checkout failed:', err?.message ?? err);
      setOrderStatus('error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const printReceipt = (order, orderNumber) => {
    const receiptWindow = window.open('', '_blank', 'width=300,height=600');
    if (!receiptWindow) return;

    const cashTendered = parseFloat(paymentDetails.cashTendered || 0);
    const change = cashTendered - order.total_amount;

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${orderNumber}</title>
          <style>
            body { font-family: monospace; font-size: 12px; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .items { margin: 20px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .footer { border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; }
            .total { font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Bite Bonansa Cafe</h2>
            <p><strong>Order #${orderNumber}</strong></p>
            <p>${new Date().toLocaleString()}</p>
            <p>Mode: ${order.order_mode}</p>
            <p>Customer: ${order.customer_name}</p>
          </div>
          <div class="items">
            ${order.items.map(item => `
              <div class="item">
                <span>${item.name} x${item.quantity}</span>
                <span>₱${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          <div class="footer">
            <div class="item"><span>Subtotal:</span><span>₱${order.subtotal.toFixed(2)}</span></div>
            ${order.vat_amount > 0 ? `<div class="item"><span>VAT:</span><span>₱${order.vat_amount.toFixed(2)}</span></div>` : ''}
            ${order.delivery_fee > 0 ? `<div class="item"><span>Delivery Fee:</span><span>₱${order.delivery_fee.toFixed(2)}</span></div>` : ''}
            ${order.points_used > 0 ? `<div class="item"><span>Less: Points:</span><span>-₱${order.points_used.toFixed(2)}</span></div>` : ''}
            <div class="item total"><span>Net Amount:</span><span>₱${order.total_amount.toFixed(2)}</span></div>
            ${paymentMethod === 'cash' ? `
              <div class="item"><span>Cash Tendered:</span><span>₱${cashTendered.toFixed(2)}</span></div>
              <div class="item"><span>Change:</span><span>₱${change.toFixed(2)}</span></div>
            ` : ''}
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p>Thank you for your order!</p>
          </div>
        </body>
      </html>
    `);

    receiptWindow.document.close();
    setTimeout(() => {
      receiptWindow.print();
    }, 250);
  };

  if (authLoading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107' }}>⏳ Loading…</p>
      </div>
    );
  }

  const subtotal = getTotalPrice();
  const vatAmount = subtotal * VAT_RATE;
  const totalBeforePayment = subtotal + vatAmount + deliveryFee;
  const netAmount = totalBeforePayment - pointsToUse;
  const cashTendered = parseFloat(paymentDetails.cashTendered || 0);
  const change = paymentMethod === 'cash' ? cashTendered - netAmount : 0;

  return (
    <>
      <Head>
        <title>POS - Bite Bonansa Cafe</title>
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Point of Sale</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
          </nav>
          <button style={styles.logoutBtn} onClick={async () => {
            if (supabase) await supabase.auth.signOut();
            router.replace('/login');
          }}>
            Logout
          </button>
        </header>

        <div style={styles.body}>
          <section style={styles.menuPanel}>
            <h2 style={styles.sectionTitle}>Menu Items</h2>
            {menuLoading && <p style={styles.loadingText}>Loading menu…</p>}
            {!menuLoading && menuItems.length === 0 && <p style={styles.emptyText}>No menu items available</p>}
            <div style={styles.menuGrid}>
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  style={styles.menuCard}
                  onClick={() => addItem(item)}
                >
                  <span style={styles.menuItemName}>{item.name}</span>
                  <span style={styles.menuItemCategory}>{item.category}</span>
                  <span style={styles.menuItemPrice}>₱{Number(item.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </section>

          <section style={styles.orderPanel}>
            <h2 style={styles.sectionTitle}>Current Order</h2>

            <div style={styles.formGroup}>
              <label style={styles.label}>Order Mode</label>
              <select style={styles.input} value={orderMode} onChange={(e) => setOrderMode(e.target.value)}>
                <option value="dine-in">🍽️ Dine-in</option>
                <option value="take-out">🥡 Take-out</option>
                <option value="pick-up">📦 Pick-up</option>
                <option value="delivery">🚚 Delivery</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Customer ID</label>
              <input
                style={styles.input}
                type="text"
                placeholder="BBC-XXXXX"
                value={customerInfo.customerId}
                onChange={(e) => handleCustomerIdChange(e.target.value)}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Customer Name</label>
              <input
                style={styles.input}
                type="text"
                value={customerInfo.customerName}
                onChange={(e) => setCustomerInfo({ ...customerInfo, customerName: e.target.value })}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Contact Number</label>
              <input
                style={styles.input}
                type="tel"
                placeholder="09XXXXXXXXX"
                value={customerInfo.contactNumber}
                onChange={(e) => setCustomerInfo({ ...customerInfo, contactNumber: e.target.value })}
              />
            </div>

            {orderMode === 'delivery' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Delivery Address *</label>
                <textarea
                  style={{ ...styles.input, minHeight: '60px' }}
                  placeholder="Enter delivery address"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  required
                />
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Payment Method</label>
              <select style={styles.input} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">💰 Cash</option>
                <option value="gcash">📱 GCash</option>
                <option value="points">🎁 Points</option>
              </select>
            </div>

            {paymentMethod === 'gcash' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>GCash Reference Number *</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Enter GCash reference"
                  value={paymentDetails.gcashReference}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, gcashReference: e.target.value })}
                  required
                />
              </div>
            )}

            {paymentMethod === 'points' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Points Balance: ₱{customerPointsBalance.toFixed(2)}</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.01"
                  placeholder="Points to use"
                  value={pointsToUse}
                  onChange={(e) => setPointsToUse(parseFloat(e.target.value) || 0)}
                  max={Math.min(customerPointsBalance, totalBeforePayment)}
                />
              </div>
            )}

            <div style={styles.cartSection}>
              <h3 style={styles.cartTitle}>Cart Items</h3>
              {items.length === 0 ? (
                <p style={styles.emptyText}>No items added</p>
              ) : (
                <ul style={styles.cartList}>
                  {items.map((item) => (
                    <li key={item.id} style={styles.cartItem}>
                      <span style={styles.cartItemName}>{item.name}</span>
                      <div style={styles.cartControls}>
                        <button style={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                        <span style={styles.qtyValue}>{item.quantity}</span>
                        <button style={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                        <span style={styles.cartItemPrice}>₱{(item.price * item.quantity).toFixed(2)}</span>
                        <button style={styles.removeBtn} onClick={() => removeItem(item.id)}>✕</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={styles.totalsSection}>
              <div style={styles.totalRow}><span>Subtotal:</span><span>₱{subtotal.toFixed(2)}</span></div>
              <div style={styles.totalRow}><span>VAT (disabled):</span><span>₱{vatAmount.toFixed(2)}</span></div>
              {deliveryFee > 0 && <div style={styles.totalRow}><span>Delivery Fee:</span><span>₱{deliveryFee.toFixed(2)}</span></div>}
              {pointsToUse > 0 && <div style={styles.totalRow}><span>Less: Points:</span><span>-₱{pointsToUse.toFixed(2)}</span></div>}
              <div style={{ ...styles.totalRow, ...styles.netAmountRow }}><span>Net Amount:</span><span>₱{netAmount.toFixed(2)}</span></div>
            </div>

            {paymentMethod === 'cash' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Cash Tendered *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentDetails.cashTendered}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, cashTendered: e.target.value })}
                  required
                />
                <div style={styles.changeDisplay}>
                  Change: ₱{change >= 0 ? change.toFixed(2) : '0.00'}
                  {change < 0 && <span style={styles.errorText}> (Insufficient)</span>}
                </div>
              </div>
            )}

            {orderStatus === 'success' && <p style={styles.successMsg}>✅ Order placed successfully!</p>}
            {orderStatus === 'error' && <p style={styles.errorMsg}>❌ Failed to place order</p>}

            <div style={styles.cartActions}>
              <button style={styles.clearBtn} onClick={clearCart} disabled={items.length === 0}>Clear</button>
              <button
                style={{ ...styles.checkoutBtn, opacity: items.length === 0 || checkoutLoading ? 0.6 : 1 }}
                onClick={handleCheckout}
                disabled={items.length === 0 || checkoutLoading}
              >
                {checkoutLoading ? '⏳ Processing…' : '✔ Checkout'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', fontFamily: "'Poppins', sans-serif", color: '#fff' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', backgroundColor: '#1a1a1a', borderBottom: '1px solid #ffc107', gap: '24px' },
  logo: { fontSize: '22px', fontFamily: "'Playfair Display', serif", color: '#ffc107', margin: 0, whiteSpace: 'nowrap' },
  nav: { display: 'flex', gap: '16px', flex: 1, justifyContent: 'center' },
  navLink: { color: '#ccc', textDecoration: 'none', fontSize: '14px', padding: '8px 12px', borderRadius: '6px' },
  logoutBtn: { padding: '8px 18px', backgroundColor: 'transparent', color: '#ffc107', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  body: { display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px', padding: '32px', maxWidth: '1400px', margin: '0 auto' },
  menuPanel: { minWidth: 0 },
  orderPanel: { backgroundColor: '#1a1a1a', border: '1px solid #ffc107', borderRadius: '12px', padding: '24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' },
  sectionTitle: { fontSize: '18px', fontFamily: "'Playfair Display', serif", color: '#ffc107', marginTop: 0, marginBottom: '16px' },
  loadingText: { color: '#aaa', fontSize: '14px' },
  emptyText: { color: '#aaa', fontSize: '14px' },
  menuGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' },
  menuCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px', backgroundColor: '#1a1a1a', border: '1px solid #ffc107', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', color: '#fff', textAlign: 'left' },
  menuItemName: { fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '4px' },
  menuItemCategory: { fontSize: '11px', color: '#888', marginBottom: '8px' },
  menuItemPrice: { fontSize: '15px', fontWeight: '700', color: '#ffc107' },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #444', borderRadius: '6px', backgroundColor: '#2a2a2a', color: '#fff', fontSize: '13px', boxSizing: 'border-box', outline: 'none' },
  cartSection: { marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a2a2a' },
  cartTitle: { fontSize: '14px', color: '#ffc107', margin: '0 0 12px 0' },
  cartList: { listStyle: 'none', padding: 0, margin: '0 0 16px 0' },
  cartItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2a2a', gap: '8px' },
  cartItemName: { fontSize: '13px', color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cartControls: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  qtyBtn: { width: '24px', height: '24px', backgroundColor: '#2a2a2a', color: '#ffc107', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 },
  qtyValue: { fontSize: '13px', color: '#fff', minWidth: '20px', textAlign: 'center' },
  cartItemPrice: { fontSize: '13px', color: '#ffc107', minWidth: '52px', textAlign: 'right' },
  removeBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' },
  totalsSection: { marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #2a2a2a' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ccc', marginBottom: '6px' },
  netAmountRow: { fontSize: '16px', fontWeight: '700', color: '#ffc107', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ffc107' },
  changeDisplay: { marginTop: '8px', fontSize: '14px', color: '#4caf50', fontWeight: '600' },
  errorText: { color: '#f44336' },
  successMsg: { color: '#4caf50', fontSize: '13px', marginTop: '12px' },
  errorMsg: { color: '#f44336', fontSize: '13px', marginTop: '12px' },
  cartActions: { display: 'flex', gap: '10px', marginTop: '16px' },
  clearBtn: { flex: 1, padding: '10px', backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
  checkoutBtn: { flex: 2, padding: '10px', backgroundColor: '#ffc107', color: '#0a0a0a', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
};
