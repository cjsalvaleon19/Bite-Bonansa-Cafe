import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import useCartStore from '../../store/useCartStore';

// ─── Cashier / POS Page ───────────────────────────────────────────────────────
// Allows cashier staff to browse menu items, build an order in the cart, and
// submit the order. Auth-guarded: redirects to /login if no active session.

export default function CashierPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null); // 'success' | 'error' | null
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [customerIdInput, setCustomerIdInput] = useState('');

  const { items, addItem, removeItem, updateQuantity, clearCart, getTotalPrice } =
    useCartStore();

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      if (!supabase) {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!session) { router.replace('/login'); return; }
        
        // Check user role
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (!mounted) return;
        
        if (userError) {
          console.error('[CashierPage] Failed to fetch user role:', userError.message);
          setAuthLoading(false);
          router.replace('/login');
          return;
        }
        
        const role = userData?.role || 'customer';
        
        // Redirect non-cashier users to their appropriate portal
        if (role !== 'cashier') {
          if (role === 'admin') {
            router.replace('/dashboard');
          } else if (role === 'rider') {
            router.replace('/rider/dashboard');
          } else {
            router.replace('/customer/dashboard');
          }
          return;
        }
        
        setAuthLoading(false);
      } catch {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
      }
    }
    checkSession();
    return () => { mounted = false; };
  }, [router]);

  // ── Fetch menu items from Supabase ──────────────────────────────────────────
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
    } catch {
      // Non-fatal; the table may not exist yet.
    } finally {
      setMenuLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchMenu();
  }, [authLoading, fetchMenu]);

  // ── Submit order ────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (items.length === 0) return;
    setCheckoutLoading(true);
    setOrderStatus(null);
    try {
      if (supabase) {
        const { error } = await supabase.from('orders').insert({
          items: items.map(({ id, name, price, quantity }) => ({
            id, name, price, quantity,
          })),
          total: getTotalPrice(),
          customer_id: customerIdInput.trim() || null,
          status: 'pending',
        });
        if (error) throw error;
      }
      clearCart();
      setCustomerIdInput('');
      setOrderStatus('success');
    } catch {
      setOrderStatus('error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ── Loading / guard state ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
          ⏳ Loading…
        </p>
      </div>
    );
  }

  const totalPrice = getTotalPrice();

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <h1 style={styles.logo}>☕ Cashier / POS</h1>
        <button style={styles.backBtn} onClick={() => router.push('/dashboard').catch(console.error)}>
          ← Dashboard
        </button>
      </header>

      <div style={styles.body}>
        {/* ── Menu panel ─────────────────────────────────────────────────── */}
        <section style={styles.menuPanel}>
          <h2 style={styles.sectionTitle}>Menu Items</h2>

          {!supabase && (
            <p style={styles.notice}>
              ⚠️ Supabase is not configured. Connect your database to load live
              menu data.
            </p>
          )}

          {menuLoading && (
            <p style={{ color: '#aaa', fontSize: '14px' }}>Loading menu…</p>
          )}

          {!menuLoading && menuItems.length === 0 && supabase && (
            <p style={{ color: '#aaa', fontSize: '14px' }}>
              No available menu items found. Add items via the Menu admin page.
            </p>
          )}

          <div style={styles.menuGrid}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                style={styles.menuCard}
                onClick={() => addItem(item)}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#ffb300';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,193,7,0.35)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#ffc107';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,193,7,0.15)';
                }}
              >
                <span style={styles.menuItemName}>{item.name}</span>
                <span style={styles.menuItemCategory}>{item.category}</span>
                <span style={styles.menuItemPrice}>₱{Number(item.price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Order / Cart panel ─────────────────────────────────────────── */}
        <section style={styles.cartPanel}>
          <h2 style={styles.sectionTitle}>Current Order</h2>

          <label style={styles.label} htmlFor="customerId">Customer ID (optional)</label>
          <input
            id="customerId"
            style={styles.input}
            type="text"
            placeholder="BBC-XXXXX"
            value={customerIdInput}
            onChange={(e) => setCustomerIdInput(e.target.value)}
          />

          {items.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: '14px', marginTop: '16px' }}>
              No items added yet. Click a menu item to add it.
            </p>
          ) : (
            <ul style={styles.cartList}>
              {items.map((item) => (
                <li key={item.id} style={styles.cartItem}>
                  <span style={styles.cartItemName}>{item.name}</span>
                  <div style={styles.cartControls}>
                    <button
                      style={styles.qtyBtn}
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span style={styles.qtyValue}>{item.quantity}</span>
                    <button
                      style={styles.qtyBtn}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                    <span style={styles.cartItemPrice}>
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      style={styles.removeBtn}
                      onClick={() => removeItem(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Total</span>
            <span style={styles.totalValue}>₱{totalPrice.toFixed(2)}</span>
          </div>

          {orderStatus === 'success' && (
            <p style={styles.successMsg}>✅ Order placed successfully!</p>
          )}
          {orderStatus === 'error' && (
            <p style={styles.errorMsg}>❌ Failed to place order. Please try again.</p>
          )}

          <div style={styles.cartActions}>
            <button
              style={styles.clearBtn}
              onClick={clearCart}
              disabled={items.length === 0}
            >
              Clear
            </button>
            <button
              style={{
                ...styles.checkoutBtn,
                opacity: items.length === 0 || checkoutLoading ? 0.6 : 1,
              }}
              onClick={handleCheckout}
              disabled={items.length === 0 || checkoutLoading}
            >
              {checkoutLoading ? '⏳ Processing…' : '✔ Place Order'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  body: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: '24px',
    padding: '32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  menuPanel: {
    minWidth: 0,
  },
  cartPanel: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    alignSelf: 'start',
  },
  sectionTitle: {
    fontSize: '18px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '16px',
  },
  notice: {
    color: '#ffb300',
    fontSize: '13px',
    marginBottom: '16px',
    backgroundColor: 'rgba(255,193,7,0.1)',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255,193,7,0.3)',
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
  },
  menuCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(255,193,7,0.15)',
    transition: 'all 0.15s',
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
    textAlign: 'left',
  },
  menuItemName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '4px',
  },
  menuItemCategory: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '8px',
  },
  menuItemPrice: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#ffc107',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#aaa',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #444',
    borderRadius: '6px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  cartList: {
    listStyle: 'none',
    padding: 0,
    margin: '16px 0 0',
  },
  cartItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #2a2a2a',
    gap: '8px',
  },
  cartItemName: {
    fontSize: '13px',
    color: '#fff',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cartControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  qtyBtn: {
    width: '24px',
    height: '24px',
    backgroundColor: '#2a2a2a',
    color: '#ffc107',
    border: '1px solid #444',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: 0,
  },
  qtyValue: {
    fontSize: '13px',
    color: '#fff',
    minWidth: '20px',
    textAlign: 'center',
  },
  cartItemPrice: {
    fontSize: '13px',
    color: '#ffc107',
    minWidth: '52px',
    textAlign: 'right',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 4px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px',
    paddingTop: '12px',
    borderTop: '1px solid #333',
  },
  totalLabel: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ccc',
  },
  totalValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffc107',
  },
  successMsg: {
    color: '#4caf50',
    fontSize: '13px',
    marginTop: '12px',
  },
  errorMsg: {
    color: '#f44336',
    fontSize: '13px',
    marginTop: '12px',
  },
  cartActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px',
  },
  clearBtn: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  checkoutBtn: {
    flex: 2,
    padding: '10px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
