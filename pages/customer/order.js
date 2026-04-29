import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import NotificationBell from '../../components/NotificationBell';
import VariantSelectionModal from '../../components/VariantSelectionModal';

const MAX_DISPLAYED_OPTIONS = 3; // Maximum number of variant options to display before showing "+X more"
const DEFAULT_DELIVERY_FEE = 30; // Default delivery fee in pesos

export default function CustomerOrderPortal() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [menuLoading, setMenuLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [orderMode, setOrderMode] = useState('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);

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
          .select('role, full_name, phone, address')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[CustomerOrderPortal] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';

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

        // Pre-fill contact info from user profile
        if (userData?.phone) setContactNumber(userData.phone);
        if (userData?.address) setDeliveryAddress(userData.address);

        // Fetch menu
        await fetchMenu();

        setLoading(false);
      } catch (err) {
        console.error('[CustomerOrderPortal] Session check failed:', err?.message ?? err);
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

  const fetchMenu = async () => {
    if (!supabase) return;
    setMenuLoading(true);
    try {
      // Fetch menu items with variants - only available items
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, price, base_price, category, available, has_variants, is_sold_out')
        .eq('available', true)
        .order('category');

      if (menuError) {
        console.error('[CustomerOrderPortal] Error fetching menu:', menuError);
        return;
      }

      // For items with variants, fetch their variant data
      const itemsWithVariants = await Promise.all(
        (menuData || []).map(async (item) => {
          if (!item.has_variants) return item;

          const { data: variantTypes, error: variantError } = await supabase
            .from('menu_item_variant_types')
            .select(`
              id,
              variant_type_name,
              is_required,
              allow_multiple,
              display_order,
              options:menu_item_variant_options(
                id,
                option_name,
                price_modifier,
                display_order,
                available
              )
            `)
            .eq('menu_item_id', item.id)
            .order('display_order');

          if (variantError) {
            console.error(`[CustomerOrderPortal] Error fetching variants for ${item.name}:`, variantError);
            return item;
          }

          // Filter variant types to only include those with available options
          const filteredVariantTypes = (variantTypes || []).map(vt => ({
            ...vt,
            options: (vt.options || []).filter(opt => opt.available !== false)
          })).filter(vt => vt.options.length > 0);

          return {
            ...item,
            variant_types: filteredVariantTypes
          };
        })
      );

      setMenuItems(itemsWithVariants);

      // Fetch categories
      const { data: cats, error: catsError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (!catsError && cats) {
        setCategories(cats);
      } else {
        // If categories table doesn't exist yet, extract unique categories from menu items
        const uniqueCategories = Array.from(
          new Set((menuData || []).map(item => item.category).filter(Boolean))
        ).map((name, index) => ({ id: String(index), name }));
        setCategories(uniqueCategories);
      }
    } catch (err) {
      console.error('[CustomerOrderPortal] Failed to fetch menu:', err?.message ?? err);
    } finally {
      setMenuLoading(false);
    }
  };

  const handleAddItem = (item) => {
    // Check if item is sold out
    if (item.is_sold_out) {
      alert('This item is currently sold out and cannot be added to the cart.');
      return;
    }

    // Check if item has variants
    if (item.has_variants && item.variant_types && item.variant_types.length > 0) {
      setSelectedItem(item);
      setShowVariantModal(true);
    } else {
      // Add item without variants
      addToCart({
        ...item,
        finalPrice: parseFloat(item.price || item.base_price || 0),
        quantity: 1,
      });
    }
  };

  const handleVariantConfirm = (itemWithVariants) => {
    addToCart(itemWithVariants);
    setShowVariantModal(false);
    setSelectedItem(null);
  };

  const addToCart = (item) => {
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(cartItem => cartItem.cartKey === item.cartKey);
      if (existingIndex >= 0) {
        // Item already in cart, update quantity
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity
        };
        return updated;
      } else {
        // New item
        return [...prevCart, item];
      }
    });
  };

  const removeFromCart = (cartKey) => {
    setCart(prevCart => prevCart.filter(item => item.cartKey !== cartKey));
  };

  const updateQuantity = (cartKey, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartKey);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.cartKey === cartKey ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const itemPrice = item.finalPrice || item.price || item.base_price || 0;
      return total + (itemPrice * item.quantity);
    }, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    if (orderMode === 'delivery' && !deliveryAddress.trim()) {
      alert('Please enter a delivery address');
      return;
    }

    if (orderMode === 'pick-up' && !contactNumber.trim()) {
      alert('Please enter a contact number');
      return;
    }

    setCheckoutLoading(true);
    setOrderStatus(null);

    try {
      // Prepare order items
      const items = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.finalPrice || item.price || item.base_price || 0,
        quantity: item.quantity,
        variantDetails: item.variantDetails || {}
      }));

      const subtotal = getCartTotal();
      const deliveryFee = orderMode === 'delivery' ? DEFAULT_DELIVERY_FEE : 0;

      const orderData = {
        customer_id: user.id,
        items: items,
        special_request: specialRequest.trim() || null,
        delivery_address: orderMode === 'delivery' ? deliveryAddress : 'N/A',
        delivery_fee: deliveryFee,
        delivery_fee_pending: orderMode === 'delivery', // Cashier will calculate exact fee
        subtotal: subtotal,
        vat_amount: 0,
        total_amount: subtotal + deliveryFee,
        payment_method: 'cash', // Temporary default - TODO: Implement payment method selection
        order_mode: orderMode,
        status: 'pending',
        contact_number: contactNumber.trim() || null,
      };

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        console.error('[CustomerOrderPortal] Order placement error:', error);
        setOrderStatus('error');
        alert('Failed to place order. Please try again.');
        return;
      }

      console.log('[CustomerOrderPortal] Order placed successfully:', data);
      setOrderStatus('success');
      clearCart();
      
      // Redirect to order tracking after successful order placement
      router.push('/customer/orders').catch(err => {
        console.error('[CustomerOrderPortal] Redirect failed:', err);
        // If redirect fails, user can manually navigate using the success message
      });

    } catch (err) {
      console.error('[CustomerOrderPortal] Checkout failed:', err);
      setOrderStatus('error');
      alert('An error occurred while placing your order. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[CustomerOrderPortal] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
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

  const subtotal = getCartTotal();
  const deliveryFee = orderMode === 'delivery' ? DEFAULT_DELIVERY_FEE : 0;
  const totalAmount = subtotal + deliveryFee;

  return (
    <>
      <Head>
        <title>Order Portal - Bite Bonansa Cafe</title>
        <meta name="description" content="Order your favorite items" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/customer/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/customer/order" style={styles.navLink}>Order Portal</Link>
            <Link href="/customer/orders" style={styles.navLink}>Order Tracking</Link>
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

        <div style={styles.body}>
          <section style={styles.menuPanel}>
            <h2 style={styles.sectionTitle}>Menu Items</h2>
            {menuLoading && <p style={styles.loadingText}>Loading menu…</p>}
            {!menuLoading && menuItems.length === 0 && <p style={styles.emptyText}>No menu items available</p>}
            
            {!menuLoading && menuItems.length > 0 && (
              <div style={styles.searchContainer}>
                <input
                  type="text"
                  placeholder="🔍 Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
            )}
            
            {!menuLoading && categories.length > 0 && (
              <div style={styles.categoryTabs}>
                <button
                  style={{
                    ...styles.categoryTab,
                    ...(selectedCategory === 'all' ? styles.categoryTabActive : {})
                  }}
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    style={{
                      ...styles.categoryTab,
                      ...(selectedCategory === category.name ? styles.categoryTabActive : {})
                    }}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            )}
            
            <div style={styles.menuGrid}>
              {menuItems
                .filter(item => {
                  // Filter by category
                  const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
                  // Filter by search term
                  const searchMatch = searchTerm === '' || 
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (item.category?.toLowerCase() || '').includes(searchTerm.toLowerCase());
                  return categoryMatch && searchMatch;
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                <button
                  key={item.id}
                  style={{
                    ...styles.menuCard,
                    ...(item.is_sold_out ? styles.soldOutCard : {})
                  }}
                  onClick={() => handleAddItem(item)}
                  disabled={item.is_sold_out}
                >
                  <span style={styles.menuItemName}>{item.name}</span>
                  <span style={styles.menuItemCategory}>{item.category}</span>
                  <span style={styles.menuItemPrice}>₱{Number(item.price || item.base_price || 0).toFixed(2)}</span>
                  
                  {/* Badge to indicate item has variants */}
                  {item.has_variants && item.variant_types && item.variant_types.length > 0 && (
                    <span style={styles.variantBadge}>
                      ⚙️ {item.variant_types.length} variant{item.variant_types.length > 1 ? 's' : ''}
                    </span>
                  )}
                  
                  {/* Detailed variant type summary */}
                  {item.has_variants && item.variant_types && item.variant_types.length > 0 && (
                    <div style={styles.variantInfo}>
                      {item.variant_types.map((vt, idx) => {
                        // Note: Options are already filtered during fetchMenu
                        const availableOptions = vt.options || [];
                        const optionNames = availableOptions.slice(0, MAX_DISPLAYED_OPTIONS).map(opt => opt.option_name);
                        const totalOptions = availableOptions.length;
                        const hasMoreOptions = totalOptions > MAX_DISPLAYED_OPTIONS;
                        return (
                          <div key={vt.id || idx} style={styles.variantType}>
                            <span style={styles.variantTypeName}>
                              {vt.variant_type_name}{vt.is_required ? '*' : ''}:
                            </span>
                            <span style={styles.variantOptions}>
                              {optionNames.join(', ')}
                              {hasMoreOptions && ` +${totalOptions - MAX_DISPLAYED_OPTIONS} more`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {item.is_sold_out && (
                    <span style={styles.soldOutBadge}>SOLD OUT</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section style={styles.orderPanel}>
            <h2 style={styles.sectionTitle}>Current Order</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Order Mode *</label>
              <select
                style={styles.select}
                value={orderMode}
                onChange={(e) => setOrderMode(e.target.value)}
              >
                <option value="delivery">🚚 Delivery</option>
                <option value="pick-up">🏃 Pick-up</option>
              </select>
            </div>

            {orderMode === 'delivery' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Delivery Address *</label>
                <textarea
                  style={styles.textarea}
                  placeholder="Enter your complete address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={3}
                  required
                />
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Contact Number *</label>
              <input
                style={styles.input}
                type="text"
                placeholder="09XXXXXXXXX"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Special Request</label>
              <textarea
                style={styles.textarea}
                placeholder="Any special instructions?"
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
                rows={2}
              />
            </div>

            <div style={styles.cartSection}>
              <h3 style={styles.cartTitle}>Cart Items</h3>
              {cart.length === 0 ? (
                <p style={styles.emptyText}>No items added</p>
              ) : (
                <ul style={styles.cartList}>
                  {cart.map((item) => {
                    let displayName = item.name;
                    if (item.variantDetails && Object.keys(item.variantDetails).length > 0) {
                      const variantStr = Object.entries(item.variantDetails)
                        .map(([type, value]) => `${value}`)
                        .join(', ');
                      displayName = `${item.name} (${variantStr})`;
                    }
                    
                    const itemPrice = item.finalPrice || item.price || item.base_price || 0;
                    const totalItemPrice = itemPrice * item.quantity;
                    const itemKey = item.cartKey || item.id;

                    return (
                      <li key={itemKey} style={styles.cartItem}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                          <span style={styles.cartItemName}>{displayName}</span>
                          <button style={styles.removeBtn} onClick={() => removeFromCart(itemKey)}>✕</button>
                        </div>
                        <div style={styles.cartControls}>
                          <button style={styles.qtyBtn} onClick={() => updateQuantity(itemKey, item.quantity - 1)}>−</button>
                          <span style={styles.qtyValue}>{item.quantity}</span>
                          <button style={styles.qtyBtn} onClick={() => updateQuantity(itemKey, item.quantity + 1)}>+</button>
                          <span style={styles.cartItemPrice}>₱{totalItemPrice.toFixed(2)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div style={styles.totalsSection}>
              <div style={styles.totalRow}><span>Subtotal:</span><span>₱{subtotal.toFixed(2)}</span></div>
              {deliveryFee > 0 && (
                <div style={styles.totalRow}>
                  <span>Delivery Fee:</span>
                  <span>₱{deliveryFee.toFixed(2)} (estimated)</span>
                </div>
              )}
              <div style={{ ...styles.totalRow, ...styles.netAmountRow }}>
                <span>Total Amount:</span>
                <span>₱{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {orderStatus === 'success' && (
              <p style={styles.successMsg}>
                ✅ Order placed successfully! Click <Link href="/customer/orders" style={{color: '#ffc107', textDecoration: 'underline'}}>here</Link> to view your order.
              </p>
            )}
            {orderStatus === 'error' && <p style={styles.errorMsg}>❌ Failed to place order</p>}

            <div style={styles.cartActions}>
              <button style={styles.clearBtn} onClick={clearCart} disabled={cart.length === 0}>Clear Cart</button>
              <button
                style={{ ...styles.checkoutBtn, opacity: cart.length === 0 || checkoutLoading ? 0.6 : 1 }}
                onClick={handleCheckout}
                disabled={cart.length === 0 || checkoutLoading}
              >
                {checkoutLoading ? '⏳ Processing…' : '✔ Place Order'}
              </button>
            </div>
          </section>
        </div>

        {/* Variant Selection Modal */}
        {showVariantModal && selectedItem && (
          <VariantSelectionModal
            item={selectedItem}
            onConfirm={handleVariantConfirm}
            onCancel={() => {
              setShowVariantModal(false);
              setSelectedItem(null);
            }}
          />
        )}
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
  headerActions: { display: 'flex', gap: '12px', alignItems: 'center' },
  logoutBtn: { padding: '8px 18px', backgroundColor: 'transparent', color: '#ffc107', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  body: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '32px', maxWidth: '1400px', margin: '0 auto' },
  menuPanel: { minWidth: 0 },
  orderPanel: { backgroundColor: '#1a1a1a', border: '1px solid #ffc107', borderRadius: '12px', padding: '24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' },
  sectionTitle: { fontSize: '18px', fontFamily: "'Playfair Display', serif", color: '#ffc107', marginTop: 0, marginBottom: '16px' },
  loadingText: { color: '#aaa', fontSize: '14px' },
  emptyText: { color: '#aaa', fontSize: '14px' },
  menuGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  menuCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px', backgroundColor: '#1a1a1a', border: '1px solid #ffc107', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', color: '#fff', textAlign: 'left' },
  soldOutCard: { opacity: 0.5, backgroundColor: '#2a2a2a', border: '1px solid #666', cursor: 'not-allowed' },
  menuItemName: { fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '4px' },
  menuItemCategory: { fontSize: '11px', color: '#888', marginBottom: '8px' },
  menuItemPrice: { fontSize: '15px', fontWeight: '700', color: '#ffc107' },
  variantBadge: { fontSize: '10px', color: '#ffc107', marginTop: '4px', backgroundColor: 'rgba(255, 193, 7, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255, 193, 7, 0.3)' },
  soldOutBadge: { fontSize: '10px', color: '#fff', marginTop: '4px', backgroundColor: '#d32f2f', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #444', borderRadius: '6px', backgroundColor: '#2a2a2a', color: '#fff', fontSize: '13px', boxSizing: 'border-box', outline: 'none' },
  select: { width: '100%', padding: '8px 12px', border: '1px solid #444', borderRadius: '6px', backgroundColor: '#2a2a2a', color: '#fff', fontSize: '13px', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' },
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid #444', borderRadius: '6px', backgroundColor: '#2a2a2a', color: '#fff', fontSize: '13px', boxSizing: 'border-box', outline: 'none', resize: 'vertical' },
  cartSection: { marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a2a2a' },
  cartTitle: { fontSize: '14px', color: '#ffc107', margin: '0 0 12px 0' },
  cartList: { listStyle: 'none', padding: 0, margin: '0 0 16px 0', maxHeight: '300px', overflowY: 'auto' },
  cartItem: { display: 'flex', flexDirection: 'column', padding: '12px 0', borderBottom: '1px solid #2a2a2a', gap: '8px' },
  cartItemName: { fontSize: '13px', color: '#fff', flex: 1, minWidth: 0, wordWrap: 'break-word', whiteSpace: 'normal' },
  cartControls: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  qtyBtn: { width: '24px', height: '24px', backgroundColor: '#2a2a2a', color: '#ffc107', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 },
  qtyValue: { fontSize: '13px', color: '#fff', minWidth: '20px', textAlign: 'center' },
  cartItemPrice: { fontSize: '13px', color: '#ffc107', minWidth: '52px', textAlign: 'right' },
  removeBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' },
  totalsSection: { marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #2a2a2a' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ccc', marginBottom: '6px' },
  netAmountRow: { fontSize: '16px', fontWeight: '700', color: '#ffc107', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ffc107' },
  successMsg: { color: '#4caf50', fontSize: '13px', marginTop: '12px' },
  errorMsg: { color: '#f44336', fontSize: '13px', marginTop: '12px' },
  cartActions: { display: 'flex', gap: '10px', marginTop: '16px' },
  clearBtn: { flex: 1, padding: '10px', backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
  checkoutBtn: { flex: 2, padding: '10px', backgroundColor: '#ffc107', color: '#0a0a0a', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
  categoryTabs: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  categoryTab: { padding: '8px 16px', backgroundColor: '#2a2a2a', color: '#aaa', border: '1px solid #444', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' },
  categoryTabActive: { backgroundColor: '#ffc107', color: '#0a0a0a', border: '1px solid #ffc107', fontWeight: '600' },
  searchContainer: { marginBottom: '16px' },
  searchInput: { width: '100%', padding: '10px 12px', border: '1px solid #444', borderRadius: '6px', backgroundColor: '#2a2a2a', color: '#fff', fontSize: '14px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' },
  variantInfo: { marginTop: '8px', width: '100%' },
  variantType: { fontSize: '10px', color: '#888', marginBottom: '2px' },
  variantTypeName: { fontWeight: '600', marginRight: '4px' },
  variantOptions: { color: '#aaa' },
};
