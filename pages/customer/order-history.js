import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function OrderHistory() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [cart, setCart] = useState([]);

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
          console.error('[OrderHistory] Failed to fetch user role:', userError.message);
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

        setLoading(false);
      } catch (err) {
        console.error('[OrderHistory] Session check failed:', err?.message ?? err);
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

  // Fetch and process order history
  useEffect(() => {
    async function fetchOrderHistory() {
      if (!supabase || loading || !user) return;
      
      setLoadingHistory(true);
      try {
        // Fetch all completed orders for the user
        const { data: orders, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['delivered', 'completed'])
          .order('created_at', { ascending: false });

        if (error || !orders) {
          setLoadingHistory(false);
          return;
        }

        // Process orders to extract items and count frequencies
        const itemFrequency = {};
        const itemDetails = {};

        orders.forEach(order => {
          if (!order.items) return;
          
          let items = [];
          try {
            // Handle different item formats
            if (typeof order.items === 'string') {
              items = JSON.parse(order.items);
            } else if (Array.isArray(order.items)) {
              items = order.items;
            }
          } catch (e) {
            console.error('[OrderHistory] Failed to parse items for order:', order.id, 'Raw items:', order.items);
            return;
          }

          if (!Array.isArray(items)) return;

          items.forEach(item => {
            const itemId = item.id || item.menu_item_id;
            const itemName = item.name;
            const quantity = item.quantity || 1;

            if (!itemId || !itemName) {
              console.error('[OrderHistory] Invalid item in order:', order.id, item);
              return;
            }

            if (!itemFrequency[itemId]) {
              itemFrequency[itemId] = 0;
              itemDetails[itemId] = {
                id: itemId,
                name: itemName,
                price: item.price || 0,
                description: item.description || '',
                category: item.category || '',
              };
            }
            itemFrequency[itemId] += quantity;
          });
        });

        // Convert to array and sort by frequency (most ordered first)
        const sortedHistory = Object.keys(itemFrequency).map(itemId => ({
          ...itemDetails[itemId],
          orderCount: itemFrequency[itemId],
        })).sort((a, b) => b.orderCount - a.orderCount);

        setOrderHistory(sortedHistory);
      } catch (err) {
        console.error('[OrderHistory] Failed to fetch order history:', err);
      } finally {
        setLoadingHistory(false);
      }
    }

    fetchOrderHistory();
  }, [loading, user]);

  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setCart(cart.map(cartItem => 
        cartItem.id === item.id 
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(item => 
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
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
        <title>Order History - Bite Bonansa Cafe</title>
        <meta name="description" content="View your order history" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.push('/customer/dashboard')}>
            ← Back
          </button>
          <h1 style={styles.logo}>📋 Order History</h1>
          <span style={styles.cartBadge}>
            🛒 Cart ({cart.length})
          </span>
        </header>

        <main style={styles.main}>
          <div style={styles.content}>
            <div style={styles.historySection}>
              <p style={styles.subtitle}>
                Your most ordered items (sorted by frequency)
              </p>

              {loadingHistory && (
                <p style={styles.loadingText}>Loading order history...</p>
              )}

              {!loadingHistory && orderHistory.length === 0 && (
                <div style={styles.emptyState}>
                  <span style={styles.emptyIcon}>📋</span>
                  <p style={styles.emptyText}>No order history yet</p>
                  <p style={styles.emptySubtext}>
                    Start ordering to see your favorite items here
                  </p>
                  <button 
                    style={styles.orderBtn}
                    onClick={() => router.push('/customer/order')}
                  >
                    Browse Menu
                  </button>
                </div>
              )}

              {!loadingHistory && orderHistory.length > 0 && (
                <div style={styles.itemsGrid}>
                  {orderHistory.map((item, index) => (
                    <HistoryItem 
                      key={item.id} 
                      item={item} 
                      rank={index + 1}
                      onAddToCart={addToCart} 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Cart Sidebar */}
            {cart.length > 0 && (
              <div style={styles.cartSidebar}>
                <h3 style={styles.cartTitle}>Your Cart</h3>
                <div style={styles.cartItems}>
                  {cart.map(item => (
                    <div key={item.id} style={styles.cartItem}>
                      <div style={styles.cartItemInfo}>
                        <span style={styles.cartItemName}>{item.name}</span>
                        <span style={styles.cartItemPrice}>₱{item.price.toFixed(2)}</span>
                      </div>
                      <div style={styles.cartItemControls}>
                        <button 
                          style={styles.quantityBtn}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span style={styles.quantity}>{item.quantity}</span>
                        <button 
                          style={styles.quantityBtn}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                        <button 
                          style={styles.removeBtn}
                          onClick={() => removeFromCart(item.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={styles.cartTotal}>
                  <span style={styles.totalLabel}>Total:</span>
                  <span style={styles.totalAmount}>₱{getTotalPrice().toFixed(2)}</span>
                </div>
                <button 
                  style={styles.checkoutBtn}
                  onClick={() => alert('Checkout feature coming soon! Complete your order at our counter or contact us.')}
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

function HistoryItem({ item, rank, onAddToCart }) {
  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div style={styles.historyItem}>
      <div style={styles.rankBadge}>
        {getMedalEmoji(rank)}
      </div>
      <div style={styles.itemContent}>
        <div style={styles.itemHeader}>
          <h4 style={styles.itemName}>{item.name}</h4>
          <span style={styles.itemPrice}>₱{item.price?.toFixed(2)}</span>
        </div>
        {item.description && (
          <p style={styles.itemDesc}>{item.description}</p>
        )}
        <div style={styles.itemFooter}>
          <span style={styles.orderCount}>
            Ordered {item.orderCount} time{item.orderCount !== 1 ? 's' : ''}
          </span>
          <button 
            style={styles.addBtn}
            onClick={() => onAddToCart(item)}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
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
    flex: 1,
    textAlign: 'center',
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
  cartBadge: {
    color: '#ffc107',
    fontSize: '14px',
    fontWeight: '600',
  },
  main: {
    padding: '24px 32px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  subtitle: {
    fontSize: '14px',
    color: '#999',
    marginBottom: '24px',
    textAlign: 'center',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: '24px',
  },
  historySection: {
    minHeight: '400px',
  },
  loadingText: {
    color: '#aaa',
    fontSize: '14px',
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
    marginBottom: '24px',
  },
  orderBtn: {
    padding: '12px 24px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  historyItem: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    gap: '12px',
    transition: 'all 0.2s',
  },
  rankBadge: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffc107',
    minWidth: '40px',
    textAlign: 'center',
  },
  itemContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  itemName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
    flex: 1,
  },
  itemPrice: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffc107',
    marginLeft: '8px',
  },
  itemDesc: {
    fontSize: '13px',
    color: '#999',
    marginBottom: '12px',
    lineHeight: '1.4',
  },
  itemFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  orderCount: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
  },
  addBtn: {
    padding: '6px 14px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  cartSidebar: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '20px',
    height: 'fit-content',
    position: 'sticky',
    top: '24px',
  },
  cartTitle: {
    fontSize: '18px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '16px',
    marginTop: 0,
  },
  cartItems: {
    maxHeight: '400px',
    overflowY: 'auto',
    marginBottom: '16px',
  },
  cartItem: {
    borderBottom: '1px solid #2a2a2a',
    paddingBottom: '12px',
    marginBottom: '12px',
  },
  cartItemInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  cartItemName: {
    fontSize: '14px',
    color: '#fff',
  },
  cartItemPrice: {
    fontSize: '14px',
    color: '#ffc107',
    fontWeight: '600',
  },
  cartItemControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  quantityBtn: {
    width: '24px',
    height: '24px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: '14px',
    color: '#fff',
    minWidth: '24px',
    textAlign: 'center',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: 'auto',
  },
  cartTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '2px solid #ffc107',
    marginBottom: '16px',
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  totalAmount: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffc107',
  },
  checkoutBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
