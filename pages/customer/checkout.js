import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import LocationPicker from '../../components/LocationPicker';

export default function Checkout() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  
  const [formData, setFormData] = useState({
    deliveryAddress: '',
    deliveryLatitude: null,
    deliveryLongitude: null,
    contactNumber: '',
    paymentMethod: 'cash',
    gcashReference: '',
    specialRequest: ''
  });

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
          .select('role, full_name, phone, address')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[Checkout] Failed to fetch user data:', userError.message);
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

        // Pre-fill form with user data
        setFormData(prev => ({
          ...prev,
          deliveryAddress: userData?.address || '',
          contactNumber: userData?.phone || ''
        }));

        // Load cart from localStorage
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            setCart(parsedCart);
          } catch (err) {
            console.error('Failed to parse saved cart:', err);
            // Clear corrupted cart data
            localStorage.removeItem('cart');
            setError('Your saved cart data was corrupted and has been cleared. Please add items again.');
            // Redirect to order portal after brief delay
            setTimeout(() => {
              router.replace('/customer/order-portal').catch(console.error);
            }, 3000);
            return;
          }
        } else {
          // No cart items, redirect to order portal
          router.replace('/customer/order-portal').catch(console.error);
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error('[Checkout] Session check failed:', err?.message ?? err);
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

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateVAT = (subtotal) => {
    return subtotal * 0.12; // 12% VAT
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const vat = calculateVAT(subtotal);
    const fee = deliveryFee || 0;
    return subtotal + vat + fee;
  };

  const handleLocationSelect = async (location) => {
    setFormData(prev => ({
      ...prev,
      deliveryAddress: location.address,
      deliveryLatitude: location.latitude,
      deliveryLongitude: location.longitude,
    }));
    setError('');

    // Calculate delivery fee using Supabase function
    if (location.latitude && location.longitude) {
      setCalculatingFee(true);
      try {
        const { data, error } = await supabase.rpc('calculate_delivery_fee_from_store', {
          customer_latitude: location.latitude,
          customer_longitude: location.longitude,
        });

        if (error) throw error;

        setDeliveryFee(parseFloat(data) || 0);
      } catch (err) {
        console.error('[Checkout] Failed to calculate delivery fee:', err);
        setError('Failed to calculate delivery fee. Please try again.');
      } finally {
        setCalculatingFee(false);
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmitOrder = async () => {
    setError('');

    // Validation
    if (!formData.deliveryAddress.trim()) {
      setError('Please select a delivery location on the map');
      return;
    }

    if (!formData.deliveryLatitude || !formData.deliveryLongitude) {
      setError('Please pin your exact delivery location on the map');
      return;
    }

    if (!formData.contactNumber.trim()) {
      setError('Please provide a contact number');
      return;
    }

    if (formData.paymentMethod === 'gcash' && !formData.gcashReference.trim()) {
      setError('Please provide GCash reference number');
      return;
    }

    if (cart.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setSubmitting(true);

    try {
      const subtotal = calculateSubtotal();
      const vat = calculateVAT(subtotal);
      const total = calculateTotal();

      // Prepare order data with GPS coordinates
      const orderData = {
        customer_id: user.id,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        delivery_address: formData.deliveryAddress.trim(),
        delivery_latitude: formData.deliveryLatitude,
        delivery_longitude: formData.deliveryLongitude,
        delivery_fee: deliveryFee || 0,
        subtotal: subtotal,
        vat_amount: vat,
        total_amount: total,
        payment_method: formData.paymentMethod,
        gcash_reference: formData.paymentMethod === 'gcash' ? formData.gcashReference.trim() : null,
        special_request: formData.specialRequest.trim() || null,
        status: 'order_in_queue',
        order_mode: 'delivery',
        contact_number: formData.contactNumber.trim()
      };

      const { error: insertError } = await supabase
        .from('orders')
        .insert(orderData);

      if (insertError) throw insertError;

      // Clear cart from localStorage
      localStorage.removeItem('cart');

      // Show success message
      setSuccessMessage('Order placed successfully! Redirecting to order tracking...');
      
      // Redirect after a short delay to allow user to see success message
      setTimeout(() => {
        router.replace('/customer/order-tracking').catch(console.error);
      }, 2000);
    } catch (err) {
      console.error('[Checkout] Failed to submit order:', err);
      setError('Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
  const vat = calculateVAT(subtotal);
  const total = calculateTotal();

  return (
    <>
      <Head>
        <title>Checkout - Bite Bonansa Cafe</title>
        <meta name="description" content="Complete your order" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.push('/customer/order-portal')}>
            ← Back to Menu
          </button>
          <h1 style={styles.logo}>🛒 Checkout</h1>
          <span style={styles.placeholder}></span>
        </header>

        <main style={styles.main}>
          <div style={styles.container}>
            {/* Order Summary */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Order Summary</h2>
              <div style={styles.orderItems}>
                {cart.map(item => (
                  <div key={item.id} style={styles.orderItem}>
                    <div style={styles.itemInfo}>
                      <span style={styles.itemName}>{item.name}</span>
                      <span style={styles.itemQuantity}>x{item.quantity}</span>
                    </div>
                    <span style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Payment Details */}
              <div style={styles.paymentDetails}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Subtotal:</span>
                  <span style={styles.detailValue}>₱{subtotal.toFixed(2)}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>VAT (12%):</span>
                  <span style={styles.detailValue}>₱{vat.toFixed(2)}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Delivery Fee:</span>
                  <span style={styles.detailValue}>
                    {calculatingFee ? 'Calculating...' : deliveryFee !== null ? `₱${deliveryFee.toFixed(2)}` : 'Select location'}
                  </span>
                </div>
                <div style={{...styles.detailRow, ...styles.totalRow}}>
                  <span style={styles.totalLabel}>Total:</span>
                  <span style={styles.totalValue}>₱{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Delivery Information</h2>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Delivery Location *</label>
                <LocationPicker
                  onLocationSelect={handleLocationSelect}
                  initialAddress={formData.deliveryAddress}
                  apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Contact Number *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.contactNumber}
                  onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                  placeholder="Enter your contact number"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Special Request (Optional)</label>
                <textarea
                  style={styles.textarea}
                  value={formData.specialRequest}
                  onChange={(e) => handleInputChange('specialRequest', e.target.value)}
                  placeholder="Any special instructions for your order?"
                  rows={2}
                />
              </div>
            </div>

            {/* Payment Method */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Payment Method</h2>
              
              <div style={styles.paymentMethods}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={formData.paymentMethod === 'cash'}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    style={styles.radio}
                  />
                  <span style={styles.radioText}>💵 Cash on Delivery</span>
                </label>

                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="gcash"
                    checked={formData.paymentMethod === 'gcash'}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    style={styles.radio}
                  />
                  <span style={styles.radioText}>📱 GCash</span>
                </label>
              </div>

              {formData.paymentMethod === 'gcash' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>GCash Reference Number *</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={formData.gcashReference}
                    onChange={(e) => handleInputChange('gcashReference', e.target.value)}
                    placeholder="Enter GCash reference number"
                  />
                  <p style={styles.helperText}>
                    Please transfer the payment to our GCash number and enter the reference number above.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div style={styles.errorMessage}>{error}</div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div style={styles.successMessage}>{successMessage}</div>
            )}

            {/* Submit Button */}
            <button
              style={styles.submitBtn}
              onClick={handleSubmitOrder}
              disabled={submitting || successMessage}
            >
              {submitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </main>
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
  placeholder: {
    width: '100px',
  },
  main: {
    padding: '40px 32px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '20px',
  },
  orderItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  itemName: {
    fontSize: '14px',
    color: '#fff',
  },
  itemQuantity: {
    fontSize: '14px',
    color: '#999',
  },
  itemPrice: {
    fontSize: '14px',
    color: '#ffc107',
    fontWeight: '600',
  },
  paymentDetails: {
    borderTop: '2px solid #ffc107',
    paddingTop: '16px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  detailLabel: {
    fontSize: '14px',
    color: '#ccc',
  },
  detailValue: {
    fontSize: '14px',
    color: '#fff',
  },
  totalRow: {
    borderTop: '1px solid #444',
    marginTop: '8px',
    paddingTop: '16px',
  },
  totalLabel: {
    fontSize: '16px',
    color: '#fff',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: '18px',
    color: '#ffc107',
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '8px',
    fontWeight: '600',
  },
  input: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  helperText: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  paymentMethods: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '16px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #444',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  radio: {
    cursor: 'pointer',
    accentColor: '#ffc107',
  },
  radioText: {
    fontSize: '16px',
    color: '#fff',
  },
  errorMessage: {
    padding: '16px',
    backgroundColor: '#f443361a',
    color: '#f44336',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    border: '1px solid #f44336',
  },
  successMessage: {
    padding: '16px',
    backgroundColor: '#4caf501a',
    color: '#4caf50',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    border: '1px solid #4caf50',
    fontWeight: '600',
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
};
