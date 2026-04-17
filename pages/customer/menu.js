import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { calculateDeliveryFee, getDistanceBetweenCoordinates, STORE_LOCATION } from '../../utils/deliveryCalculator';

export default function CustomerMenu() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [specialRequest, setSpecialRequest] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState(null);
  const [deliveryLng, setDeliveryLng] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(35);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [gcashReference, setGcashReference] = useState('');
  const [pointsToUse, setPointsToUse] = useState(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

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
          .select('role, full_name, loyalty_balance, customer_id, address')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[CustomerMenu] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';
        setUserRole(role);
        setUserProfile(userData);
        setDeliveryAddress(userData?.address || '');

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

        // Fetch menu items
        await fetchMenuItems();

        setLoading(false);
      } catch (err) {
        console.error('[CustomerMenu] Session check failed:', err?.message ?? err);
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

  async function fetchMenuItems() {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category, price, description, image_url, available')
        .eq('available', true)
        .order('category');

      if (error) throw error;
      setMenuItems(data || []);
    } catch (err) {
      console.error('[CustomerMenu] Failed to fetch menu items:', err);
    }
  }

  const addToCart = (item) => {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      setCart(cart.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i));
    } else {
      setCart([...cart, {...item, quantity: 1}]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(i => i.id === itemId ? {...i, quantity} : i));
    }
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateEarnings = (subtotal) => {
    const percentage = subtotal < 500 ? 2 : 5;
    return (subtotal * percentage) / 100;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const vat = 0; // VAT disabled as per requirements
    const total = subtotal + deliveryFee + vat;
    return Math.max(0, total - pointsToUse);
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setDeliveryLat(lat);
          setDeliveryLng(lng);
          
          // Calculate delivery fee based on distance
          const distance = getDistanceBetweenCoordinates(
            STORE_LOCATION.latitude,
            STORE_LOCATION.longitude,
            lat,
            lng
          );
          const fee = calculateDeliveryFee(distance);
          setDeliveryFee(fee);
          
          // Update address with coordinates
          setDeliveryAddress(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
        },
        (error) => {
          alert('Unable to get current location: ' + error.message);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    if (!deliveryAddress.trim()) {
      alert('Please enter a delivery address');
      return;
    }

    if (paymentMethod === 'gcash' && !gcashReference.trim()) {
      alert('Please enter GCash reference number');
      return;
    }

    setShowCheckoutModal(true);
  };

  const confirmCheckout = async () => {
    setSubmittingOrder(true);
    try {
      const subtotal = calculateSubtotal();
      const vat = 0; // VAT disabled as per requirements
      const total = calculateTotal();
      const earnings = calculateEarnings(subtotal);
      const earningsPercentage = subtotal < 500 ? 2 : 5;

      // Prepare order data
      const orderData = {
        customer_id: user.id,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        special_request: specialRequest || null,
        delivery_address: deliveryAddress,
        delivery_latitude: deliveryLat,
        delivery_longitude: deliveryLng,
        delivery_fee: deliveryFee,
        subtotal: subtotal,
        vat_amount: vat,
        total_amount: total,
        payment_method: paymentMethod,
        gcash_reference: paymentMethod === 'gcash' ? gcashReference : null,
        points_used: pointsToUse,
        cash_amount: paymentMethod === 'cash' ? total : 0,
        gcash_amount: paymentMethod === 'gcash' ? total : 0,
        status: 'order_in_queue',
        earnings_percentage: earningsPercentage,
        earnings_amount: earnings
      };

      // Insert order
      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // If points were used, deduct from loyalty balance and create transaction
      if (pointsToUse > 0) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            loyalty_balance: userProfile.loyalty_balance - pointsToUse 
          })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Record loyalty transaction
        await supabase
          .from('loyalty_transactions')
          .insert({
            customer_id: user.id,
            order_id: orderResult.id,
            transaction_type: 'spent',
            amount: -pointsToUse,
            balance_after: userProfile.loyalty_balance - pointsToUse,
            description: `Used points for order #${orderResult.id}`
          });
      }

      // Clear cart and form
      setCart([]);
      setSpecialRequest('');
      setGcashReference('');
      setPointsToUse(0);
      setShowCheckoutModal(false);
      
      alert('Order placed successfully! Redirecting to order tracking...');
      router.push('/customer/orders').catch(console.error);
    } catch (err) {
      console.error('[CustomerMenu] Order submission failed:', err);
      alert('Failed to place order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[CustomerMenu] Sign out failed:', err?.message ?? err);
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

  const subtotal = calculateSubtotal();
  const vat = 0; // VAT disabled as per requirements
  const total = calculateTotal();
  const maxPointsToUse = Math.min(userProfile?.loyalty_balance || 0, total);

  return (
    <>
      <Head>
        <title>Order Portal - Bite Bonansa Cafe</title>
        <meta name="description" content="Browse our menu and place orders" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/customer/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/customer/menu" style={styles.navLink}>Order Portal</Link>
            <Link href="/customer/orders" style={styles.navLink}>Order Tracking</Link>
            <Link href="/customer/profile" style={styles.navLink}>My Profile</Link>
            <Link href="/customer/reviews" style={styles.navLink}>Share Review</Link>
          </nav>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>🍽️ Order Portal</h2>
          
          <div style={styles.contentGrid}>
            {/* Menu Items Section */}
            <div style={styles.menuSection}>
              <h3 style={styles.sectionTitle}>Menu Items</h3>
              {menuItems.length > 0 ? (
                <div style={styles.menuGrid}>
                  {menuItems.map(item => (
                    <div key={item.id} style={styles.menuCard}>
                      <div style={styles.menuImagePlaceholder}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} style={styles.menuImage} />
                        ) : (
                          <span style={styles.menuPlaceholder}>🍕</span>
                        )}
                      </div>
                      <h4 style={styles.menuItemName}>{item.name}</h4>
                      {item.category && (
                        <p style={styles.menuItemCategory}>{item.category}</p>
                      )}
                      {item.description && (
                        <p style={styles.menuItemDesc}>{item.description}</p>
                      )}
                      <p style={styles.menuItemPrice}>₱{item.price.toFixed(2)}</p>
                      <button
                        style={styles.addToCartBtn}
                        onClick={() => addToCart(item)}
                      >
                        🛒 Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyState}>
                  <span style={styles.emptyIcon}>🍕</span>
                  <p style={styles.emptyText}>No menu items available</p>
                </div>
              )}
            </div>

            {/* Cart and Checkout Section */}
            <div style={styles.cartSection}>
              <h3 style={styles.sectionTitle}>Cart ({cart.length})</h3>
              
              {cart.length > 0 ? (
                <>
                  <div style={styles.cartItems}>
                    {cart.map(item => (
                      <div key={item.id} style={styles.cartItem}>
                        <div style={styles.cartItemInfo}>
                          <h4 style={styles.cartItemName}>{item.name}</h4>
                          <p style={styles.cartItemPrice}>₱{item.price.toFixed(2)} each</p>
                        </div>
                        <div style={styles.cartItemControls}>
                          <button
                            style={styles.qtyBtn}
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span style={styles.qtyDisplay}>{item.quantity}</span>
                          <button
                            style={styles.qtyBtn}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            +
                          </button>
                          <button
                            style={styles.removeBtn}
                            onClick={() => removeFromCart(item.id)}
                          >
                            🗑️
                          </button>
                        </div>
                        <p style={styles.cartItemTotal}>
                          ₱{(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Special Request */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Special Request (Optional)</label>
                    <textarea
                      style={styles.textarea}
                      value={specialRequest}
                      onChange={(e) => setSpecialRequest(e.target.value)}
                      placeholder="Add any special instructions for your order..."
                      rows={3}
                    />
                  </div>

                  {/* Delivery Details */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Customer Name</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={userProfile?.full_name || ''}
                      disabled
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Delivery Address</label>
                    <textarea
                      style={styles.textarea}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter your delivery address..."
                      rows={2}
                    />
                    <button
                      style={styles.locationBtn}
                      onClick={handleUseCurrentLocation}
                    >
                      📍 Use Current Location
                    </button>
                  </div>

                  {/* Pricing Summary */}
                  <div style={styles.pricingSummary}>
                    <div style={styles.priceRow}>
                      <span>Subtotal</span>
                      <span>₱{subtotal.toFixed(2)}</span>
                    </div>
                    <div style={styles.priceRow}>
                      <span>Delivery Fee</span>
                      <span>₱{deliveryFee.toFixed(2)}</span>
                    </div>
                    <div style={styles.priceRow}>
                      <span>VAT (Disabled)</span>
                      <span>₱0.00</span>
                    </div>
                    {pointsToUse > 0 && (
                      <div style={{...styles.priceRow, color: '#4caf50'}}>
                        <span>Points Used</span>
                        <span>-₱{pointsToUse.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={styles.totalRow}>
                      <span>Total Amount</span>
                      <span>₱{total.toFixed(2)}</span>
                    </div>
                    <div style={styles.earningsInfo}>
                      You will earn ₱{calculateEarnings(subtotal).toFixed(2)} ({subtotal < 500 ? '2%' : '5%'}) on this order
                    </div>
                  </div>

                  {/* Payment Options */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Payment Method</label>
                    <div style={styles.radioGroup}>
                      <label style={styles.radioLabel}>
                        <input
                          type="radio"
                          value="cash"
                          checked={paymentMethod === 'cash'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                        />
                        <span>Cash</span>
                      </label>
                      <label style={styles.radioLabel}>
                        <input
                          type="radio"
                          value="gcash"
                          checked={paymentMethod === 'gcash'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                        />
                        <span>GCash</span>
                      </label>
                    </div>
                  </div>

                  {paymentMethod === 'gcash' && (
                    <div style={styles.gcashInfo}>
                      <p style={styles.gcashLabel}>Send payment to:</p>
                      <p style={styles.gcashDetail}><strong>Name:</strong> Catherine Jean Arclita</p>
                      <p style={styles.gcashDetail}><strong>Number:</strong> 09514915138</p>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>GCash Reference Number *</label>
                        <input
                          type="text"
                          style={styles.input}
                          value={gcashReference}
                          onChange={(e) => setGcashReference(e.target.value)}
                          placeholder="Enter reference number"
                        />
                      </div>
                    </div>
                  )}

                  {/* Points Earned Option */}
                  {userProfile?.loyalty_balance > 0 && (
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        Use Points (Available: ₱{userProfile.loyalty_balance.toFixed(2)})
                      </label>
                      <input
                        type="number"
                        style={styles.input}
                        value={pointsToUse}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(maxPointsToUse, parseFloat(e.target.value) || 0));
                          setPointsToUse(val);
                        }}
                        min={0}
                        max={maxPointsToUse}
                        step={0.01}
                      />
                    </div>
                  )}

                  {/* Checkout Button */}
                  <button
                    style={styles.checkoutBtn}
                    onClick={handleCheckout}
                  >
                    🛍️ Checkout
                  </button>
                </>
              ) : (
                <div style={styles.emptyCart}>
                  <span style={styles.emptyIcon}>🛒</span>
                  <p style={styles.emptyText}>Your cart is empty</p>
                  <p style={styles.emptySubtext}>Add items from the menu to get started</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Checkout Confirmation Modal */}
        {showCheckoutModal && (
          <div style={styles.modalOverlay} onClick={() => !submittingOrder && setShowCheckoutModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>Confirm Checkout</h3>
              <p style={styles.modalText}>
                Once you click checkout, you can no longer change any details of this order.
              </p>
              <div style={styles.modalSummary}>
                <p><strong>Items:</strong> {cart.length}</p>
                <p><strong>Total Amount:</strong> ₱{total.toFixed(2)}</p>
                <p><strong>Payment Method:</strong> {paymentMethod.toUpperCase()}</p>
                <p><strong>Delivery Address:</strong> {deliveryAddress}</p>
              </div>
              <div style={styles.modalActions}>
                <button
                  style={styles.modalBtnCancel}
                  onClick={() => setShowCheckoutModal(false)}
                  disabled={submittingOrder}
                >
                  Cancel
                </button>
                <button
                  style={styles.modalBtnConfirm}
                  onClick={confirmCheckout}
                  disabled={submittingOrder}
                >
                  {submittingOrder ? 'Processing...' : 'Confirm Checkout'}
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #ffc107',
    flexWrap: 'wrap',
    gap: '12px',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  nav: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.3s',
    cursor: 'pointer',
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
  },
  main: {
    padding: '40px 32px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '32px',
    textAlign: 'center',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '32px',
  },
  menuSection: {
    minHeight: '400px',
  },
  cartSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #444',
    position: 'sticky',
    top: '20px',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
  },
  sectionTitle: {
    fontSize: '24px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '24px',
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
  },
  menuCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #444',
    textAlign: 'center',
  },
  menuImagePlaceholder: {
    width: '100%',
    height: '150px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  menuImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  menuPlaceholder: {
    fontSize: '64px',
    opacity: 0.3,
  },
  menuItemName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 0 4px 0',
  },
  menuItemCategory: {
    fontSize: '12px',
    color: '#999',
    margin: '0 0 8px 0',
  },
  menuItemDesc: {
    fontSize: '12px',
    color: '#ccc',
    margin: '0 0 8px 0',
  },
  menuItemPrice: {
    fontSize: '18px',
    color: '#4caf50',
    margin: '0 0 12px 0',
    fontWeight: 'bold',
  },
  addToCartBtn: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  cartItems: {
    marginBottom: '20px',
  },
  cartItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 0 4px 0',
  },
  cartItemPrice: {
    fontSize: '12px',
    color: '#999',
    margin: 0,
  },
  cartItemControls: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  qtyBtn: {
    width: '30px',
    height: '30px',
    backgroundColor: '#444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  qtyDisplay: {
    fontSize: '14px',
    fontWeight: 'bold',
    minWidth: '30px',
    textAlign: 'center',
  },
  removeBtn: {
    marginLeft: 'auto',
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#f44336',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
  },
  cartItemTotal: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#4caf50',
    margin: 0,
    textAlign: 'right',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
  },
  textarea: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    resize: 'vertical',
  },
  locationBtn: {
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: '#444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  pricingSummary: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '14px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '12px',
    borderTop: '1px solid #444',
    marginTop: '8px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#ffc107',
  },
  earningsInfo: {
    fontSize: '12px',
    color: '#4caf50',
    marginTop: '8px',
    textAlign: 'center',
  },
  radioGroup: {
    display: 'flex',
    gap: '16px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  gcashInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    border: '1px solid #4caf50',
  },
  gcashLabel: {
    fontSize: '14px',
    color: '#4caf50',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
  },
  gcashDetail: {
    fontSize: '13px',
    color: '#ccc',
    margin: '4px 0',
  },
  checkoutBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
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
  emptyCart: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
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
  },
  modalOverlay: {
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
  modal: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    border: '1px solid #ffc107',
  },
  modalTitle: {
    fontSize: '24px',
    color: '#ffc107',
    margin: '0 0 16px 0',
    textAlign: 'center',
  },
  modalText: {
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '24px',
    textAlign: 'center',
  },
  modalSummary: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    fontSize: '14px',
    lineHeight: '1.8',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
  },
  modalBtnCancel: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  modalBtnConfirm: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
