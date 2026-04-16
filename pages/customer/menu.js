import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import { create } from 'zustand';

// Shopping cart store
const useCartStore = create((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      const existingItem = state.items.find((i) => i.id === item.id);
      if (existingItem) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity: 1 }] };
    }),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  updateQuantity: (id, quantity) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, quantity) } : i
      ).filter((i) => i.quantity > 0),
    })),
  clearCart: () => set({ items: [] }),
  getTotal: () => {
    const state = useCartStore.getState();
    return state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
}));

export default function CustomerMenu() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cartOpen, setCartOpen] = useState(false);

  const cart = useCartStore();

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      if (!supabase) {
        if (mounted) {
          setAuthLoading(false);
          router.replace('/login');
        }
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!session) {
          router.replace('/login');
          return;
        }
        setUser(session.user);
        setAuthLoading(false);
      } catch {
        if (mounted) {
          setAuthLoading(false);
          router.replace('/login');
        }
      }
    }
    checkSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  // ── Fetch menu items ────────────────────────────────────────────────────────
  const fetchMenuItems = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category, price, available, description')
        .eq('available', true)
        .order('category');
      if (!error && data) setMenuItems(data);
    } catch (err) {
      console.error('[CustomerMenu] Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchMenuItems();
  }, [authLoading, fetchMenuItems]);

  const categories = ['all', ...new Set(menuItems.map((item) => item.category).filter(Boolean))];

  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((item) => item.category === selectedCategory);

  if (authLoading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>⏳ Loading…</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Menu - Bite Bonansa Cafe</title>
        <meta name="description" content="Browse our delicious menu and place your order" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <div style={styles.headerActions}>
            <button
              onClick={() => setCartOpen(true)}
              style={styles.cartBtn}
            >
              🛒 Cart ({cart.items.length})
            </button>
            <button
              onClick={() => router.push('/dashboard').catch(console.error)}
              style={styles.backBtn}
            >
              ← Dashboard
            </button>
          </div>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>Our Menu</h2>

          {/* Category Filter */}
          <div style={styles.categoryBar}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  ...styles.categoryBtn,
                  backgroundColor: selectedCategory === cat ? '#ffc107' : 'transparent',
                  color: selectedCategory === cat ? '#0a0a0a' : '#ffc107',
                }}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          {loading ? (
            <div style={styles.loadingState}>
              <p style={{ color: '#ffc107' }}>⏳ Loading menu...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🍽️</div>
              <h3 style={styles.emptyTitle}>No items available</h3>
              <p style={styles.emptyText}>Check back later for delicious offerings!</p>
            </div>
          ) : (
            <div style={styles.menuGrid}>
              {filteredItems.map((item) => (
                <div key={item.id} style={styles.menuCard}>
                  <div style={styles.menuCardHeader}>
                    <h3 style={styles.itemName}>{item.name}</h3>
                    {item.category && (
                      <span style={styles.categoryBadge}>{item.category}</span>
                    )}
                  </div>
                  {item.description && (
                    <p style={styles.itemDescription}>{item.description}</p>
                  )}
                  <div style={styles.menuCardFooter}>
                    <span style={styles.itemPrice}>₱{item.price.toFixed(2)}</span>
                    <button
                      onClick={() => cart.addItem(item)}
                      style={styles.addBtn}
                    >
                      + Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Shopping Cart Modal */}
        {cartOpen && (
          <div style={styles.cartOverlay} onClick={() => setCartOpen(false)}>
            <div style={styles.cartModal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.cartHeader}>
                <h3 style={styles.cartTitle}>Shopping Cart</h3>
                <button onClick={() => setCartOpen(false)} style={styles.closeBtn}>
                  ✕
                </button>
              </div>

              {cart.items.length === 0 ? (
                <div style={styles.emptyCart}>
                  <p style={{ color: '#999' }}>Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div style={styles.cartItems}>
                    {cart.items.map((item) => (
                      <div key={item.id} style={styles.cartItem}>
                        <div style={styles.cartItemInfo}>
                          <span style={styles.cartItemName}>{item.name}</span>
                          <span style={styles.cartItemPrice}>
                            ₱{item.price.toFixed(2)} × {item.quantity}
                          </span>
                        </div>
                        <div style={styles.cartItemActions}>
                          <button
                            onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                            style={styles.qtyBtn}
                          >
                            −
                          </button>
                          <span style={styles.qtyDisplay}>{item.quantity}</span>
                          <button
                            onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                            style={styles.qtyBtn}
                          >
                            +
                          </button>
                          <button
                            onClick={() => cart.removeItem(item.id)}
                            style={styles.removeBtn}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.cartFooter}>
                    <div style={styles.cartTotal}>
                      <span style={styles.totalLabel}>Total:</span>
                      <span style={styles.totalAmount}>₱{cart.getTotal().toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => {
                        setCartOpen(false);
                        router.push('/customer/checkout').catch(console.error);
                      }}
                      style={styles.checkoutBtn}
                    >
                      Proceed to Checkout
                    </button>
                    <button
                      onClick={() => cart.clearCart()}
                      style={styles.clearBtn}
                    >
                      Clear Cart
                    </button>
                  </div>
                </>
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
  headerActions: {
    display: 'flex',
    gap: '12px',
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
    maxWidth: '1400px',
    margin: '0 auto',
  },
  title: {
    fontSize: '28px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '30px',
  },
  categoryBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '30px',
    flexWrap: 'wrap',
  },
  categoryBtn: {
    padding: '10px 20px',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
  loadingState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  emptyTitle: {
    fontSize: '24px',
    color: '#ffc107',
    marginBottom: '12px',
    fontFamily: "'Playfair Display', serif",
  },
  emptyText: {
    color: '#999',
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  menuCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'all 0.2s',
  },
  menuCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  itemName: {
    fontSize: '18px',
    color: '#ffc107',
    fontWeight: '600',
    margin: 0,
    fontFamily: "'Playfair Display', serif",
  },
  categoryBadge: {
    padding: '4px 8px',
    backgroundColor: '#2a2a2a',
    color: '#999',
    borderRadius: '4px',
    fontSize: '11px',
    whiteSpace: 'nowrap',
  },
  itemDescription: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
    lineHeight: '1.5',
  },
  menuCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: '12px',
  },
  itemPrice: {
    fontSize: '20px',
    color: '#ffc107',
    fontWeight: '700',
  },
  addBtn: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  cartOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  cartModal: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #333',
  },
  cartTitle: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  emptyCart: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  cartItems: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cartItem: {
    padding: '12px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartItemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cartItemName: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
  },
  cartItemPrice: {
    color: '#999',
    fontSize: '12px',
  },
  cartItemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  qtyBtn: {
    width: '28px',
    height: '28px',
    backgroundColor: '#2a2a2a',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '700',
  },
  qtyDisplay: {
    minWidth: '30px',
    textAlign: 'center',
    color: '#fff',
    fontSize: '14px',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
  },
  cartFooter: {
    borderTop: '1px solid #333',
    paddingTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cartTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  totalLabel: {
    fontSize: '18px',
    color: '#999',
  },
  totalAmount: {
    fontSize: '24px',
    color: '#ffc107',
    fontWeight: '700',
  },
  checkoutBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  clearBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#999',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
