import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import useCartStore from '../../store/useCartStore';
import { getUserRole, ROLES, canAccessPage } from '../../utils/roleGuard';

// ─── Customer: Menu & Ordering ────────────────────────────────────────────────
// Browse menu items, add to cart, and place orders.
// Auth-guarded: redirects to /login if no active session.
// Role-guarded: only customers can access this page.

export default function CustomerMenuPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cartOpen, setCartOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null); // 'success' | 'error' | null
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const { items, addItem, removeItem, updateQuantity, clearCart, getTotalPrice } =
    useCartStore();

  // ── Auth & Role guard ──────────────────────────────────────────────────────────────
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
        const roleData = await getUserRole();
        if (!roleData || !canAccessPage(roleData.role, '/customer/menu')) {
          // User doesn't have permission, redirect to their default page
          if (roleData?.role === ROLES.ADMIN) {
            router.replace('/dashboard');
          } else if (roleData?.role === ROLES.CASHIER) {
            router.replace('/cashier');
          } else if (roleData?.role === ROLES.RIDER) {
            router.replace('/rider/deliveries');
          } else {
            router.replace('/login');
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
          status: 'pending',
        });
        if (error) throw error;
        setOrderStatus('success');
        clearCart();
        setTimeout(() => setOrderStatus(null), 3000);
      }
    } catch (err) {
      console.error('[Checkout] Error placing order:', err);
      setOrderStatus('error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ── Get unique categories ───────────────────────────────────────────────────
  const categories = ['All', ...new Set(menuItems.map(item => item.category).filter(Boolean))];

  // ── Filter items by category ────────────────────────────────────────────────
  const filteredItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

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
        <title>Menu - Bite Bonansa Cafe</title>
        <meta name="description" content="Browse our menu and place your order" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setCartOpen(true)}
              style={styles.cartBtn}
            >
              🛒 Cart ({items.length})
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              style={styles.backBtn}
            >
              Dashboard
            </button>
          </div>
        </header>

        <main style={styles.main}>
          <h2 style={styles.pageTitle}>Our Menu</h2>

          {/* Category Filter */}
          <div style={styles.categoryFilter}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  ...styles.categoryBtn,
                  ...(selectedCategory === cat ? styles.categoryBtnActive : {}),
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu Grid */}
          {menuLoading ? (
            <p style={{ color: '#ccc', textAlign: 'center' }}>Loading menu...</p>
          ) : filteredItems.length === 0 ? (
            <p style={{ color: '#ccc', textAlign: 'center' }}>No items available</p>
          ) : (
            <div style={styles.grid}>
              {filteredItems.map(item => (
                <div key={item.id} style={styles.card}>
                  <h3 style={styles.itemName}>{item.name}</h3>
                  <p style={styles.itemCategory}>{item.category}</p>
                  <p style={styles.itemPrice}>₱{Number(item.price).toFixed(2)}</p>
                  <button
                    onClick={() => addItem({
                      id: item.id,
                      name: item.name,
                      price: item.price,
                      quantity: 1,
                    })}
                    style={styles.addBtn}
                  >
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Cart Sidebar */}
        {cartOpen && (
          <div style={styles.cartOverlay} onClick={() => setCartOpen(false)}>
            <div style={styles.cartSidebar} onClick={(e) => e.stopPropagation()}>
              <div style={styles.cartHeader}>
                <h2 style={styles.cartTitle}>Your Cart</h2>
                <button onClick={() => setCartOpen(false)} style={styles.closeBtn}>
                  ✕
                </button>
              </div>

              <div style={styles.cartItems}>
                {items.length === 0 ? (
                  <p style={{ color: '#ccc', textAlign: 'center' }}>Cart is empty</p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} style={styles.cartItem}>
                      <div>
                        <div style={styles.cartItemName}>{item.name}</div>
                        <div style={styles.cartItemPrice}>
                          ₱{Number(item.price).toFixed(2)} × {item.quantity}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          style={styles.qtyBtn}
                        >
                          −
                        </button>
                        <span style={{ color: '#fff' }}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          style={styles.qtyBtn}
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          style={styles.removeBtn}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div style={styles.cartFooter}>
                  <div style={styles.totalRow}>
                    <span style={styles.totalLabel}>Total:</span>
                    <span style={styles.totalAmount}>₱{getTotalPrice().toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={checkoutLoading}
                    style={styles.checkoutBtn}
                  >
                    {checkoutLoading ? 'Placing Order...' : 'Place Order'}
                  </button>
                  {orderStatus === 'success' && (
                    <p style={{ color: '#4caf50', marginTop: '8px', textAlign: 'center' }}>
                      ✓ Order placed successfully!
                    </p>
                  )}
                  {orderStatus === 'error' && (
                    <p style={{ color: '#f44336', marginTop: '8px', textAlign: 'center' }}>
                      ✗ Failed to place order. Please try again.
                    </p>
                  )}
                </div>
              )}
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
  cartBtn: {
    padding: '8px 18px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
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
    padding: '40px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  pageTitle: {
    fontSize: '28px',
    color: '#ffc107',
    textAlign: 'center',
    marginBottom: '24px',
  },
  categoryFilter: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '32px',
  },
  categoryBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '20px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
  categoryBtnActive: {
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    borderColor: '#ffc107',
    fontWeight: '700',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '20px',
  },
  card: {
    padding: '24px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    transition: 'all 0.2s',
  },
  itemName: {
    fontSize: '18px',
    color: '#fff',
    marginBottom: '8px',
  },
  itemCategory: {
    fontSize: '12px',
    color: '#999',
    marginBottom: '12px',
  },
  itemPrice: {
    fontSize: '20px',
    color: '#ffc107',
    fontWeight: '700',
    marginBottom: '16px',
  },
  addBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  cartOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 100,
  },
  cartSidebar: {
    position: 'fixed',
    right: 0,
    top: 0,
    bottom: 0,
    width: '400px',
    maxWidth: '90vw',
    backgroundColor: '#1a1a1a',
    borderLeft: '1px solid #ffc107',
    display: 'flex',
    flexDirection: 'column',
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #333',
  },
  cartTitle: {
    fontSize: '20px',
    color: '#ffc107',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
  },
  cartItems: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  cartItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0',
    borderBottom: '1px solid #333',
  },
  cartItemName: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  cartItemPrice: {
    color: '#999',
    fontSize: '12px',
  },
  qtyBtn: {
    width: '28px',
    height: '28px',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
  },
  cartFooter: {
    padding: '20px',
    borderTop: '1px solid #333',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  totalLabel: {
    fontSize: '18px',
    color: '#fff',
    fontWeight: '700',
  },
  totalAmount: {
    fontSize: '18px',
    color: '#ffc107',
    fontWeight: '700',
  },
  checkoutBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
