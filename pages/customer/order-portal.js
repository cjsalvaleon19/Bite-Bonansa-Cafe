import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import VariantSelectionModal from '../../components/VariantSelectionModal';

export default function OrderPortal() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (err) {
        console.error('Failed to parse saved cart:', err);
      }
    }
  }, []);

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
          console.error('[OrderPortal] Failed to fetch user role:', userError.message);
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
        console.error('[OrderPortal] Session check failed:', err?.message ?? err);
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

  // Fetch menu items from menu_items_base with variants
  useEffect(() => {
    async function fetchMenuItems() {
      if (!supabase || loading) return;
      
      setLoadingMenu(true);
      try {
        // Try to fetch from menu_items_base (with variants)
        const { data: baseItemsData, error: baseError } = await supabase
          .from('menu_items_base')
          .select(`
            *,
            variant_types:menu_item_variant_types(
              *,
              options:menu_item_variant_options(*)
            )
          `)
          .eq('available', true)
          .order('category', { ascending: true })
          .order('name', { ascending: true });

        if (!baseError && baseItemsData && baseItemsData.length > 0) {
          // Sort variant types and options by display_order
          const sortedData = baseItemsData.map(item => ({
            ...item,
            variant_types: item.variant_types
              ? item.variant_types
                  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                  .map(vt => ({
                    ...vt,
                    options: vt.options
                      ? vt.options.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                      : []
                  }))
              : []
          }));
          setMenuItems(sortedData);
        } else {
          // Fallback to regular menu_items table if base table is empty or doesn't exist
          const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('available', true)
            .order('category', { ascending: true })
            .order('name', { ascending: true });

          if (!error && data) {
            setMenuItems(data);
          }
        }
      } catch (err) {
        console.error('[OrderPortal] Failed to fetch menu:', err);
      } finally {
        setLoadingMenu(false);
      }
    }

    fetchMenuItems();
  }, [loading]);

  const addToCart = (item) => {
    // Helper to get item price (fallback to base_price if price not set)
    const getItemPrice = (menuItem) => menuItem.price || menuItem.base_price;
    
    // Check if item has variants
    if (item.has_variants && item.variant_types && item.variant_types.length > 0) {
      // Show variant selection modal
      setSelectedItem(item);
      setShowVariantModal(true);
    } else {
      // Add directly for items without variants
      const existingItem = cart.find(cartItem => cartItem.id === item.id && !cartItem.cartItemId);
      let updatedCart;
      if (existingItem) {
        updatedCart = cart.map(cartItem => 
          cartItem.id === item.id && !cartItem.cartItemId
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        updatedCart = [...cart, { ...item, quantity: 1, price: getItemPrice(item) }];
      }
      setCart(updatedCart);
      localStorage.setItem('cart', JSON.stringify(updatedCart));
    }
  };

  const handleVariantConfirm = (configuredItem) => {
    // Add configured item to cart
    const existingItem = cart.find(cartItem => cartItem.cartItemId === configuredItem.cartItemId);
    let updatedCart;
    
    if (existingItem) {
      // Update quantity if same variant configuration exists
      updatedCart = cart.map(cartItem =>
        cartItem.cartItemId === configuredItem.cartItemId
          ? { ...cartItem, quantity: cartItem.quantity + configuredItem.quantity }
          : cartItem
      );
    } else {
      // Add new configured item
      updatedCart = [...cart, configuredItem];
    }
    
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    setShowVariantModal(false);
    setSelectedItem(null);
  };

  const handleVariantCancel = () => {
    setShowVariantModal(false);
    setSelectedItem(null);
  };

  const removeFromCart = (itemId, cartItemId = null) => {
    const updatedCart = cart.filter(item => {
      if (cartItemId) {
        return item.cartItemId !== cartItemId;
      }
      return item.id !== itemId;
    });
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  const updateQuantity = (itemId, newQuantity, cartItemId = null) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId, cartItemId);
    } else {
      const updatedCart = cart.map(item => {
        if (cartItemId) {
          return item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item;
        }
        return item.id === itemId && !item.cartItemId ? { ...item, quantity: newQuantity } : item;
      });
      setCart(updatedCart);
      localStorage.setItem('cart', JSON.stringify(updatedCart));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Get unique categories
  const categories = ['all', ...new Set(menuItems.map(item => item.category))];

  // Filter menu items by category
  const filteredItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  // Group items by category for display
  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

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
        <title>Order Portal - Bite Bonansa Cafe</title>
        <meta name="description" content="Browse our menu and place orders" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.push('/customer/dashboard')}>
            ← Back
          </button>
          <h1 style={styles.logo}>🍽️ Order Portal</h1>
          <span style={styles.cartBadge}>
            🛒 Cart ({cart.length})
          </span>
        </header>

        <main style={styles.main}>
          {/* Category Filter */}
          <div style={styles.categoryFilter}>
            {categories.map(category => (
              <button
                key={category}
                style={{
                  ...styles.categoryBtn,
                  ...(selectedCategory === category ? styles.categoryBtnActive : {})
                }}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All Menu' : category}
              </button>
            ))}
          </div>

          <div style={styles.content}>
            <div style={styles.menuSection}>
              {loadingMenu && (
                <p style={styles.loadingText}>Loading menu...</p>
              )}

              {!loadingMenu && menuItems.length === 0 && (
                <div style={styles.emptyState}>
                  <span style={styles.emptyIcon}>🍕</span>
                  <p style={styles.emptyText}>Menu items coming soon</p>
                  <p style={styles.emptySubtext}>
                    Check back later to see our delicious offerings
                  </p>
                </div>
              )}

              {!loadingMenu && selectedCategory === 'all' && Object.keys(groupedItems).length > 0 && (
                <>
                  {Object.keys(groupedItems).sort().map(category => (
                    <div key={category} style={styles.categorySection}>
                      <h3 style={styles.categoryTitle}>{category}</h3>
                      <div style={styles.menuGrid}>
                        {groupedItems[category].map(item => (
                          <MenuItem key={item.id} item={item} onAddToCart={addToCart} />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {!loadingMenu && selectedCategory !== 'all' && filteredItems.length > 0 && (
                <div style={styles.menuGrid}>
                  {filteredItems.map(item => (
                    <MenuItem key={item.id} item={item} onAddToCart={addToCart} />
                  ))}
                </div>
              )}

              {!loadingMenu && selectedCategory !== 'all' && filteredItems.length === 0 && (
                <p style={styles.emptyText}>No items in this category</p>
              )}
            </div>

            {/* Cart Sidebar */}
            {cart.length > 0 && (
              <div style={styles.cartSidebar}>
                <h3 style={styles.cartTitle}>Your Cart</h3>
                <div style={styles.cartItems}>
                  {cart.map((item, index) => {
                    const itemKey = item.cartItemId || `${item.id}_${index}`;
                    return (
                      <div key={itemKey} style={styles.cartItem}>
                        <div style={styles.cartItemInfo}>
                          <span style={styles.cartItemName}>
                            {item.name}
                            {item.variantDescription && (
                              <span style={styles.variantDesc}> ({item.variantDescription})</span>
                            )}
                          </span>
                          <span style={styles.cartItemPrice}>₱{item.price.toFixed(2)}</span>
                        </div>
                        <div style={styles.cartItemControls}>
                          <button 
                            style={styles.quantityBtn}
                            onClick={() => updateQuantity(item.id, item.quantity - 1, item.cartItemId)}
                          >
                            -
                          </button>
                          <span style={styles.quantity}>{item.quantity}</span>
                          <button 
                            style={styles.quantityBtn}
                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.cartItemId)}
                          >
                            +
                          </button>
                          <button 
                            style={styles.removeBtn}
                            onClick={() => removeFromCart(item.id, item.cartItemId)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={styles.cartTotal}>
                  <span style={styles.totalLabel}>Total:</span>
                  <span style={styles.totalAmount}>₱{getTotalPrice().toFixed(2)}</span>
                </div>
                <button 
                  style={styles.checkoutBtn}
                  onClick={() => router.push('/customer/checkout')}
                >
                  Proceed to Checkout
                </button>
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

function MenuItem({ item, onAddToCart }) {
  // Helper to get item price (fallback to base_price if price not set)
  const getItemPrice = (menuItem) => menuItem.price || menuItem.base_price;
  
  const displayPrice = getItemPrice(item);
  const hasVariants = item.has_variants && item.variant_types && item.variant_types.length > 0;
  
  return (
    <div style={styles.menuItem}>
      <div style={styles.menuItemHeader}>
        <h4 style={styles.menuItemName}>{item.name}</h4>
        <span style={styles.menuItemPrice}>
          {hasVariants ? 'From ' : ''}₱{displayPrice?.toFixed(2)}
        </span>
      </div>
      {item.description && (
        <p style={styles.menuItemDesc}>{item.description}</p>
      )}
      {hasVariants && (
        <p style={styles.customizeText}>🔧 Customizable</p>
      )}
      <button 
        style={styles.addBtn}
        onClick={() => onAddToCart(item)}
      >
        {hasVariants ? 'Customize & Add' : 'Add to Cart'}
      </button>
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
  categoryFilter: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  categoryBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#aaa',
    border: '1px solid #444',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
  categoryBtnActive: {
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: '1px solid #ffc107',
    fontWeight: '600',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: '24px',
  },
  menuSection: {
    minHeight: '400px',
  },
  categorySection: {
    marginBottom: '40px',
  },
  categoryTitle: {
    fontSize: '24px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '16px',
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '16px',
  },
  menuItem: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.2s',
  },
  menuItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  menuItemName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
    flex: 1,
  },
  menuItemPrice: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffc107',
    marginLeft: '8px',
  },
  menuItemDesc: {
    fontSize: '13px',
    color: '#999',
    marginBottom: '12px',
    lineHeight: '1.4',
  },
  customizeText: {
    fontSize: '12px',
    color: '#ffc107',
    fontWeight: '600',
    marginBottom: '8px',
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
    marginTop: 'auto',
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
    lineHeight: '1.4',
  },
  variantDesc: {
    display: 'block',
    fontSize: '11px',
    color: '#999',
    marginTop: '2px',
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
    fontSize: '18px',
    color: '#ccc',
    marginBottom: '8px',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#888',
  },
  loadingText: {
    color: '#aaa',
    fontSize: '14px',
  },
};
